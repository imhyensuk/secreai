"""
secreai — Supabase Auth + RBAC (Auto-Confirm Version)

KEY FIX: 
1. Uses Admin API (create_user) to set 'email_confirm: True' immediately.
2. Skips confirmation email flow entirely.
3. Automatically signs in the user after creation to return a session.
"""

import os
from datetime import datetime
from typing import Optional

import httpx
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SUPABASE_URL     = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON    = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
JWT_SECRET       = os.getenv("SUPABASE_JWT_SECRET", "")

_jwt_warned = False

# ✅ 새로운 전문가(Expert) 직군 7종이 포함된 전체 리스트
ALL_ROLES = [
    # Business & Tech
    "DATA_ANALYSIS", "RESEARCH", "STRATEGY", "FINANCE", "MARKETING",
    "OPERATIONS", "LEGAL", "HUMAN_RESOURCES", "ENGINEERING", "PRODUCT",
    "SALES", "RISK", "COMMUNICATIONS", "DESIGN", "QUALITY",
    # Education & Academia
    "PROFESSOR", "TEACHER", "STUDENT", 
    # Society & Everyday
    "PARENT", "WORKER", "ENTREPRENEUR", "POLICE"
]

TIERS: dict = {
    "free": {
        "label": "Free",
        "models": {"gemini": ["gemini-2.0-flash"], "groq": ["llama-3.1-8b-instant"]},
        "max_agents": 2, "max_sessions": 3, "max_messages_per_session": 50,
        "tools": ["web_search", "wikipedia", "file_read", "perm_network",
                  "calculator", "weather", "currency"],
        "roles": ["DATA_ANALYSIS", "RESEARCH", "STRATEGY", "RISK", "ENGINEERING", "PROFESSOR", "TEACHER", "STUDENT", "PARENT", "WORKER", "ENTREPRENEUR"],
        "rag": False, "workspace": 1, "storage_mb": 100,
    },
    "pro": {
        "label": "Pro",
        "models": {"gemini": ["gemini-2.0-flash", "gemini-1.5-flash"],
                   "groq":   ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"]},
        "max_agents": 5, "max_sessions": None, "max_messages_per_session": None,
        "tools": ["web_search", "tavily", "wikipedia", "news_api", "rss", "yfinance",
                  "python", "file_read", "file_write", "perm_network", "rag",
                  "calculator", "weather", "currency", "summarizer", "translator",
                  "code_analyzer", "chart_generator", "swot", "pros_cons", "timeline", "insight"],
        "roles": ALL_ROLES, "rag": True, "workspace": None, "storage_mb": 10240,
    },
    "ultra": {
        "label": "Ultra",
        "models": {"gemini": ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
                   "groq":   ["llama-3.1-8b-instant", "llama-3.1-70b-versatile",
                              "llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"]},
        "max_agents": 15, "max_sessions": None, "max_messages_per_session": None,
        "tools": "__all__", "roles": ALL_ROLES, "rag": True, "workspace": None, "storage_mb": None,
    },
    "student": {
        "label": "Student",
        "models": {"gemini": ["gemini-2.0-flash", "gemini-1.5-flash"],
                   "groq":   ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"]},
        "max_agents": 4, "max_sessions": 10, "max_messages_per_session": 200,
        "tools": ["web_search", "tavily", "wikipedia", "news_api", "rss", "python",
                  "file_read", "file_write", "perm_network", "rag",
                  "calculator", "weather", "currency", "summarizer", "translator"],
        "roles": ALL_ROLES, "rag": True, "workspace": 5, "storage_mb": 2048,
    },
    "all-rounder": {
        "label": "All-Rounder",
        "models": {"gemini": ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
                   "groq":   ["llama-3.1-8b-instant", "llama-3.1-70b-versatile",
                              "llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"]},
        "max_agents": 42, "max_sessions": None, "max_messages_per_session": None,
        "tools": "__all__", "roles": ALL_ROLES, "rag": True, "workspace": None, "storage_mb": None,
    },
}

_anon_client = None
_service_client = None


def get_anon_client():
    global _anon_client
    if _anon_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON or len(SUPABASE_ANON) < 20:
            raise HTTPException(503, "Supabase not configured — set SUPABASE_URL and SUPABASE_ANON_KEY in .env")
        from supabase import create_client
        _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON)
    return _anon_client


def get_service_client():
    global _service_client
    if _service_client is None:
        from supabase import create_client
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE)
    return _service_client


# ── JWT verification ─────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

def _verify_jwt_local(token: str) -> dict | None:
    global _jwt_warned
    if not JWT_SECRET or len(JWT_SECRET) < 10:
        return None
    for opts in [
        {"algorithms": ["HS256"], "audience": "authenticated"},
        {"algorithms": ["HS256"], "options": {"verify_aud": False}},
    ]:
        try:
            return pyjwt.decode(token, JWT_SECRET, **opts)
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(401, "Session expired. Please log in again.")
        except (pyjwt.InvalidAudienceError, pyjwt.InvalidTokenError):
            continue
    return None

async def _verify_via_api(token: str) -> dict | None:
    if not SUPABASE_URL or not SUPABASE_ANON:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        print(f"⚠️  Supabase API fallback error: {e}")
    return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    if not credentials:
        raise HTTPException(401, "Not authenticated.")
    token = credentials.credentials
    payload = _verify_jwt_local(token)
    if payload:
        uid = payload.get("sub"); email = payload.get("email", "")
        tier = "free"; name = email.split("@")[0]
        try:
            meta = get_service_client().auth.admin.get_user_by_id(uid).user.user_metadata or {}
            tier = meta.get("tier", "free"); name = meta.get("name", name)
        except Exception: pass
        return {"id": uid, "email": email, "name": name, "tier": tier, "tier_data": TIERS.get(tier, TIERS["free"])}
    
    user_data = await _verify_via_api(token)
    if user_data:
        uid = user_data.get("id", ""); email = user_data.get("email", "")
        meta = user_data.get("user_metadata") or {}
        tier = meta.get("tier", "free"); name = meta.get("name") or email.split("@")[0] or "User"
        return {"id": uid, "email": email, "name": name, "tier": tier, "tier_data": TIERS.get(tier, TIERS["free"])}
    raise HTTPException(401, "Invalid token.")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> Optional[dict]:
    if not credentials: return None
    try: return await get_current_user(credentials)
    except HTTPException: return None

# ── Models ────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str; email: str; password: str; tier: str = "free"

class LoginRequest(BaseModel):
    email: str; password: str

class UserOut(BaseModel):
    id: str; email: str; name: str; tier: str; tier_data: dict

class AuthResponse(BaseModel):
    access_token: str; refresh_token: str; user: UserOut

# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(req: RegisterRequest):
    """
    Register via Admin API with AUTO-CONFIRM enabled.
    Skips verification emails and signs in immediately.
    """
    if req.tier not in TIERS:
        raise HTTPException(400, f"Invalid tier. Choose: {list(TIERS.keys())}")

    admin_client = get_service_client()
    anon_client  = get_anon_client()
    print(f"\n🚀 AUTO-REGISTER: {req.email} (Email confirmation skipped)")

    # ── 1. Admin 권한으로 유저 생성 및 즉시 인증 처리 ──
    try:
        user_resp = admin_client.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True, # 이 부분이 핵심입니다: 즉시 인증 완료 상태로 생성
            "user_metadata": {"name": req.name, "tier": req.tier}
        })
        user = user_resp.user
    except Exception as e:
        raw = str(e).lower()
        if "already registered" in raw or "already exists" in raw:
            raise HTTPException(400, "Email already registered.")
        raise HTTPException(400, f"Registration error: {str(e)}")

    if not user:
        raise HTTPException(400, "Failed to create user.")

    # ── 2. 가입 직후 즉시 로그인 (세션 발급) ──
    try:
        login_resp = anon_client.auth.sign_in_with_password({"email": req.email, "password": req.password})
        session = login_resp.session
    except Exception as e:
        # 가입은 되었으나 자동 로그인 실패 시, 수동 로그인을 유도
        raise HTTPException(201, "Account created and confirmed. Please log in manually.")

    print(f"   ✅ Success: {user.id} (Auto-logged in)")

    # ── 3. Welcome 이메일 발송 (선택 사항, 비동기) ──
    try:
        from tools.email import send_welcome_email
        await send_welcome_email(req.email, req.name, req.tier)
    except Exception: pass

    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        user=UserOut(
            id=user.id,
            email=user.email,
            name=req.name,
            tier=req.tier,
            tier_data=TIERS[req.tier]
        )
    )

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    client = get_anon_client()
    print(f"\n🔑 LOGIN: {req.email}")
    try:
        resp = client.auth.sign_in_with_password({"email": req.email, "password": req.password})
    except Exception as e:
        raw = str(e).lower()
        if any(k in raw for k in ["invalid login", "credentials", "wrong password", "user not found"]):
            raise HTTPException(401, "Incorrect email or password.")
        raise HTTPException(401, f"Login failed: {str(e)}")

    meta = resp.user.user_metadata or {}
    tier = meta.get("tier", "free")
    return AuthResponse(
        access_token=resp.session.access_token,
        refresh_token=resp.session.refresh_token,
        user=UserOut(id=resp.user.id, email=resp.user.email, name=meta.get("name", "User"),
                     tier=tier, tier_data=TIERS.get(tier, TIERS["free"])),
    )

@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return UserOut(**{k: current_user[k] for k in ("id", "email", "name", "tier", "tier_data")})

@router.post("/logout")
async def logout():
    return {"message": "Logged out."}

@router.get("/tiers")
async def get_tiers():
    return {"tiers": TIERS}