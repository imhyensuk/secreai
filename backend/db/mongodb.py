"""
secreai — MongoDB (Motor async driver)
All documents MUST include { "userId": "<supabase_uuid>" }.

Common Atlas errors & fixes:
  - "bad auth / authentication failed" → wrong username or password in MONGODB_URI
  - "connection refused"               → localhost MongoDB not running (run: mongod)
  - "network timeout"                  → Atlas IP whitelist blocked (add 0.0.0.0/0)

URI formats:
  Local:  mongodb://localhost:27017
  Atlas:  mongodb+srv://user:password@cluster.xxx.mongodb.net/secreai
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        _client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
            socketTimeoutMS=10000,
        )
    return _client


def get_db() -> AsyncIOMotorDatabase:
    db_name = os.getenv("MONGODB_DB", "secreai")
    return get_client()[db_name]


def require_user_id(doc: dict) -> dict:
    """Guard: every document must carry a userId (Supabase UUID)."""
    if not doc.get("userId"):
        raise ValueError(
            "MongoDB document missing required 'userId' field. "
            "This must be the Supabase auth.users UUID."
        )
    return doc


async def ping_db() -> dict:
    """Health check — returns connection status."""
    try:
        await get_client().admin.command("ping")
        return {"ok": True, "uri_prefix": os.getenv("MONGODB_URI", "")[:30] + "..."}
    except Exception as e:
        err = str(e)
        if "bad auth" in err.lower() or "authentication failed" in err.lower():
            hint = "Wrong username or password in MONGODB_URI"
        elif "connection refused" in err.lower():
            hint = "MongoDB is not running locally. Start it: mongod"
        elif "network timeout" in err.lower() or "timed out" in err.lower():
            hint = "Atlas IP whitelist may be blocking your IP. Add 0.0.0.0/0 in Atlas → Network Access"
        else:
            hint = str(e)[:200]
        return {"ok": False, "error": hint}