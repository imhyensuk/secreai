"""
secreai — Backend Entry Point
Run: uvicorn main:app --reload --port 8000
"""

import os
import sys
import time
import uuid as _uuid
import traceback
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

# ── 디버깅: 환경 변수 검증 및 마스킹 출력 (Environment Validator) ──────────
def mask_key(k: str) -> str:
    """보안을 위해 API 키의 앞뒤 4자리만 보여줍니다."""
    if not k:
        return "❌ 누락됨 (NOT SET)"
    if len(k) > 10:
        return f"{k[:4]}" + "*" * (len(k) - 8) + f"{k[-4:]}"
    return "*" * len(k)

def validate_environment():
    """서버 시작 전 필수 환경 변수 로드 상태를 터미널에 상세히 출력합니다."""
    print("\n" + "="*60)
    print("🔍 환경 변수(.env) 로드 상태 검사 중...")
    
    keys = {
        "GOOGLE_AI_API_KEY": os.getenv("GOOGLE_AI_API_KEY"),
        "GROQ_API_KEY": os.getenv("GROQ_API_KEY"),
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_ANON_KEY": os.getenv("SUPABASE_ANON_KEY"),
        "MONGODB_URI": os.getenv("MONGODB_URI")
    }
    
    missing_keys = []
    for name, val in keys.items():
        masked = mask_key(val)
        status = "✅" if val else "❌"
        print(f"  [{status}] {name}: {masked}")
        if not val and name not in ["GOOGLE_AI_API_KEY", "GROQ_API_KEY"]:
            missing_keys.append(name)
            
    if not keys["GOOGLE_AI_API_KEY"] and not keys["GROQ_API_KEY"]:
        missing_keys.append("GOOGLE_AI_API_KEY 또는 GROQ_API_KEY (최소 1개 필요)")

    if missing_keys:
        print("\n🚨 [FATAL ERROR] 필수 환경 변수가 누락되었습니다!")
        for key in missing_keys:
            print(f"   - {key}")
        print("💡 해결 방법: 루트 디렉토리의 .env 파일을 확인하고 서버를 재시작하세요.")
        print("="*60 + "\n")
    else:
        print("\n✅ 모든 필수 환경 변수가 정상적으로 확인되었습니다.")
        print("="*60 + "\n")

# ── 라우터 및 모듈 임포트 ─────────────────────────────────────────────
from auth.supabase_auth import (
    router as auth_router,
    get_current_user,
    get_optional_user,
    TIERS,
)
from db.mongodb import get_db, ping_db
from tools.yfinance  import router as yfinance_router
from tools.serp      import router as serp_router
from tools.tavily    import router as tavily_router
from tools.news      import router as news_router
from tools.RSS       import router as rss_router
from tools.embedding import router as rag_router
from model.model     import router as model_router, run_agent_session


def _mongo_err(e: Exception) -> str:
    raw = str(e)
    if "bad auth" in raw or "authentication failed" in raw:
        return ("MongoDB auth failed. "
                "Fix: Atlas → Database Access → reset password → update MONGODB_URI in .env")
    if "timed out" in raw or "ServerSelection" in raw:
        return "MongoDB connection timed out. Atlas → Network Access → allow 0.0.0.0/0"
    return f"Database error: {raw[:200]}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_environment()
    try:
        mongo_status = await ping_db()
        if mongo_status.get("ok"):
            print("✅ MongoDB connected successfully.")
        else:
            print(f"❌ MongoDB connection failed: {mongo_status.get('error')}")
    except Exception as e:
        print(f"❌ MongoDB connection exception: {_mongo_err(e)}")
        traceback.print_exc()
    
    yield
    print("🛑 secreai stopped")


app = FastAPI(title="secreai API", version="2.3.1", lifespan=lifespan)

# ── 디버깅: 요청 로깅 미들웨어 ──────────────────────────────────────────
class DebugLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            if response.status_code >= 500:
                print(f"🔴 [ERR 5xx] {request.method} {request.url.path} - HTTP {response.status_code} ({process_time:.3f}s)")
            elif response.status_code >= 400:
                print(f"🟠 [WARN 4xx] {request.method} {request.url.path} - HTTP {response.status_code} ({process_time:.3f}s)")
            else:
                print(f"🟢 [OK] {request.method} {request.url.path} - HTTP {response.status_code} ({process_time:.3f}s)")
            return response
        except Exception as e:
            process_time = time.time() - start_time
            print(f"💥 [CRASH] {request.method} {request.url.path} - FAILED ({process_time:.3f}s)")
            raise e

app.add_middleware(DebugLoggingMiddleware)

# ── 디버깅: 글로벌 예외 처리기 ──────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("\n" + "!"*60)
    print(f"🔥 UNHANDLED EXCEPTION: {request.method} {request.url.path}")
    traceback.print_exc()
    print("!"*60 + "\n")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error. Please check the backend terminal logs.",
            "error_msg": str(exc)
        }
    )

# ── CORS configuration ───────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173",
                   os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────
app.include_router(auth_router,     prefix="/api/auth",  tags=["Auth"])
app.include_router(yfinance_router, prefix="/api/tools", tags=["Tools"])
app.include_router(serp_router,     prefix="/api/tools", tags=["Tools"])
app.include_router(tavily_router,   prefix="/api/tools", tags=["Tools"])
app.include_router(news_router,     prefix="/api/tools", tags=["Tools"])
app.include_router(rss_router,      prefix="/api/tools", tags=["Tools"])
app.include_router(rag_router,      prefix="/api/tools", tags=["RAG"])
app.include_router(model_router,    prefix="/api/model", tags=["Model"])


@app.get("/api/health")
async def health():
    mongo = await ping_db()
    return {
        "status": "ok" if mongo.get("ok") else "degraded",
        "gemini":   bool(os.getenv("GOOGLE_AI_API_KEY")),
        "groq":     bool(os.getenv("GROQ_API_KEY")),
        "supabase": bool(os.getenv("SUPABASE_URL")),
        "mongodb":  mongo,
    }


# ── User data ─────────────────────────────────────────────────────────
@app.get("/api/user/data")
async def get_user_data(current_user: dict = Depends(get_current_user)):
    db  = get_db()
    uid = current_user["id"]
    try:
        sessions = await db.sessions.find(
            {"userId": uid, "_deleted": {"$ne": True}}, {"chunks": 0}
        ).sort("created_at", -1).to_list(200)
        files = await db.files.find({"userId": uid}).sort("created_at", -1).to_list(500)
    except Exception as e:
        print(f"⚠️  user/data DB error: {_mongo_err(e)}")
        traceback.print_exc()
        sessions, files = [], []

    def _clean(docs):
        out = []
        for d in docs:
            _id_str = str(d.pop("_id", ""))
            # ✅ 핵심 수정: 기존에 커스텀 id가 있다면 보존하고 없으면 _id를 할당 (프론트엔드-백엔드 id 매칭 불량 해결)
            d["id"] = d.get("id") or _id_str
            for k in ("created_at", "updated_at"):
                if isinstance(d.get(k), datetime):
                    d[k] = d[k].isoformat()
            out.append(d)
        return out

    return {
        "sessions":  _clean(sessions),
        "files":     _clean(files),
        "tier":      current_user["tier"],
        "tier_data": current_user["tier_data"],
    }


class SessionSaveReq(BaseModel):
    session: dict


@app.post("/api/user/sessions")
async def save_session(req: SessionSaveReq, current_user: dict = Depends(get_current_user)):
    db = get_db()
    s  = req.session.copy()
    s["userId"]     = current_user["id"]
    s["updated_at"] = datetime.utcnow()
    s.setdefault("created_at", datetime.utcnow())
    try:
        sid = s.get("id")
        if sid:
            await db.sessions.replace_one({"id": sid, "userId": current_user["id"]}, s, upsert=True)
        else:
            await db.sessions.insert_one(s)
    except Exception as e:
        print(f"⚠️  save_session error: {_mongo_err(e)}")
        traceback.print_exc()
    return {"ok": True}


@app.delete("/api/user/sessions/{session_id}")
async def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        # ✅ 커스텀 id 또는 (만약에 대비해) MongoDB ObjectId 기반으로 모두 삭제 가능하도록 쿼리 강화
        query = {"userId": current_user["id"], "$or": [{"id": session_id}]}
        if len(session_id) == 24:
            try:
                query["$or"].append({"_id": ObjectId(session_id)})
            except Exception:
                pass
        await db.sessions.delete_one(query)
    except Exception as e:
        print(f"⚠️  delete_session error: {_mongo_err(e)}")
        traceback.print_exc()
    return {"ok": True}


@app.post("/api/user/files")
async def save_file(payload: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    f  = payload.get("file", {})
    f["userId"]     = current_user["id"]
    f["created_at"] = datetime.utcnow()
    try:
        await db.files.insert_one(f)
    except Exception as e:
        print(f"⚠️  save_file error: {_mongo_err(e)}")
        traceback.print_exc()
    return {"ok": True}


@app.patch("/api/user/tools")
async def update_tools(payload: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        await db.user_settings.replace_one(
            {"userId": current_user["id"]},
            {"userId": current_user["id"],
             "enabled_tools": payload.get("enabled_tools", []),
             "updated_at":    datetime.utcnow()},
            upsert=True,
        )
    except Exception as e:
        print(f"⚠️  update_tools error: {_mongo_err(e)}")
        traceback.print_exc()
    return {"ok": True}


@app.get("/api/user/settings")
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = None
    try:
        doc = await db.user_settings.find_one({"userId": current_user["id"]})
    except Exception as e:
        print(f"⚠️  user_settings error: {_mongo_err(e)}")
        traceback.print_exc()

    tier_tools    = current_user["tier_data"].get("tools", [])
    default_tools = (tier_tools if tier_tools != "__all__" else
                     ["web_search","tavily","wikipedia","news_api","rss","yfinance",
                      "python","file_read","file_write","perm_network","rag"])
    return {
        "enabled_tools": doc.get("enabled_tools", default_tools) if doc else default_tools,
        "tier":      current_user["tier"],
        "tier_data": current_user["tier_data"],
    }


# ── Contact ───────────────────────────────────────────────────────────
class ContactReq(BaseModel):
    name: str
    email: str
    topic: str
    message: str


@app.post("/api/contact")
async def submit_contact(req: ContactReq, current_user: Optional[dict] = Depends(get_optional_user)):
    db = get_db()
    try:
        await db.contact.insert_one({
            "userId":     current_user["id"] if current_user else None,
            "name":       req.name,
            "email":      req.email,
            "topic":      req.topic,
            "message":    req.message,
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        print(f"⚠️  contact insert error: {_mongo_err(e)}")
        traceback.print_exc()
    return {"ok": True, "message": "Message received. We'll reply within 24 hours."}


# ── Analytics (fire-and-forget) ───────────────────────────────────────
@app.post("/api/analytics")
async def track_event(payload: dict, current_user: Optional[dict] = Depends(get_optional_user)):
    db = get_db()
    try:
        await db.analytics.insert_one({
            "userId":     current_user["id"] if current_user else None,
            "event":      payload.get("event"),
            "properties": payload.get("properties", {}),
            "timestamp":  datetime.utcnow(),
        })
    except Exception:
        pass
    return {"ok": True}


# ── Sharing ───────────────────────────────────────────────────────────
class ShareReq(BaseModel):
    resource_type: str
    resource_id: str
    title: str
    data: dict


@app.post("/api/share/create")
async def create_share(req: ShareReq, current_user: dict = Depends(get_current_user)):
    db    = get_db()
    token = str(_uuid.uuid4()).replace("-", "")[:20]
    url   = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/share/{token}"
    try:
        await db.shares.insert_one({
            "token": token, "resource_type": req.resource_type,
            "resource_id": req.resource_id, "title": req.title,
            "data": req.data, "userId": current_user["id"],
            "created_at": datetime.utcnow(), "view_count": 0,
        })
    except Exception as e:
        print("⚠️ share error:")
        traceback.print_exc()
        raise HTTPException(503, _mongo_err(e))
    return {"token": token, "url": url, "title": req.title}


@app.get("/api/share/{token}")
async def get_share(token: str):
    db = get_db()
    try:
        doc = await db.shares.find_one({"token": token})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(503, _mongo_err(e))
    if not doc:
        raise HTTPException(404, "Share link not found.")
    try:
        await db.shares.update_one({"token": token}, {"$inc": {"view_count": 1}})
    except Exception:
        pass
    doc.pop("_id", None)
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


# ── Chat ──────────────────────────────────────────────────────────────
class ChatReq(BaseModel):
    session_id: str
    message: str
    active_agents: List[str]
    enabled_tools: List[str]
    history: Optional[List[dict]] = []
    provider: Optional[str] = "auto"
    rag_context: Optional[str] = None


@app.post("/api/chat")
async def chat(req: ChatReq, current_user: dict = Depends(get_current_user)):
    tier      = current_user["tier"]
    tier_data = current_user["tier_data"]

    allowed_roles = tier_data.get("roles", [])
    valid_agents  = [a for a in req.active_agents if a in allowed_roles]
    if not valid_agents:
        raise HTTPException(403,
            f"No permitted agents for tier '{tier}'. "
            f"Allowed: {allowed_roles}. Upgrade your plan to access more roles.")

    allowed_tools = tier_data.get("tools", [])
    permitted = (set(req.enabled_tools) if allowed_tools == "__all__"
                 else set(req.enabled_tools) & set(allowed_tools))

    try:
        result = await run_agent_session(
            message=req.message, agents=valid_agents,
            enabled_tools=permitted, history=req.history or [],
            tier=tier, provider=req.provider or "auto",
            rag_context=req.rag_context,
        )
    except Exception as e:
        print("\n🔥 [CHAT ENDPOINT ERROR]")
        traceback.print_exc()
        raise HTTPException(500, f"Error processing chat: {str(e)}")

    db = get_db()
    try:
        await db.analytics.insert_one({
            "userId":     current_user["id"],
            "event":      "chat_message",
            "properties": {"session_id": req.session_id, "agents": valid_agents, "tier": tier},
            "timestamp":  datetime.utcnow(),
        })
    except Exception:
        pass

    return {"responses": result, "session_id": req.session_id, "tier": tier}


@app.post("/api/tools/check-permission")
async def check_permission(payload: dict, current_user: dict = Depends(get_current_user)):
    td    = current_user["tier_data"]
    tools = td.get("tools", [])
    tid   = payload.get("tool_id", "")
    ok    = tools == "__all__" or tid in tools
    return {"tool_id": tid, "allowed": ok, "tier": current_user["tier"]}


if __name__ == "__main__":
    import uvicorn
    # ✅ 환경 변수 PORT를 읽어와 바인딩 (Render와 같은 클라우드 배포용)
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)