"""
secreai — RAG Embedding (Google Gemini text-embedding-004)

MongoDB errors return 503 with a clear message instead of crashing with 500.
Fix MongoDB Atlas: Atlas → Database Access → reset password → update MONGODB_URI in .env
"""

import os, hashlib, uuid, asyncio, math
from datetime import datetime
from typing import List, Optional
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from dotenv import load_dotenv

from db.mongodb import get_db

load_dotenv()

router = APIRouter()

GOOGLE_AI_KEY = os.getenv("GOOGLE_AI_API_KEY", "")
EMBED_MODEL   = os.getenv("EMBED_MODEL", "text-embedding-004")
CHUNK_SIZE    = int(os.getenv("RAG_CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "50"))
MAX_RESULTS   = int(os.getenv("RAG_MAX_RESULTS", "5"))

GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"


# ── Text extraction ───────────────────────────────────────────────────
def extract_text(filename: str, content: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext in (".txt", ".md"):
        return content.decode("utf-8", errors="ignore")
    elif ext == ".csv":
        import csv
        lines = content.decode("utf-8", errors="ignore").splitlines()
        return "\n".join(" | ".join(row) for row in csv.reader(lines))
    elif ext == ".pdf":
        import re
        text = content.decode("latin-1", errors="ignore")
        streams = re.findall(r"stream\r?\n(.*?)\r?\nendstream", text, re.DOTALL)
        parts = []
        for s in streams:
            clean = re.sub(r"[^\x20-\x7E\n]", " ", s)
            words = [w for w in clean.split() if len(w) > 1 and w.isalpha()]
            if len(words) > 5:
                parts.append(" ".join(words))
        return "\n".join(parts) or "[PDF: text extraction limited — try TXT/MD]"
    return content.decode("utf-8", errors="ignore")


def chunk_text(text: str) -> List[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i: i + CHUNK_SIZE]))
        i += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if len(c.strip()) > 20]


# ── Gemini embeddings ─────────────────────────────────────────────────
async def embed_text(text: str) -> List[float]:
    if not GOOGLE_AI_KEY:
        raise HTTPException(503, "GOOGLE_AI_API_KEY not set in .env")
    url = GEMINI_EMBED_URL.format(model=EMBED_MODEL)
    payload = {"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": text}]},
               "taskType": "RETRIEVAL_DOCUMENT"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, params={"key": GOOGLE_AI_KEY})
            if resp.status_code == 200:
                return resp.json()["embedding"]["values"]
            raise HTTPException(503, f"Embedding API error {resp.status_code}: {resp.text[:200]}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(503, f"Embedding error: {e}")


async def embed_query(text: str) -> List[float]:
    if not GOOGLE_AI_KEY:
        raise HTTPException(503, "GOOGLE_AI_API_KEY not set in .env")
    url = GEMINI_EMBED_URL.format(model=EMBED_MODEL)
    payload = {"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": text}]},
               "taskType": "RETRIEVAL_QUERY"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, params={"key": GOOGLE_AI_KEY})
            if resp.status_code == 200:
                return resp.json()["embedding"]["values"]
            raise HTTPException(503, f"Query embedding error {resp.status_code}: {resp.text[:200]}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(503, f"Query embedding error: {e}")


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag = lambda v: math.sqrt(sum(x ** 2 for x in v))
    return dot / (mag(a) * mag(b) + 1e-9)


def _mongo_error_msg(e: Exception) -> str:
    raw = str(e)
    if "bad auth" in raw or "authentication failed" in raw:
        return ("MongoDB authentication failed. "
                "Fix: Atlas → Database Access → reset password → update MONGODB_URI in .env")
    if "timed out" in raw or "ServerSelectionTimeout" in raw:
        return ("MongoDB connection timed out. "
                "Fix: Atlas → Network Access → add 0.0.0.0/0 (Allow from Anywhere)")
    return f"MongoDB error: {raw[:200]}"


# ── Endpoints ─────────────────────────────────────────────────────────

# ✅ 프론트엔드와 파라미터 매칭 오류(422)를 방지하기 위해 카멜(userId)과 스네이크(user_id) 모두 허용
@router.post("/rag/upload")
async def upload_document(
    file: UploadFile = File(...),
    userId: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    sessionId: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
):
    actual_user_id = userId or user_id
    actual_session_id = sessionId or session_id

    if not actual_user_id:
        raise HTTPException(422, "userId or user_id is required.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Max 10 MB.")

    text = extract_text(file.filename, content)
    if not text.strip():
        raise HTTPException(422, "Could not extract text from file.")

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(422, "Document is empty after chunking.")

    db = get_db()
    doc_hash = hashlib.md5(content).hexdigest()

    try:
        existing = await db.rag_documents.find_one({"hash": doc_hash, "userId": actual_user_id})
        if existing:
            return {"doc_id": existing["doc_id"], "message": "Document already uploaded.",
                    "chunks": existing["chunk_count"]}
    except Exception as e:
        raise HTTPException(503, _mongo_error_msg(e))

    # Embed in batches of 5
    embedded_chunks = []
    for i in range(0, len(chunks), 5):
        batch = chunks[i: i + 5]
        embeddings = await asyncio.gather(*[embed_text(c) for c in batch], return_exceptions=True)
        for j, (ct, emb) in enumerate(zip(batch, embeddings)):
            embedded_chunks.append({
                "chunk_index": i + j,
                "text": ct,
                "embedding": emb if not isinstance(emb, Exception) else [],
            })

    doc_id = str(uuid.uuid4())
    doc = {
        "doc_id": doc_id, "userId": actual_user_id, "session_id": actual_session_id,
        "filename": file.filename, "hash": doc_hash,
        "chunk_count": len(embedded_chunks), "chunks": embedded_chunks,
        "created_at": datetime.utcnow(), "size_bytes": len(content),
    }

    try:
        await db.rag_documents.insert_one(doc)
    except Exception as e:
        raise HTTPException(503, _mongo_error_msg(e))

    return {"doc_id": doc_id, "filename": file.filename,
            "chunks": len(embedded_chunks), "message": f"Embedded {len(embedded_chunks)} chunks."}


class RAGQueryRequest(BaseModel):
    query: str
    userId: Optional[str] = None
    user_id: Optional[str] = None
    sessionId: Optional[str] = None
    session_id: Optional[str] = None
    docIds: Optional[List[str]] = None
    doc_ids: Optional[List[str]] = None
    topK: int = 5

    @property
    def actual_user_id(self): return self.userId or self.user_id
    @property
    def actual_session_id(self): return self.sessionId or self.session_id
    @property
    def actual_doc_ids(self): return self.docIds or self.doc_ids


@router.post("/rag/query")
async def query_documents(req: RAGQueryRequest):
    if not req.actual_user_id:
        raise HTTPException(422, "userId is required")

    db = get_db()
    q_emb = await embed_query(req.query)

    filt: dict = {"userId": req.actual_user_id}
    if req.actual_session_id:
        filt["session_id"] = req.actual_session_id
    if req.actual_doc_ids:
        filt["doc_id"] = {"$in": req.actual_doc_ids}

    try:
        docs = await db.rag_documents.find(filt).to_list(length=50)
    except Exception as e:
        raise HTTPException(503, _mongo_error_msg(e))

    scored = []
    for doc in docs:
        for chunk in doc.get("chunks", []):
            emb = chunk.get("embedding", [])
            if emb:
                score = cosine_similarity(q_emb, emb)
                scored.append({"doc_id": doc["doc_id"], "filename": doc["filename"],
                                "chunk_index": chunk["chunk_index"],
                                "text": chunk["text"], "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)
    top_k = scored[:req.topK or MAX_RESULTS]
    context_str = "\n\n---\n".join(
        f"[Source: {c['filename']}]\n{c['text']}" for c in top_k if c["score"] > 0.3
    )
    return {"query": req.query, "results": top_k, "context": context_str,
            "chunks_searched": sum(len(d.get("chunks", [])) for d in docs)}


# ✅ GET 요청 쿼리 파라미터에서도 카멜(userId)과 스네이크(user_id) 모두 허용
@router.get("/rag/documents")
async def list_documents(
    userId: Optional[str] = None, 
    user_id: Optional[str] = None, 
    sessionId: Optional[str] = None, 
    session_id: Optional[str] = None
):
    actual_user_id = userId or user_id
    actual_session_id = sessionId or session_id

    if not actual_user_id:
        raise HTTPException(422, "userId or user_id is required")

    db = get_db()
    q: dict = {"userId": actual_user_id}
    if actual_session_id:
        q["session_id"] = actual_session_id
        
    try:
        docs = await db.rag_documents.find(q, {"chunks": 0}).to_list(length=200)
    except Exception as e:
        print(f"⚠️  RAG list error: {_mongo_error_msg(e)}")
        return {"documents": [], "warning": _mongo_error_msg(e)}

    return {"documents": [
        {"doc_id": d["doc_id"], "filename": d["filename"],
         "chunk_count": d["chunk_count"], "size_bytes": d["size_bytes"],
         "created_at": d.get("created_at", datetime.utcnow()).isoformat() if d.get("created_at") else ""}
        for d in docs
    ]}


@router.delete("/rag/documents/{doc_id}")
async def delete_document(doc_id: str, userId: Optional[str] = None, user_id: Optional[str] = None):
    actual_user_id = userId or user_id
    if not actual_user_id:
        raise HTTPException(422, "userId is required")

    db = get_db()
    try:
        result = await db.rag_documents.delete_one({"doc_id": doc_id, "userId": actual_user_id})
    except Exception as e:
        raise HTTPException(503, _mongo_error_msg(e))
    if result.deleted_count == 0:
        raise HTTPException(404, "Document not found.")
    return {"message": "Deleted.", "doc_id": doc_id}


@router.get("/rag/status")
async def rag_status():
    key_ok = bool(GOOGLE_AI_KEY)
    return {
        "embed_model": EMBED_MODEL,
        "embed_ready": key_ok,
        "provider":    "Google AI Studio (Gemini)",
        "setup":       None if key_ok else "Set GOOGLE_AI_API_KEY in .env",
    }