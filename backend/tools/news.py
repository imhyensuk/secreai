"""
secreai Tool — NewsAPI
Fetch real-time and historical news articles from thousands of global sources.
Requires NEWS_API_KEY in .env
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Literal
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
TOOL_ID = "news_api"
NEWS_KEY = os.getenv("NEWS_API_KEY", "")
NEWS_BASE = "https://newsapi.org/v2"


def _check_permission(enabled_tools: List[str]):
    if TOOL_ID not in enabled_tools and "news" not in enabled_tools:
        raise HTTPException(
            status_code=403,
            detail="News API is not enabled. Enable 'News API' in Tools & Permissions."
        )
    if not NEWS_KEY:
        raise HTTPException(status_code=500, detail="NEWS_API_KEY not configured in .env")


class TopHeadlinesRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[Literal["business", "entertainment", "general", "health", "science", "sports", "technology"]] = None
    country: str = "us"             # ISO 3166-1 alpha-2 country code
    sources: Optional[str] = None  # comma-separated source IDs
    page_size: int = 20
    enabled_tools: List[str]


class EverythingRequest(BaseModel):
    query: str
    from_date: Optional[str] = None    # YYYY-MM-DD
    to_date: Optional[str] = None
    sort_by: Literal["relevancy", "popularity", "publishedAt"] = "publishedAt"
    language: str = "en"
    sources: Optional[str] = None
    domains: Optional[str] = None      # comma-separated domains
    page_size: int = 20
    page: int = 1
    enabled_tools: List[str]


class SourcesRequest(BaseModel):
    category: Optional[str] = None
    language: str = "en"
    country: Optional[str] = None
    enabled_tools: List[str]


def _format_articles(articles: list) -> list:
    return [
        {
            "title": a.get("title"),
            "description": a.get("description"),
            "url": a.get("url"),
            "source": a.get("source", {}).get("name"),
            "author": a.get("author"),
            "published_at": a.get("publishedAt"),
            "url_to_image": a.get("urlToImage"),
        }
        for a in articles
        if a.get("title") and "[Removed]" not in a.get("title", "")
    ]


@router.post("/news/headlines")
async def top_headlines(req: TopHeadlinesRequest):
    """
    Fetch top news headlines.
    Filter by country, category, or keyword query.
    """
    _check_permission(req.enabled_tools)

    params = {
        "apiKey": NEWS_KEY,
        "pageSize": min(req.page_size, 100),
        "country": req.country,
    }
    if req.query:   params["q"] = req.query
    if req.category: params["category"] = req.category
    if req.sources:  params["sources"] = req.sources

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{NEWS_BASE}/top-headlines", params=params)

    data = response.json()
    if data.get("status") != "ok":
        raise HTTPException(status_code=400, detail=data.get("message", "NewsAPI error"))

    return {
        "total_results": data.get("totalResults", 0),
        "articles": _format_articles(data.get("articles", [])),
    }


@router.post("/news/everything")
async def everything(req: EverythingRequest):
    """
    Search all news articles from the past month.
    Best for deep research with date ranges and domain filtering.
    """
    _check_permission(req.enabled_tools)

    params = {
        "apiKey": NEWS_KEY,
        "q": req.query,
        "sortBy": req.sort_by,
        "language": req.language,
        "pageSize": min(req.page_size, 100),
        "page": req.page,
    }
    if req.from_date: params["from"] = req.from_date
    if req.to_date:   params["to"]   = req.to_date
    if req.sources:   params["sources"] = req.sources
    if req.domains:   params["domains"] = req.domains

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(f"{NEWS_BASE}/everything", params=params)

    data = response.json()
    if data.get("status") != "ok":
        raise HTTPException(status_code=400, detail=data.get("message", "NewsAPI error"))

    return {
        "query": req.query,
        "total_results": data.get("totalResults", 0),
        "page": req.page,
        "articles": _format_articles(data.get("articles", [])),
    }


@router.post("/news/sources")
async def get_sources(req: SourcesRequest):
    """List all available news sources — optionally filtered by category, language, country."""
    _check_permission(req.enabled_tools)

    params = {"apiKey": NEWS_KEY, "language": req.language}
    if req.category: params["category"] = req.category
    if req.country:  params["country"]  = req.country

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{NEWS_BASE}/top-headlines/sources", params=params)

    data = response.json()
    if data.get("status") != "ok":
        raise HTTPException(status_code=400, detail=data.get("message", "NewsAPI error"))

    return {
        "sources": [
            {
                "id": s.get("id"),
                "name": s.get("name"),
                "description": s.get("description"),
                "url": s.get("url"),
                "category": s.get("category"),
                "country": s.get("country"),
            }
            for s in data.get("sources", [])
        ]
    }