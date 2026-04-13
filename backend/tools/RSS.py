"""
secreai Tool — RSS Feed Reader
Parse any RSS/Atom feed URL and return structured article data.
Also supports preset feeds from .env (RSS_FEEDS comma-separated list).
No external API key needed — pure feed parsing.
"""

import os
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
TOOL_ID = "rss"

# Preset RSS feeds from environment (optional)
PRESET_FEEDS: List[str] = [
    url.strip()
    for url in os.getenv("RSS_FEEDS", "").split(",")
    if url.strip()
]


def _check_permission(enabled_tools: List[str]):
    if TOOL_ID not in enabled_tools:
        raise HTTPException(
            status_code=403,
            detail="RSS tool is not enabled. Enable 'RSS Feed Reader' in Tools & Permissions."
        )


class FeedRequest(BaseModel):
    url: str
    max_items: int = 20
    enabled_tools: List[str]


class MultiFeedRequest(BaseModel):
    urls: Optional[List[str]] = None     # custom URLs
    use_presets: bool = False             # include preset feeds from .env
    max_items_per_feed: int = 10
    enabled_tools: List[str]


class SearchFeedRequest(BaseModel):
    url: str
    keyword: str
    max_items: int = 30
    enabled_tools: List[str]


def _parse_rss_xml(xml_text: str, max_items: int = 20) -> List[dict]:
    """Parse RSS or Atom XML and return a list of article dicts."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = []

    # ── RSS 2.0 ────────────────────────────────────────────────────
    channel = root.find("channel")
    if channel is not None:
        feed_title = channel.findtext("title", "")
        for item in channel.findall("item")[:max_items]:
            items.append({
                "feed_title": feed_title,
                "title": item.findtext("title", "").strip(),
                "link": item.findtext("link", "").strip(),
                "description": (item.findtext("description") or "").strip()[:400],
                "published": item.findtext("pubDate", ""),
                "author": item.findtext("author") or item.findtext("dc:creator", "", namespaces={"dc": "http://purl.org/dc/elements/1.1/"}),
                "categories": [c.text for c in item.findall("category") if c.text],
            })
        return items

    # ── Atom 1.0 ──────────────────────────────────────────────────
    feed_title_el = root.find("atom:title", ns) or root.find("title")
    feed_title = feed_title_el.text if feed_title_el is not None else ""

    for entry in root.findall("atom:entry", ns)[:max_items]:
        title_el = entry.find("atom:title", ns) or entry.find("title")
        link_el  = entry.find("atom:link", ns) or entry.find("link")
        summary_el = entry.find("atom:summary", ns) or entry.find("summary") or entry.find("atom:content", ns)
        date_el  = entry.find("atom:updated", ns) or entry.find("atom:published", ns)
        author_el = entry.find(".//atom:name", ns)

        items.append({
            "feed_title": feed_title,
            "title": (title_el.text or "").strip() if title_el is not None else "",
            "link": link_el.get("href", "") if link_el is not None else "",
            "description": (summary_el.text or "").strip()[:400] if summary_el is not None else "",
            "published": date_el.text if date_el is not None else "",
            "author": author_el.text if author_el is not None else "",
            "categories": [],
        })

    return items


@router.post("/rss/fetch")
async def fetch_feed(req: FeedRequest):
    """
    Parse a single RSS/Atom feed URL and return structured articles.
    Works with any publicly accessible RSS or Atom feed.
    """
    _check_permission(req.enabled_tools)

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            response = await client.get(req.url, headers={"User-Agent": "secreai-rss-reader/1.0"})
        except httpx.RequestError as e:
            raise HTTPException(status_code=400, detail=f"Could not fetch feed: {e}")

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Feed returned {response.status_code}")

    try:
        items = _parse_rss_xml(response.text, req.max_items)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "url": req.url,
        "item_count": len(items),
        "fetched_at": datetime.utcnow().isoformat(),
        "items": items,
    }


@router.post("/rss/multi")
async def fetch_multiple_feeds(req: MultiFeedRequest):
    """
    Fetch and aggregate multiple RSS feeds into a unified article stream.
    Optionally includes preset feeds defined in .env RSS_FEEDS.
    """
    _check_permission(req.enabled_tools)

    feed_urls = list(req.urls or [])
    if req.use_presets:
        feed_urls = list(set(feed_urls + PRESET_FEEDS))

    if not feed_urls:
        raise HTTPException(status_code=400, detail="No feed URLs provided and no presets configured.")

    all_items = []
    errors = []

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        for url in feed_urls[:15]:  # cap at 15 feeds
            try:
                response = await client.get(url, headers={"User-Agent": "secreai-rss-reader/1.0"})
                if response.status_code == 200:
                    items = _parse_rss_xml(response.text, req.max_items_per_feed)
                    all_items.extend(items)
                else:
                    errors.append({"url": url, "error": f"HTTP {response.status_code}"})
            except Exception as e:
                errors.append({"url": url, "error": str(e)})

    # Sort by published date (newest first, best-effort)
    def _sort_key(item):
        return item.get("published", "") or ""

    all_items.sort(key=_sort_key, reverse=True)

    return {
        "feed_count": len(feed_urls),
        "total_items": len(all_items),
        "fetched_at": datetime.utcnow().isoformat(),
        "errors": errors,
        "items": all_items,
    }


@router.post("/rss/search")
async def search_feed(req: SearchFeedRequest):
    """
    Fetch a feed and filter items by a keyword in title or description.
    """
    _check_permission(req.enabled_tools)

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            response = await client.get(req.url, headers={"User-Agent": "secreai-rss-reader/1.0"})
        except httpx.RequestError as e:
            raise HTTPException(status_code=400, detail=str(e))

    items = _parse_rss_xml(response.text, req.max_items)
    keyword = req.keyword.lower()
    filtered = [
        item for item in items
        if keyword in (item.get("title") or "").lower()
        or keyword in (item.get("description") or "").lower()
    ]

    return {
        "url": req.url,
        "keyword": req.keyword,
        "total_scanned": len(items),
        "matched": len(filtered),
        "items": filtered,
    }


@router.get("/rss/presets")
async def list_preset_feeds():
    """List all RSS feed URLs configured in .env RSS_FEEDS."""
    return {"preset_feeds": PRESET_FEEDS, "count": len(PRESET_FEEDS)}