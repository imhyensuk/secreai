"""
secreai Tool — Deep Search (Advanced Research Orchestrator)
Performs multi-step or advanced deep web research for complex queries.
Uses Tavily Advanced API (or similar) under the hood to aggregate deep context.
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
TOOL_ID = "deepsearch"

# 여기서는 심층 검색에 가장 적합한 Tavily의 Advanced 모드를 백엔드로 활용합니다.
DEEPSEARCH_API_KEY = os.getenv("TAVILY_API_KEY", "")
DEEPSEARCH_BASE_URL = "https://api.tavily.com/search"

def _check_permission(enabled_tools: List[str]):
    if TOOL_ID not in enabled_tools and "web_search" not in enabled_tools:
        raise HTTPException(
            status_code=403,
            detail="Deep Search is not enabled. Enable it in Tools & Permissions."
        )
    if not DEEPSEARCH_API_KEY:
        raise HTTPException(status_code=500, detail="Search API Key not configured in .env")

class DeepSearchRequest(BaseModel):
    query: str
    search_depth: str = "advanced"  # basic보다 훨씬 깊고 느린 심층 탐색
    max_results: int = 10
    include_domains: Optional[List[str]] = None
    enabled_tools: List[str]

@router.post("/deepsearch/research")
async def perform_deep_research(req: DeepSearchRequest):
    """
    복잡한 주제에 대해 심층 조사를 수행합니다.
    일반 검색보다 시간이 오래 걸리지만, 훨씬 상세하고 출처가 명확한 데이터를 수집합니다.
    """
    _check_permission(req.enabled_tools)
    
    payload = {
        "api_key": DEEPSEARCH_API_KEY,
        "query": req.query,
        "search_depth": "advanced", # 심층 검색 강제
        "max_results": req.max_results,
        "include_answer": True,     # AI가 1차 종합한 답변 포함
        "include_raw_content": False # True로 할 경우 컨텍스트 오버플로우 위험이 크므로 False 유지
    }
    
    if req.include_domains:
        payload["include_domains"] = req.include_domains

    try:
        async with httpx.AsyncClient(timeout=45.0) as client: # 심층 검색은 시간이 더 걸리므로 타임아웃 45초
            response = await client.post(DEEPSEARCH_BASE_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            
        # AI 모델이 데이터를 에코잉(그대로 출력)하지 않고 요약하도록 안전 장치(System Note) 삽입
        return {
            "query_analyzed": req.query,
            "research_summary": data.get("answer", "No synthesis provided by search engine."),
            "key_sources": [
                {
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "snippet": r.get("content")
                }
                for r in data.get("results", [])
            ],
            "system_note": "CRITICAL: Do NOT copy and paste this JSON. Read the research summary and key sources, then synthesize a natural language briefing for the user based on your expert persona."
        }
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Search API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deep search failed: {str(e)}")