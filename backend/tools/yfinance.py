"""
secreai Tool — Yahoo Finance (yfinance)
Provides stock data, historical prices, fundamentals, and market info to AI agents.
Only callable when "yfinance" is in the session's enabled_tools set.
"""

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter()

TOOL_ID = "yfinance"


def _check_permission(enabled_tools: List[str]):
    if TOOL_ID not in enabled_tools:
        raise HTTPException(
            status_code=403,
            detail=f"Tool '{TOOL_ID}' is not enabled. Enable it in Tools & Permissions."
        )


# ── Request / Response models ────────────────────────────────────────
class TickerRequest(BaseModel):
    ticker: str
    enabled_tools: List[str]


class HistoryRequest(BaseModel):
    ticker: str
    period: str = "1mo"     # 1d 5d 1mo 3mo 6mo 1y 2y 5y 10y ytd max
    interval: str = "1d"    # 1m 2m 5m 15m 30m 60m 90m 1h 1d 5d 1wk 1mo 3mo
    enabled_tools: List[str]


class MultiTickerRequest(BaseModel):
    tickers: List[str]
    enabled_tools: List[str]


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/yfinance/info")
async def get_ticker_info(req: TickerRequest):
    """
    Fetch company information and current price for a ticker symbol.
    Returns: name, sector, industry, market cap, PE ratio, 52-week range, current price, etc.
    """
    _check_permission(req.enabled_tools)
    try:
        ticker = yf.Ticker(req.ticker.upper())
        info = ticker.info
        return {
            "ticker": req.ticker.upper(),
            "name": info.get("longName", "N/A"),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "country": info.get("country", "N/A"),
            "currency": info.get("currency", "USD"),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "dividend_yield": info.get("dividendYield"),
            "52_week_high": info.get("fiftyTwoWeekHigh"),
            "52_week_low": info.get("fiftyTwoWeekLow"),
            "revenue": info.get("totalRevenue"),
            "net_income": info.get("netIncomeToCommon"),
            "ebitda": info.get("ebitda"),
            "debt_to_equity": info.get("debtToEquity"),
            "return_on_equity": info.get("returnOnEquity"),
            "analyst_target_price": info.get("targetMeanPrice"),
            "recommendation": info.get("recommendationKey"),
            "summary": info.get("longBusinessSummary", "")[:500],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch info for {req.ticker}: {str(e)}")


@router.post("/yfinance/history")
async def get_price_history(req: HistoryRequest):
    """
    Fetch historical OHLCV price data for a ticker.
    Returns daily/intraday price records with open, high, low, close, volume.
    """
    _check_permission(req.enabled_tools)
    try:
        ticker = yf.Ticker(req.ticker.upper())
        hist = ticker.history(period=req.period, interval=req.interval)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {req.ticker}")

        records = []
        for dt, row in hist.iterrows():
            records.append({
                "date": str(dt.date()) if hasattr(dt, 'date') else str(dt),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })

        return {
            "ticker": req.ticker.upper(),
            "period": req.period,
            "interval": req.interval,
            "record_count": len(records),
            "data": records,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch history: {str(e)}")


@router.post("/yfinance/compare")
async def compare_tickers(req: MultiTickerRequest):
    """
    Compare current metrics for multiple tickers side by side.
    Useful for competitive analysis and portfolio snapshots.
    """
    _check_permission(req.enabled_tools)
    results = []
    for sym in req.tickers[:10]:  # cap at 10 to prevent abuse
        try:
            info = yf.Ticker(sym.upper()).info
            results.append({
                "ticker": sym.upper(),
                "name": info.get("longName", "N/A"),
                "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "revenue": info.get("totalRevenue"),
                "recommendation": info.get("recommendationKey"),
                "52_week_change": info.get("52WeekChange"),
            })
        except Exception:
            results.append({"ticker": sym.upper(), "error": "Failed to fetch"})
    return {"comparison": results}


@router.post("/yfinance/news")
async def get_ticker_news(req: TickerRequest):
    """Fetch recent news headlines for a ticker symbol."""
    _check_permission(req.enabled_tools)
    try:
        ticker = yf.Ticker(req.ticker.upper())
        news = ticker.news or []
        return {
            "ticker": req.ticker.upper(),
            "articles": [
                {
                    "title": a.get("title"),
                    "publisher": a.get("publisher"),
                    "link": a.get("link"),
                    "published_at": a.get("providerPublishTime"),
                }
                for a in news[:15]
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))