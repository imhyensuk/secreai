"""
secreai Tool — SerpAPI Web Search
Provides real-time Google search results to AI agents.
Requires SERPAPI_KEY in .env
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
TOOL_ID = "serp"
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
SERPAPI_BASE = "https://serpapi.com/search"


def _check_permission(enabled_tools: List[str]):
    if "web_search" not in enabled_tools and TOOL_ID not in enabled_tools:
        raise HTTPException(
            status_code=403,
            detail="Web search tool is not enabled. Enable 'Web Search' in Tools & Permissions."
        )
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SERPAPI_KEY not configured in .env")


class SearchRequest(BaseModel):
    query: str
    num_results: int = 10
    country: str = "us"
    language: str = "en"
    enabled_tools: List[str]


class ImageSearchRequest(BaseModel):
    query: str
    num_results: int = 8
    enabled_tools: List[str]


class NewsSearchRequest(BaseModel):
    query: str
    num_results: int = 10
    enabled_tools: List[str]


@router.post("/serp/search")
async def web_search(req: SearchRequest):
    """
    Perform a Google web search and return organic results.
    Returns: title, link, snippet, position for each result.
    """
    _check_permission(req.enabled_tools)

    params = {
        "q": req.query,
        "api_key": SERPAPI_KEY,
        "engine": "google",
        "num": min(req.num_results, 20),
        "gl": req.country,
        "hl": req.language,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(SERPAPI_BASE, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="SerpAPI request failed")

    data = response.json()

    organic = data.get("organic_results", [])
    knowledge = data.get("knowledge_graph", {})
    answer_box = data.get("answer_box", {})

    results = [
        {
            "position": r.get("position"),
            "title": r.get("title"),
            "link": r.get("link"),
            "snippet": r.get("snippet"),
            "displayed_link": r.get("displayed_link"),
            "date": r.get("date"),
        }
        for r in organic
    ]

    return {
        "query": req.query,
        "total_results": data.get("search_information", {}).get("total_results"),
        "answer_box": answer_box if answer_box else None,
        "knowledge_graph": {
            "title": knowledge.get("title"),
            "description": knowledge.get("description"),
        } if knowledge else None,
        "organic_results": results,
    }


@router.post("/serp/news")
async def news_search(req: NewsSearchRequest):
    """Search Google News for recent articles on a topic."""
    _check_permission(req.enabled_tools)

    params = {
        "q": req.query,
        "api_key": SERPAPI_KEY,
        "engine": "google",
        "tbm": "nws",
        "num": min(req.num_results, 20),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(SERPAPI_BASE, params=params)

    data = response.json()
    news = data.get("news_results", [])

    return {
        "query": req.query,
        "articles": [
            {
                "title": a.get("title"),
                "link": a.get("link"),
                "source": a.get("source"),
                "date": a.get("date"),
                "snippet": a.get("snippet"),
                "thumbnail": a.get("thumbnail"),
            }
            for a in news
        ],
    }


@router.post("/serp/images")
async def image_search(req: ImageSearchRequest):
    """Search Google Images and return image URLs with metadata."""
    _check_permission(req.enabled_tools)

    params = {
        "q": req.query,
        "api_key": SERPAPI_KEY,
        "engine": "google",
        "tbm": "isch",
        "num": min(req.num_results, 20),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(SERPAPI_BASE, params=params)

    data = response.json()
    images = data.get("images_results", [])

    return {
        "query": req.query,
        "images": [
            {
                "title": img.get("title"),
                "original": img.get("original"),
                "thumbnail": img.get("thumbnail"),
                "source": img.get("source"),
            }
            for img in images[:req.num_results]
        ],
    }