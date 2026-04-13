"""
secreai — Model Orchestration
Uses httpx to call Google AI Studio and Groq APIs directly.
No google-generativeai library dependency for chat — avoids v1beta 404 errors.

Auto-discovery: tries models in priority order until one succeeds.
Each agent runs as a separate, independent API call with isolated memory.
"""

import os
import json
import asyncio
import re
from pathlib import Path
from typing import List, Set, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

GOOGLE_AI_KEY = os.getenv("GOOGLE_AI_API_KEY", "")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
AI_PROVIDER   = os.getenv("AI_PROVIDER", "auto")

# Google AI REST base URL
GEMINI_BASE = "https://generativelanguage.googleapis.com"

# ── Model priority list (tried in order until one works) ──────────────
GEMINI_MODELS_PRIORITY = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-002",
    "gemini-1.5-pro",
]

TIER_MODELS = {
    "free":    {"gemini": "gemini-2.0-flash",        "groq": "llama-3.1-8b-instant"},
    "pro":     {"gemini": "gemini-2.0-flash",        "groq": "llama-3.1-8b-instant"},
    "ultra":   {"gemini": "gemini-2.0-flash",        "groq": "llama-3.1-8b-instant"},
    "student": {"gemini": "gemini-2.0-flash",        "groq": "llama-3.1-8b-instant"},
}
DEFAULT_MODEL = {"gemini": "gemini-2.0-flash", "groq": "llama-3.1-8b-instant"}

_working_gemini_model: Optional[str] = None

# ── Load prompts ──────────────────────────────────────────────────────
_PROMPT_PATH = Path(__file__).parent / "prompt.json"
with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
    _PROMPTS: dict = json.load(f)

BASE_INSTRUCTIONS = _PROMPTS["_meta"]["base_instructions"]

def get_system_prompt(role: str) -> str:
    data = _PROMPTS.get(role)
    return data["system_prompt"] if data else BASE_INSTRUCTIONS


# ── Tool context ──────────────────────────────────────────────────────
_TOOL_LABELS = {
    "web_search":   "Web Search (SerpAPI)",
    "tavily":       "Tavily AI Search",
    "news_api":     "News API",
    "rss":          "RSS Feed Reader",
    "yfinance":     "Yahoo Finance",
    "python":       "Python Executor",
    "file_read":    "File Reader",
    "rag":          "RAG Knowledge Base",
    "perm_network": "Outbound Network Access",
}

def build_tool_context(enabled_tools: Set[str]) -> str:
    lines = [_TOOL_LABELS[t] for t in enabled_tools if t in _TOOL_LABELS]
    if not lines:
        return ""
    return (
        "\n\n[CRITICAL: TOOLS AVAILABLE TO YOU]\n"
        + "\n".join(f"  • {l} (id: {t})" for t, l in _TOOL_LABELS.items() if t in enabled_tools)
        + "\n\nIf you need real-time data, search results, news, or financial data to fulfill the user's request, YOU MUST USE A TOOL."
        + "\nTo use a tool, you must output EXACTLY this JSON block and NOTHING ELSE in your response:"
        + "\n<TOOL_CALL>{\"tool\": \"tool_id\", \"query\": \"search query\"}</TOOL_CALL>"
        + "\n\nExample: <TOOL_CALL>{\"tool\": \"web_search\", \"query\": \"weather in Seoul\"}</TOOL_CALL>"
        + "\n\nThe system will intercept this and return the [TOOL RESULT]. Wait for the result before giving your final analysis. Do NOT fake or hallucinate tool outputs."
    )


# ════════════════════════════════════════════════════════════════════
#  Tool Execution Helper
# ════════════════════════════════════════════════════════════════════
async def execute_tool_via_http(tool_id: str, query: str, enabled_tools: set, role: str = None, rag_config: dict = None) -> str:
    # ✅ 포트 동적 할당: Render 클라우드 환경에서 부여한 포트를 가져와 로컬 API에 요청을 보냅니다.
    port = os.getenv("PORT", "8000")
    base_url = f"http://127.0.0.1:{port}/api/tools"
    
    payload = {"query": query, "enabled_tools": list(enabled_tools)}
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            if tool_id in ["web_search", "serp", "search"]:
                resp = await client.post(f"{base_url}/serp/search", json=payload)
            elif tool_id == "news_api":
                resp = await client.post(f"{base_url}/news/headlines", json=payload)
            elif tool_id == "yfinance":
                payload["ticker"] = query
                resp = await client.post(f"{base_url}/yfinance/info", json=payload)
            elif tool_id == "rss":
                payload["url"] = query
                resp = await client.post(f"{base_url}/rss/fetch", json=payload)
            elif tool_id == "tavily":
                resp = await client.post(f"{base_url}/tavily/search", json=payload)
            elif tool_id == "rag":
                if not rag_config:
                    return "System Note: RAG config is missing. Cannot search knowledge base."
                user_id = rag_config.get("userId")
                if not user_id:
                    return "System Note: userId is missing for RAG."
                
                doc_ids = rag_config.get("docMap", {}).get(role, [])
                rag_payload = {"query": query, "userId": user_id, "topK": 3}
                if isinstance(doc_ids, list) and len(doc_ids) > 0:
                    rag_payload["docIds"] = doc_ids
                    
                resp = await client.post(f"{base_url}/rag/query", json=rag_payload)
            else:
                return f"System Note: Tool '{tool_id}' is not mapped for backend execution."
            
            if resp.status_code == 200:
                data = resp.json()
                res_str = json.dumps(data, ensure_ascii=False)
                return res_str[:3000] + ("..." if len(res_str) > 3000 else "")
            else:
                return f"Tool API Error {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return f"Tool Execution Exception: {str(e)}"


# ════════════════════════════════════════════════════════════════════
#  GEMINI — Direct REST API via httpx
# ════════════════════════════════════════════════════════════════════

def _build_gemini_payload(system: str, messages: list) -> dict:
    contents = []
    
    if system:
        contents.append({
            "role": "user", 
            "parts": [{"text": f"SYSTEM INSTRUCTIONS (Strictly follow these):\n{system}\n\nDo you understand?"}]
        })
        contents.append({
            "role": "model", 
            "parts": [{"text": "Understood. I will strictly follow these system instructions and adopt the specified role."}]
        })

    for m in messages:
        role = "user" if m.get("role") == "user" else "model"
        text = m.get("content", "").strip()
        if not text:
            text = " "
        
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += f"\n\n{text}"
        else:
            contents.append({"role": role, "parts": [{"text": text}]})

    if contents and contents[-1]["role"] != "user":
        contents.append({"role": "user", "parts": [{"text": "Please continue or address the above."}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.75,
            "maxOutputTokens": 1024,
            "topP": 0.9,
        },
    }
    
    return payload


async def _call_gemini_model(
    model_name: str,
    payload: dict,
    client: httpx.AsyncClient,
    api_version: str = "v1beta",
) -> tuple[str, int]:
    url = f"{GEMINI_BASE}/{api_version}/models/{model_name}:generateContent"
    resp = await client.post(url, json=payload, params={"key": GOOGLE_AI_KEY}, timeout=60.0)

    if resp.status_code == 200:
        data = resp.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return text.strip(), 200
        except (KeyError, IndexError) as e:
            return f"[Gemini response parse error: {e}]", 200

    return resp.text[:400], resp.status_code


async def _discover_working_gemini_model(client: httpx.AsyncClient) -> Optional[str]:
    global _working_gemini_model
    if _working_gemini_model:
        return _working_gemini_model

    test_payload = _build_gemini_payload("You are a test assistant.", [{"role": "user", "content": "hi"}])

    for api_version in ["v1beta", "v1"]:
        for model in GEMINI_MODELS_PRIORITY:
            _, status = await _call_gemini_model(model, test_payload, client, api_version)
            if status == 200:
                _working_gemini_model = model
                print(f"   ✅ Gemini working model found: {model} (API: {api_version})")
                return model
            elif status == 429:
                print("   🚫 Gemini Quota Exceeded (429). Stopping discovery.")
                return None
            elif status == 404:
                continue

    return None


async def _call_gemini(role: str, system: str, messages: list, preferred_model: str, retries: int = 1) -> dict:
    if not GOOGLE_AI_KEY:
        return {"agent": role, "content": "[Gemini error] GOOGLE_AI_API_KEY not set in .env", "error": True}

    payload = _build_gemini_payload(system, messages)
    last_err = ""

    for attempt in range(retries + 1):
        async with httpx.AsyncClient(timeout=60.0) as client:
            for api_version in ["v1beta", "v1"]:
                text, status = await _call_gemini_model(preferred_model, payload, client, api_version)
                if status == 200:
                    return {"agent": role, "content": text, "model": preferred_model, "provider": "gemini", "error": False}
                
                if status == 429:
                    if attempt < retries:
                        print(f"⚠️ Gemini 429 Rate Limit. Retrying in 6s (Attempt {attempt+1}/{retries})")
                        await asyncio.sleep(6.0)
                        break
                    else:
                        return {
                            "agent": role,
                            "content": "⚠️ **[Gemini 할당량 초과]** 무료 할당량을 소진했습니다. 사이드바에서 모델을 Groq으로 변경해주세요.",
                            "error": True,
                            "status_code": 429
                        }
                last_err = f"HTTP {status}: {text}"

            if status != 429:
                print(f"   ⚠️  {preferred_model} failed ({last_err}), discovering available model...")
                working = await _discover_working_gemini_model(client)
                if working and working != preferred_model:
                    text, status = await _call_gemini_model(working, payload, client, "v1beta")
                    if status == 200:
                        return {"agent": role, "content": text, "model": working, "provider": "gemini", "error": False}

    return {"agent": role, "content": f"[Gemini error] Model failed. Details: {last_err}", "error": True}


# ════════════════════════════════════════════════════════════════════
#  GROQ — REST API via httpx
# ════════════════════════════════════════════════════════════════════

async def _call_groq(role: str, system: str, messages: list, model_name: str, retries: int = 2) -> dict:
    if not GROQ_API_KEY:
        return {"agent": role, "content": "[Groq error] GROQ_API_KEY not set in .env", "error": True}

    groq_messages = [{"role": "system", "content": system}] + messages
    payload = {
        "model":       model_name,
        "messages":    groq_messages,
        "temperature": 0.75,
        "max_tokens":  1024,
    }

    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type":  "application/json",
                    },
                )
            
            if resp.status_code == 200:
                text = resp.json()["choices"][0]["message"]["content"].strip()
                return {"agent": role, "content": text, "model": model_name, "provider": "groq", "error": False}
            
            if resp.status_code == 429:
                if attempt < retries:
                    retry_after = float(resp.headers.get("retry-after", 6.0))
                    retry_after = min(retry_after, 15.0) 
                    print(f"⚠️ Groq 429 Rate Limit. Retrying in {retry_after}s (Attempt {attempt+1}/{retries})")
                    await asyncio.sleep(retry_after)
                    continue
                else:
                    return {
                        "agent": role,
                        "content": "⚠️ **[Groq 요청 한도 초과]** 현재 무료 API 한도에 도달했습니다. 잠시 후 다시 시도하거나 사이드바에서 Provider를 Gemini로 변경해주세요.",
                        "error": True,
                        "status_code": 429
                    }

            err = resp.json().get("error", {}).get("message", resp.text[:200])
            if "model" in err.lower() and ("not found" in err.lower() or "decommissioned" in err.lower()):
                fallback = "llama-3.1-8b-instant"
                if model_name != fallback:
                    return await _call_groq(role, system, messages, fallback, retries=0)
            return {"agent": role, "content": f"[Groq error] {err}", "error": True}

        except Exception as e:
            if attempt < retries:
                await asyncio.sleep(3.0)
                continue
            return {"agent": role, "content": f"[Groq error] {e}", "error": True}


# ── Model resolver ────────────────────────────────────────────────────
def resolve_model(tier: str, preferred_provider: str = "auto") -> tuple[str, str]:
    models = TIER_MODELS.get(tier, DEFAULT_MODEL)
    if preferred_provider == "gemini" or (preferred_provider == "auto" and GOOGLE_AI_KEY):
        return "gemini", models["gemini"]
    elif preferred_provider == "groq" or (preferred_provider == "auto" and GROQ_API_KEY):
        return "groq", models["groq"]
    elif GOOGLE_AI_KEY:
        return "gemini", models["gemini"]
    raise HTTPException(503, "No AI provider configured. Set GOOGLE_AI_API_KEY or GROQ_API_KEY in .env")


def _build_agent_messages(role: str, history: list, new_message: str) -> list:
    raw_msgs = []
    MAX_CHARS = 5000 
    
    if len(history) > 0:
        raw_msgs.append({"role": "user", "content": history[0].get("content", "")})
        
    recent_history = []
    current_chars = len(new_message)
    
    for h in reversed(history[1:]):
        content = h.get("content", "")
        if current_chars + len(content) > MAX_CHARS:
            break
        recent_history.insert(0, h)
        current_chars += len(content)

    for h in recent_history:
        h_type = h.get("type")
        h_role = h.get("role", "")
        content = h.get("content", "")
        
        if h_type in ["user", "system"]:
            raw_msgs.append({"role": "user", "content": content})
        elif h_type == "agent":
            if h_role == role:
                raw_msgs.append({"role": "assistant", "content": content})
            else:
                raw_msgs.append({"role": "user", "content": f"[{h_role} 전문가의 의견]:\n{content}"})
                
    raw_msgs.append({"role": "user", "content": new_message})
    
    collapsed_msgs = []
    for msg in raw_msgs:
        if not collapsed_msgs:
            collapsed_msgs.append(msg)
        elif collapsed_msgs[-1]["role"] == msg["role"]:
            collapsed_msgs[-1]["content"] += f"\n\n{msg['content']}"
        else:
            collapsed_msgs.append(msg)
            
    return collapsed_msgs


# ── Core parallel runner ──────────────────────────────────────────────
async def run_agent_session(
    message: str,
    agents: List[str],
    enabled_tools: Set[str],
    history: List[dict],
    tier: str = "free",
    provider: str = "auto",
    rag_context: Optional[str] = None,
    stream: bool = False,
) -> list:
    rag_config = {}
    parsed_rag_text = ""
    
    if rag_context:
        if rag_context.strip().startswith("{"):
            try:
                rag_config = json.loads(rag_context)
            except json.JSONDecodeError:
                parsed_rag_text = rag_context
        else:
            parsed_rag_text = rag_context

    tool_ctx = build_tool_context(enabled_tools)
    rag_ctx  = (
        f"\n\n[KNOWLEDGE BASE CONTEXT]\n{parsed_rag_text}\n[END]\nUse where relevant."
        if parsed_rag_text else ""
    )

    display_message = message
    action_type = None
    target_text = None
    
    if message.strip().startswith("{") and "actionType" in message:
        try:
            payload = json.loads(message)
            display_message = payload.get("text", message)
            action_type = payload.get("actionType")
            target_text = payload.get("targetText")
        except json.JSONDecodeError:
            pass

    # ✅ 백엔드 지시문을 자연스러운 한국어 지침으로 변경
    base_prompt_modifier = ""
    if action_type == "elaborate":
        base_prompt_modifier = f"\n\n(참고: 사용자가 당신이 아까 말했던 \"{target_text}\" 부분에 대해 더 자세한 설명을 원합니다. '물론입니다' 같은 AI 말투를 빼고 자연스럽게 부연 설명하세요. 이 지시문 자체를 화면에 출력하면 안 됩니다.)"
    elif action_type == "summarize":
        base_prompt_modifier = f"\n\n(참고: 당신의 이전 발언 중 \"{target_text}\" 부분의 핵심만 요약해주세요. '요약:' 같은 소제목을 달지 말고 사람처럼 말하세요.)"
    elif action_type == "auto_start":
        base_prompt_modifier = "\n\n(참고: 회의가 시작되었습니다. '<SYSTEM DIRECTIVE>'나 'Initial Analysis:' 같은 제목이나 시스템 텍스트를 절.대. 화면에 출력하지 마세요. 바로 사람처럼 자연스럽게 첫 의견을 이야기하세요.)"
    elif action_type == "auto_continue":
        base_prompt_modifier = "\n\n(참고: 앞선 동료들의 의견을 듣고, 무조건 동의하지 말고 당신의 역할에 맞춰 날카로운 통찰이나 반박을 덧붙여 대화를 이어가세요. 소제목이나 시스템 태그를 출력하지 마세요.)"
    elif action_type == "auto_resume":
        base_prompt_modifier = "\n\n(참고: 멈췄던 회의가 재개되었습니다. 이전 흐름을 이어받아 자연스럽게 다음 논의를 이끌어가세요. 기계처럼 말하지 마세요.)"
    
    final_message = display_message + base_prompt_modifier

    agent_providers = {}
    if provider and provider.startswith("{"):
        try:
            agent_providers = json.loads(provider)
        except json.JSONDecodeError:
            pass

    from auth.supabase_auth import TIERS
    max_agents = TIERS.get(tier, TIERS["free"]).get("max_agents", 2)
    active = agents[:max_agents]

    async def call_one(role: str) -> dict:
        system = get_system_prompt(role) + tool_ctx + rag_ctx
        msgs   = _build_agent_messages(role, history, final_message)
        
        agent_prov = agent_providers.get(role, provider if not provider.startswith("{") else "auto")
        resolved_provider, model_name = resolve_model(tier, agent_prov)
        
        max_turns = 3
        for turn in range(max_turns):
            if resolved_provider == "gemini":
                res = await _call_gemini(role, system, msgs, model_name)
                if res.get("status_code") == 429 and agent_prov == "auto" and GROQ_API_KEY:
                    print(f"🔄 Auto-fallback to Groq for {role} due to Gemini 429...")
                    resolved_provider, model_name = resolve_model(tier, "groq")
                    res = await _call_groq(role, system, msgs, model_name)
            else:
                res = await _call_groq(role, system, msgs, model_name)
                if res.get("status_code") == 429 and agent_prov == "auto" and GOOGLE_AI_KEY:
                    print(f"🔄 Auto-fallback to Gemini for {role} due to Groq 429...")
                    resolved_provider, model_name = resolve_model(tier, "gemini")
                    res = await _call_gemini(role, system, msgs, model_name)

            if res.get("error"):
                return res

            content = res.get("content", "")

            match = re.search(r'<TOOL_CALL>(.*?)</TOOL_CALL>', content, re.DOTALL | re.IGNORECASE)
            if match:
                try:
                    raw_json = match.group(1).replace('```json', '').replace('```', '').strip()
                    tool_data = json.loads(raw_json)
                    t_id = tool_data.get("tool")
                    t_query = tool_data.get("query")
                    
                    print(f"🛠️ [TOOL] {role} calling {t_id} with '{t_query}'")
                    t_result = await execute_tool_via_http(t_id, t_query, enabled_tools, role, rag_config)
                    
                    msgs.append({"role": "model" if resolved_provider == "gemini" else "assistant", "content": content})
                    
                    # ✅ 데이터 에코잉 원천 차단을 위한 시스템 프롬프트 주입
                    msgs.append({
                        "role": "user", 
                        "content": (
                            f"[SYSTEM: TOOL RESULT from {t_id}]\n"
                            f"{t_result}\n\n"
                            f"=== [CRITICAL INSTRUCTIONS] ===\n"
                            f"1. DO NOT output, copy, or repeat the raw JSON data in your response under any circumstances.\n"
                            f"2. Read the data silently, extract only the key numbers, trends, or insights.\n"
                            f"3. Respond naturally in Korean, strictly keeping your expert persona tone.\n"
                            f"4. Do NOT make another tool call. Provide your final synthesized answer now."
                        )
                    })
                    continue
                except Exception as e:
                    msgs.append({"role": "model" if resolved_provider == "gemini" else "assistant", "content": content})
                    msgs.append({"role": "user", "content": f"[TOOL PARSE ERROR]: {e}\nIgnore the tool and answer based on your knowledge."})
                    continue

            return res
            
        return {"agent": role, "content": content, "error": False}

    results = await asyncio.gather(*[call_one(r) for r in active], return_exceptions=False)
    return list(results)


# ── FastAPI endpoints ─────────────────────────────────────────────────
class ModelRequest(BaseModel):
    message: str
    agent_role: str = "STRATEGY"
    enabled_tools: List[str] = []
    history: Optional[List[dict]] = []
    tier: str = "free"
    provider: str = "auto"
    rag_context: Optional[str] = None


@router.post("/run")
async def run_single_agent(req: ModelRequest):
    result = await run_agent_session(
        message=req.message, agents=[req.agent_role],
        enabled_tools=set(req.enabled_tools), history=req.history or [],
        tier=req.tier, provider=req.provider, rag_context=req.rag_context,
    )
    return {"agent": req.agent_role, "response": result[0] if result else {}}


@router.get("/agents")
async def list_agents():
    return {"agents": [
        {"id": k, "role": v["role"], "preview": v["system_prompt"][:120] + "..."}
        for k, v in _PROMPTS.items() if k != "_meta"
    ]}


@router.get("/available-models")
async def available_models():
    if not GOOGLE_AI_KEY:
        return {"error": "GOOGLE_AI_API_KEY not set"}

    working = []
    test_payload = _build_gemini_payload(
        "You are a test assistant.",
        [{"role": "user", "content": "Reply with just: ok"}]
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        for api_version in ["v1beta", "v1"]:
            for model in GEMINI_MODELS_PRIORITY:
                _, status = await _call_gemini_model(model, test_payload, client, api_version)
                if status == 200:
                    working.append({"model": model, "api_version": api_version})
                elif status == 429:
                    break

    return {
        "api_key_set": True,
        "working_models": working,
        "recommended": working[0] if working else None,
    }


@router.get("/providers")
async def list_providers():
    return {
        "gemini": {"available": bool(GOOGLE_AI_KEY), "models": GEMINI_MODELS_PRIORITY[:4]},
        "groq":   {"available": bool(GROQ_API_KEY)},
        "tier_models": TIER_MODELS,
    }


@router.get("/health")
async def model_health():
    return {
        "gemini_key_set": bool(GOOGLE_AI_KEY),
        "groq_key_set":   bool(GROQ_API_KEY),
        "cached_model":   _working_gemini_model,
        "note":           "Visit /api/model/available-models to discover working models",
    }