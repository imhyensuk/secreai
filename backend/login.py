"""
secreai — Authentication Module
Handles user registration and login using MongoDB + bcrypt + JWT.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────
MONGO_URI     = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME       = os.getenv("MONGODB_DB", "secreai")
JWT_SECRET    = os.getenv("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days

# ── MongoDB client (lazy init) ────────────────────────────────────────
_client: Optional[AsyncIOMotorClient] = None

def get_db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client[DB_NAME]


# ── Password hashing ─────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Pydantic models ──────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    plan: str = "free"   # free | pro | enterprise


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    plan: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── JWT helpers ──────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_db()
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return user


# ── Router ───────────────────────────────────────────────────────────
router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    """
    Register a new user.
    - Checks for duplicate email in MongoDB.
    - Hashes the password with bcrypt.
    - Stores user document in MongoDB.
    - Returns a JWT access token.
    """
    db = get_db()

    # Check duplicate
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    # Validate plan
    valid_plans = {"free", "pro", "enterprise"}
    if req.plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {valid_plans}")

    # Hash password
    hashed = pwd_context.hash(req.password)

    # Insert user
    user_doc = {
        "name": req.name.strip(),
        "email": req.email.lower().strip(),
        "hashed_password": hashed,
        "plan": req.plan,
        "created_at": datetime.utcnow(),
        "sessions": [],
        "enabled_tools": ["web_search", "wikipedia", "file_read", "file_write", "perm_network"],
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Create JWT
    token = create_access_token({"sub": req.email, "user_id": user_id})

    return TokenResponse(
        access_token=token,
        user=UserOut(id=user_id, name=req.name, email=req.email, plan=req.plan),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """
    Authenticate a user.
    - Fetches user document from MongoDB by email.
    - Verifies password against bcrypt hash.
    - Returns a JWT access token on success.
    """
    db = get_db()

    # Find user
    user = await db.users.find_one({"email": req.email.lower().strip()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Verify password
    if not pwd_context.verify(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user["email"], "user_id": user_id})

    return TokenResponse(
        access_token=token,
        user=UserOut(id=user_id, name=user["name"], email=user["email"], plan=user.get("plan", "free")),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserOut(
        id=str(current_user["_id"]),
        name=current_user["name"],
        email=current_user["email"],
        plan=current_user.get("plan", "free"),
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint.
    JWT is stateless — client should discard the token.
    This endpoint exists for completeness and future token blacklist support.
    """
    return {"message": "Logged out successfully. Discard your token client-side."}