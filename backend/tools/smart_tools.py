"""
secreai — Smart Tools (MCP-style)
Tools that AI agents can conceptually use during chat sessions.
These are also callable as standalone REST endpoints.

Tools included:
  /tools/calculator     — safe math expression evaluator
  /tools/weather        — real-time weather via Open-Meteo (free, no key)
  /tools/currency       — exchange rates via exchangerate-api
  /tools/summarizer     — AI text summarization (via Gemini)
  /tools/translator     — text translation (via Gemini)
  /tools/code-analyzer  — code review + suggestions (via Gemini)
  /tools/chart-data     — generate chart-ready JSON from text description
  /tools/timeline       — parse events into timeline JSON
  /tools/swot           — generate SWOT analysis JSON
  /tools/pros-cons      — generate pros/cons JSON
"""

import os
import re
import json
import math
import httpx
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
GOOGLE_AI_KEY = os.getenv("GOOGLE_AI_API_KEY", "")
GEMINI_URL    = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


async def _gemini(prompt: str, system: str = "You are a helpful assistant. Respond concisely.") -> str:
    """Quick Gemini call for tool outputs."""
    if not GOOGLE_AI_KEY:
        raise HTTPException(503, "GOOGLE_AI_API_KEY not set in .env")
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(GEMINI_URL, json=payload, params={"key": GOOGLE_AI_KEY})
        if resp.status_code != 200:
            raise HTTPException(503, f"Gemini error: {resp.text[:200]}")
        try:
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            raise HTTPException(503, "Gemini response parse error")


async def _gemini_json(prompt: str, system: str) -> dict:
    """Gemini call expecting JSON output."""
    text = await _gemini(prompt, system + " Respond ONLY with valid JSON, no markdown, no explanation.")
    # Strip markdown code blocks if present
    text = re.sub(r"```json\s*|\s*```", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(503, f"Model returned invalid JSON: {text[:200]}")


# ══════════════════════════════════════════════════════════════════════
#  CALCULATOR
# ══════════════════════════════════════════════════════════════════════

class CalcRequest(BaseModel):
    expression: str   # e.g. "sqrt(144) + 2^8 - log(1000)"

SAFE_NAMES = {
    k: v for k, v in math.__dict__.items() if not k.startswith("_")
}
SAFE_NAMES.update({"abs": abs, "round": round, "min": min, "max": max, "sum": sum})

@router.post("/calculator")
async def calculator(req: CalcRequest):
    """Safely evaluate a math expression."""
    expr = req.expression.strip()
    # Replace ^ with ** for power
    expr = expr.replace("^", "**")
    # Allow only safe characters
    if re.search(r"[a-zA-Z_]", expr):
        # Has function names — use safe eval
        try:
            result = eval(expr, {"__builtins__": {}}, SAFE_NAMES)  # noqa: S307
        except Exception as e:
            raise HTTPException(400, f"Calculation error: {e}")
    else:
        try:
            result = eval(expr, {"__builtins__": {}})  # noqa: S307
        except Exception as e:
            raise HTTPException(400, f"Calculation error: {e}")

    return {"expression": req.expression, "result": result,
            "formatted": f"{result:,}" if isinstance(result, (int, float)) else str(result)}


# ══════════════════════════════════════════════════════════════════════
#  WEATHER (Open-Meteo — free, no API key)
# ══════════════════════════════════════════════════════════════════════

class WeatherRequest(BaseModel):
    city: str          # city name
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@router.post("/weather")
async def get_weather(req: WeatherRequest):
    """Get current weather. Uses geocoding if only city name provided."""
    lat, lon = req.latitude, req.longitude

    if lat is None or lon is None:
        # Geocode via Open-Meteo geocoding
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": req.city, "count": 1, "language": "en", "format": "json"},
            )
        results = geo.json().get("results", [])
        if not results:
            raise HTTPException(404, f"City '{req.city}' not found.")
        lat = results[0]["latitude"]
        lon = results[0]["longitude"]
        city_name = results[0].get("name", req.city)
        country   = results[0].get("country", "")
    else:
        city_name = req.city; country = ""

    async with httpx.AsyncClient(timeout=10.0) as client:
        weather = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature",
                "timezone": "auto",
            },
        )

    data = weather.json()
    current = data.get("current", {})
    code    = current.get("weather_code", 0)

    WMO_CODES = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle",
        55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
        71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers",
        95: "Thunderstorm", 99: "Thunderstorm with hail",
    }

    return {
        "city":             city_name,
        "country":          country,
        "latitude":         lat,
        "longitude":        lon,
        "temperature_c":    current.get("temperature_2m"),
        "feels_like_c":     current.get("apparent_temperature"),
        "humidity_pct":     current.get("relative_humidity_2m"),
        "wind_speed_kmh":   current.get("wind_speed_10m"),
        "condition":        WMO_CODES.get(code, f"Code {code}"),
        "weather_code":     code,
    }


# ══════════════════════════════════════════════════════════════════════
#  CURRENCY EXCHANGE (exchangerate.host — free)
# ══════════════════════════════════════════════════════════════════════

class CurrencyRequest(BaseModel):
    amount: float
    from_currency: str   # e.g. "USD"
    to_currency: str     # e.g. "KRW"

@router.post("/currency")
async def convert_currency(req: CurrencyRequest):
    frm = req.from_currency.upper()
    to  = req.to_currency.upper()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://open.er-api.com/v6/latest/{frm}",
        )
    if resp.status_code != 200:
        raise HTTPException(503, "Exchange rate service unavailable.")
    data = resp.json()
    rates = data.get("rates", {})
    if to not in rates:
        raise HTTPException(400, f"Currency '{to}' not found.")
    rate   = rates[to]
    result = req.amount * rate
    return {
        "from":        frm,
        "to":          to,
        "amount":      req.amount,
        "rate":        rate,
        "result":      round(result, 4),
        "formatted":   f"{result:,.2f} {to}",
        "last_updated": data.get("time_last_update_utc", ""),
    }


# ══════════════════════════════════════════════════════════════════════
#  TEXT SUMMARIZER
# ══════════════════════════════════════════════════════════════════════

class SummarizeRequest(BaseModel):
    text: str
    max_words: int = 150
    style: str = "concise"   # concise | bullet | executive

@router.post("/summarizer")
async def summarize(req: SummarizeRequest):
    style_prompt = {
        "concise":   f"Summarize in {req.max_words} words or fewer.",
        "bullet":    f"Summarize as 5-7 bullet points, each under 20 words.",
        "executive": f"Write an executive summary of {req.max_words} words: key insight, main findings, recommended action.",
    }.get(req.style, f"Summarize in {req.max_words} words.")

    text = await _gemini(
        f"Text to summarize:\n\n{req.text[:4000]}\n\n{style_prompt}",
        "You are an expert summarizer. Be accurate and concise."
    )
    return {"summary": text, "style": req.style, "original_length": len(req.text.split())}


# ══════════════════════════════════════════════════════════════════════
#  TRANSLATOR
# ══════════════════════════════════════════════════════════════════════

class TranslateRequest(BaseModel):
    text: str
    target_language: str   # e.g. "Korean", "Spanish", "Japanese"
    source_language: Optional[str] = "auto"

@router.post("/translator")
async def translate(req: TranslateRequest):
    src = f" from {req.source_language}" if req.source_language and req.source_language != "auto" else ""
    result = await _gemini(
        f"Translate the following text{src} to {req.target_language}. Return only the translation.\n\n{req.text[:3000]}",
        "You are a professional translator. Translate accurately and naturally."
    )
    return {
        "original":        req.text,
        "translation":     result,
        "target_language": req.target_language,
        "source_language": req.source_language,
    }


# ══════════════════════════════════════════════════════════════════════
#  CODE ANALYZER
# ══════════════════════════════════════════════════════════════════════

class CodeRequest(BaseModel):
    code: str
    language: Optional[str] = "auto-detect"
    analysis_type: str = "review"   # review | explain | optimize | security | test

@router.post("/code-analyzer")
async def analyze_code(req: CodeRequest):
    prompts = {
        "review":   "Review this code. Identify issues, suggest improvements, rate quality 1-10.",
        "explain":  "Explain what this code does in simple terms, step by step.",
        "optimize": "Suggest performance optimizations and refactoring improvements.",
        "security": "Identify security vulnerabilities, injection risks, and unsafe practices.",
        "test":     "Write unit test cases for this code covering happy path and edge cases.",
    }
    system_prompt = prompts.get(req.analysis_type, prompts["review"])
    lang = f" ({req.language})" if req.language != "auto-detect" else ""

    result = await _gemini(
        f"Code{lang}:\n```\n{req.code[:4000]}\n```\n\n{system_prompt}",
        "You are a senior software engineer. Be specific and actionable."
    )
    return {"analysis": result, "type": req.analysis_type, "language": req.language}


# ══════════════════════════════════════════════════════════════════════
#  CHART DATA GENERATOR
# ══════════════════════════════════════════════════════════════════════

class ChartRequest(BaseModel):
    description: str   # e.g. "monthly sales growth Q1-Q4 2024"
    chart_type: str = "bar"   # bar | line | pie | area

@router.post("/chart-data")
async def generate_chart_data(req: ChartRequest):
    result = await _gemini_json(
        f"Generate realistic chart data for: {req.description}\n"
        f"Chart type: {req.chart_type}\n"
        f"Return JSON with: title, labels (array), datasets (array of {{label, data, color}})",
        "You are a data visualization expert. Generate plausible, realistic data."
    )
    return {"chart_type": req.chart_type, "data": result}


# ══════════════════════════════════════════════════════════════════════
#  SWOT ANALYSIS
# ══════════════════════════════════════════════════════════════════════

class SWOTRequest(BaseModel):
    topic: str   # e.g. "Tesla entering the Indian market"
    context: Optional[str] = ""

@router.post("/swot")
async def generate_swot(req: SWOTRequest):
    ctx = f"\nContext: {req.context}" if req.context else ""
    result = await _gemini_json(
        f"Generate a SWOT analysis for: {req.topic}{ctx}\n"
        "Return JSON: {strengths: [...], weaknesses: [...], opportunities: [...], threats: [...]}. "
        "Each array has 3-5 concise string items.",
        "You are a strategic business analyst."
    )
    return {"topic": req.topic, "swot": result}


# ══════════════════════════════════════════════════════════════════════
#  PROS & CONS
# ══════════════════════════════════════════════════════════════════════

class ProsConsRequest(BaseModel):
    decision: str
    context: Optional[str] = ""

@router.post("/pros-cons")
async def pros_cons(req: ProsConsRequest):
    ctx = f"\nContext: {req.context}" if req.context else ""
    result = await _gemini_json(
        f"Analyze pros and cons for: {req.decision}{ctx}\n"
        "Return JSON: {pros: [{point, impact: high|medium|low}], cons: [{point, impact: high|medium|low}], recommendation: string}",
        "You are a critical thinking expert. Be balanced and thorough."
    )
    return {"decision": req.decision, "analysis": result}


# ══════════════════════════════════════════════════════════════════════
#  TIMELINE PARSER
# ══════════════════════════════════════════════════════════════════════

class TimelineRequest(BaseModel):
    text: str   # Text describing events to extract

@router.post("/timeline")
async def extract_timeline(req: TimelineRequest):
    result = await _gemini_json(
        f"Extract a timeline of events from this text:\n\n{req.text[:3000]}\n\n"
        "Return JSON: {events: [{date, title, description, type: milestone|event|deadline}]}",
        "You are a timeline extraction expert. Be precise with dates."
    )
    return {"timeline": result}


# ══════════════════════════════════════════════════════════════════════
#  INSIGHT GENERATOR (for chat text selection)
# ══════════════════════════════════════════════════════════════════════

class InsightRequest(BaseModel):
    selected_text: str
    context: Optional[str] = ""   # surrounding conversation context
    insight_type: str = "expand"  # expand | counterpoint | implications | questions | simplify

@router.post("/insight")
async def generate_insight(req: InsightRequest):
    prompts = {
        "expand":       "Expand on this idea with 3-4 additional insights and supporting points.",
        "counterpoint": "Provide 3 strong counterarguments or alternative perspectives.",
        "implications": "Analyze the short-term and long-term implications of this statement.",
        "questions":    "Generate 5 thought-provoking follow-up questions to explore this further.",
        "simplify":     "Explain this in simple terms a non-expert would understand.",
    }
    ctx = f"\nConversation context: {req.context[:500]}" if req.context else ""
    prompt_text = prompts.get(req.insight_type, prompts["expand"])

    result = await _gemini(
        f'Selected text: "{req.selected_text}"{ctx}\n\nTask: {prompt_text}',
        "You are an expert analyst. Be insightful, specific, and actionable."
    )
    return {"insight": result, "type": req.insight_type, "original": req.selected_text}


# ══════════════════════════════════════════════════════════════════════
#  TOOL CATALOG (for frontend)
# ══════════════════════════════════════════════════════════════════════

@router.get("/smart-tools/catalog")
async def tool_catalog():
    return {"tools": [
        {"id": "calculator",    "name": "Calculator",       "desc": "Safe math expression evaluator", "category": "utility", "tier": "free"},
        {"id": "weather",       "name": "Weather",          "desc": "Real-time weather by city",       "category": "data",    "tier": "free"},
        {"id": "currency",      "name": "Currency Exchange","desc": "Live exchange rate conversion",   "category": "finance", "tier": "free"},
        {"id": "summarizer",    "name": "Text Summarizer",  "desc": "AI-powered text summarization",  "category": "ai",      "tier": "pro"},
        {"id": "translator",    "name": "Translator",       "desc": "Multi-language translation",      "category": "ai",      "tier": "pro"},
        {"id": "code_analyzer", "name": "Code Analyzer",    "desc": "Review, explain, optimize code",  "category": "dev",     "tier": "pro"},
        {"id": "chart_generator","name": "Chart Generator", "desc": "Generate chart data from text",   "category": "visual",  "tier": "pro"},
        {"id": "swot",          "name": "SWOT Analysis",    "desc": "Strategic SWOT framework",        "category": "strategy","tier": "pro"},
        {"id": "pros_cons",     "name": "Pros & Cons",      "desc": "Decision analysis tool",          "category": "strategy","tier": "pro"},
        {"id": "timeline",      "name": "Timeline Extractor","desc": "Extract events from text",        "category": "analysis","tier": "pro"},
        {"id": "insight",       "name": "Insight Generator","desc": "Expand, challenge, or simplify text","category": "ai",   "tier": "pro"},
    ]}