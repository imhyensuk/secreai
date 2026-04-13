"""
secreai Tool — Tavily AI Search
LLM-optimized deep web search with structured, citation-ready results.
Requires TAVILY_API_KEY in .env
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Literal
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
TOOL_ID = "tavily"
TAVILY_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_BASE = "https://api.tavily.com"


def _check_permission(enabled_tools: List[str]):
    if TOOL_ID not in enabled_tools:
        raise HTTPException(
            status_code=403,
            detail="Tavily search is not enabled. Enable 'Tavily AI Search' in Tools & Permissions."
        )
    if not TAVILY_KEY:
        raise HTTPException(status_code=500, detail="TAVILY_API_KEY not configured in .env")


class TavilySearchRequest(BaseModel):
    query: str
    search_depth: Literal["basic", "advanced"] = "basic"
    topic: Literal["general", "news"] = "general"
    max_results: int = 8
    include_answer: bool = True          # Get an AI-synthesized answer
    include_raw_content: bool = False    # Full page content (verbose)
    include_domains: Optional[List[str]] = None    # Whitelist
    exclude_domains: Optional[List[str]] = None    # Blacklist
    enabled_tools: List[str]


class TavilyExtractRequest(BaseModel):
    urls: List[str]     # Extract content from specific pages
    enabled_tools: List[str]


@router.post("/tavily/search")
async def tavily_search(req: TavilySearchRequest):
    """
    AI-optimized web search returning structured, citation-ready results.
    'advanced' depth triggers deeper crawling — slower but more thorough.
    include_answer=True returns a synthesized answer in addition to sources.
    """
    _check_permission(req.enabled_tools)

    payload = {
        "api_key": TAVILY_KEY,
        "query": req.query,
        "search_depth": req.search_depth,
        "topic": req.topic,
        "max_results": min(req.max_results, 20),
        "include_answer": req.include_answer,
        "include_raw_content": req.include_raw_content,
    }
    if req.include_domains:
        payload["include_domains"] = req.include_domains
    if req.exclude_domains:
        payload["exclude_domains"] = req.exclude_domains

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{TAVILY_BASE}/search", json=payload)

    if response.status_code != 200:
        detail = response.json().get("detail", "Tavily request failed")
        raise HTTPException(status_code=response.status_code, detail=detail)

    data = response.json()

    return {
        "query": req.query,
        "answer": data.get("answer"),
        "follow_up_questions": data.get("follow_up_questions", []),
        "results": [
            {
                "title": r.get("title"),
                "url": r.get("url"),
                "content": r.get("content"),
                "score": r.get("score"),
                "published_date": r.get("published_date"),
            }
            for r in data.get("results", [])
        ],
        "response_time": data.get("response_time"),
    }


@router.post("/tavily/extract")
async def tavily_extract(req: TavilyExtractRequest):
    """
    Extract full text content from a list of URLs.
    Useful for agents that need to read specific pages in full.
    """
    _check_permission(req.enabled_tools)

    payload = {
        "api_key": TAVILY_KEY,
        "urls": req.urls[:5],  # cap at 5
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{TAVILY_BASE}/extract", json=payload)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Tavily extract failed")

    data = response.json()

    return {
        "results": [
            {
                "url": r.get("url"),
                "raw_content": r.get("raw_content", "")[:5000],  # truncate long pages
                "failed_results": data.get("failed_results", []),
            }
            for r in data.get("results", [])
        ]
    }