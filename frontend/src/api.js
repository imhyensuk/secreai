/**
 * secreai — API Client v3
 * Auth: Supabase JWT  |  Data: MongoDB via FastAPI  |  AI: Gemini + Groq
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ── Token (Supabase JWT) ─────────────────────────────────────────────
let _token = null;
export const setToken  = (t) => { _token = t; t ? localStorage.setItem('secreai_token', t) : localStorage.removeItem('secreai_token'); };
export const getToken  = () => { if (_token) return _token; _token = localStorage.getItem('secreai_token'); return _token; };
export const clearToken= () => { _token = null; localStorage.removeItem('secreai_token'); };

// ── Base fetch ───────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(err.detail || res.statusText, res.status);
  }
  return res.json();
}

async function apiFormFetch(path, formData) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new APIError(err.detail || res.statusText, res.status);
  }
  return res.json();
}

export class APIError extends Error {
  constructor(msg, status) { super(msg); this.status = status; this.name = 'APIError'; }
}

// ══════════════════════════════════════════════════════════════════════
//  AUTH — Supabase JWT flow
// ══════════════════════════════════════════════════════════════════════
export const auth = {
  async register({ name, email, password, tier = 'free' }) {
    const r = await apiFetch('/api/auth/register', { method: 'POST', body: { name, email, password, tier } });
    setToken(r.access_token);
    return r;
  },
  async login({ email, password }) {
    const r = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(r.access_token);
    return r;
  },
  async me()   { return apiFetch('/api/auth/me'); },
  async tiers(){ return apiFetch('/api/auth/tiers'); },
  logout()     { clearToken(); },
};

// ══════════════════════════════════════════════════════════════════════
//  USER DATA — MongoDB (userId = Supabase UUID enforced server-side)
// ══════════════════════════════════════════════════════════════════════
export const userData = {
  async load()                  { return apiFetch('/api/user/data'); },
  async loadSettings()          { return apiFetch('/api/user/settings'); },
  async saveSession(session)    { return apiFetch('/api/user/sessions',   { method: 'POST',   body: { session } }); },
  async deleteSession(id)       { return apiFetch(`/api/user/sessions/${id}`, { method: 'DELETE' }); },
  async saveFile(file)          { return apiFetch('/api/user/files',      { method: 'POST',   body: { file } }); },
  async updateEnabledTools(set) { return apiFetch('/api/user/tools',      { method: 'PATCH',  body: { enabled_tools: [...set] } }); },
};

// ══════════════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════════════
export const chat = {
  async send({ sessionId, message, activeAgents, enabledTools, history = [], provider = 'auto', ragContext = null }) {
    return apiFetch('/api/chat', {
      method: 'POST',
      body: {
        session_id:    sessionId,
        message,
        active_agents: activeAgents,
        enabled_tools: [...enabledTools],
        history,
        provider,
        rag_context:   ragContext,
      },
    });
  },
};

// ══════════════════════════════════════════════════════════════════════
//  CONTACT — stored in MongoDB
// ══════════════════════════════════════════════════════════════════════
export const contact = {
  async submit({ name, email, topic, message }) {
    return apiFetch('/api/contact', { method: 'POST', body: { name, email, topic, message } });
  },
};

// ══════════════════════════════════════════════════════════════════════
//  SHARING
// ══════════════════════════════════════════════════════════════════════
export const sharing = {
  async create({ resourceType, resourceId, title, data }) {
    return apiFetch('/api/share/create', { method: 'POST', body: { resource_type: resourceType, resource_id: resourceId, title, data } });
  },
  async get(token) { return apiFetch(`/api/share/${token}`); },
};

// ══════════════════════════════════════════════════════════════════════
//  RAG
// ══════════════════════════════════════════════════════════════════════
export const rag = {
  async upload(file, userId, sessionId = null) {
    const form = new FormData();
    form.append('file', file);
    form.append('user_id', userId);
    if (sessionId) form.append('session_id', sessionId);
    return apiFormFetch('/api/tools/rag/upload', form);
  },
  async query({ query, userId, sessionId, docIds, topK = 5 }) {
    return apiFetch('/api/tools/rag/query', { method: 'POST', body: { query, user_id: userId, session_id: sessionId, doc_ids: docIds, top_k: topK } });
  },
  async list(userId, sessionId = null) {
    const qs = sessionId ? `?user_id=${userId}&session_id=${sessionId}` : `?user_id=${userId}`;
    return apiFetch(`/api/tools/rag/documents${qs}`);
  },
  async delete(docId, userId) { return apiFetch(`/api/tools/rag/documents/${docId}?user_id=${userId}`, { method: 'DELETE' }); },
  async status()              { return apiFetch('/api/tools/rag/status'); },
};

// ══════════════════════════════════════════════════════════════════════
//  TOOLS
// ══════════════════════════════════════════════════════════════════════
export const tools = {
  async webSearch(query, n = 10, enabledTools) {
    return apiFetch('/api/tools/serp/search', { method: 'POST', body: { query, num_results: n, enabled_tools: [...enabledTools] } });
  },
  async tavilySearch(query, depth = 'basic', enabledTools) {
    return apiFetch('/api/tools/tavily/search', { method: 'POST', body: { query, search_depth: depth, include_answer: true, enabled_tools: [...enabledTools] } });
  },
  async getStockInfo(ticker, enabledTools) {
    return apiFetch('/api/tools/yfinance/info', { method: 'POST', body: { ticker, enabled_tools: [...enabledTools] } });
  },
  async checkPermission(toolId, enabledTools) {
    return apiFetch('/api/tools/check-permission', { method: 'POST', body: { tool_id: toolId, enabled_tools: [...enabledTools] } });
  },
};

// ══════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════════════════
export const analytics = {
  async track(event, properties = {}) {
    try { await apiFetch('/api/analytics', { method: 'POST', body: { event, properties } }); } catch { /* silent */ }
  },
};

export async function checkHealth() { return apiFetch('/api/health'); }
export default { auth, userData, chat, contact, sharing, rag, tools, analytics, checkHealth, setToken, getToken, clearToken };