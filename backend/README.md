# secreai

Multi-agent AI platform — 15 job-function agents collaborate in real time.

```
secreai/
├── frontend/          ← React app (was: src/)
│   └── src/
│       ├── App.js
│       ├── api.js     ← centralized backend client
│       └── components/
└── backend/
    ├── main.py        ← FastAPI entry point
    ├── login.py       ← Auth (MongoDB + JWT)
    ├── requirements.txt
    ├── .env           ← API keys (never commit)
    ├── tools/
    │   ├── yfinance.py
    │   ├── serp.py
    │   ├── tavily.py
    │   ├── news.py
    │   └── RSS.py
    └── model/
        ├── model.py   ← Claude orchestration
        └── prompt.json
```

---

## Backend Setup

```bash
cd backend

# 1. Create virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env .env.local               # or edit .env directly
# Fill in: ANTHROPIC_API_KEY, SERPAPI_KEY, TAVILY_API_KEY,
#          NEWS_API_KEY, MONGODB_URI, JWT_SECRET

# 4. Start MongoDB (if running locally)
mongod --dbpath ~/data/db

# 5. Run backend
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

## Frontend Setup

```bash
cd frontend

npm install
npm start
# Runs on http://localhost:3000
```

## Environment Variables (.env)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com) |
| `SERPAPI_KEY` | SerpAPI key for web search (serpapi.com) |
| `TAVILY_API_KEY` | Tavily AI search (tavily.com) |
| `NEWS_API_KEY` | NewsAPI key (newsapi.org) |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name (default: secreai) |
| `JWT_SECRET` | Strong random secret for JWT signing |
| `RSS_FEEDS` | Comma-separated RSS feed URLs |
| `CLAUDE_MODEL` | Claude model ID (default: claude-sonnet-4-5) |

## Tool Permission System

Tools are gated at **two levels**:

1. **Frontend** (`App.js` → `enabledTools` Set): UI reflects enabled/disabled state.  
   Only enabled tool IDs are passed in every API request.

2. **Backend** (`main.py` → `/api/chat`): The `enabled_tools` list is re-validated  
   server-side before any tool is dispatched. Disabled tools return a `403` response.

Enable/disable tools in the **Tools & Permissions** page in the UI.

## Agent Roles

15 job-function agents, each with a dedicated system prompt in `model/prompt.json`:

`DATA_ANALYSIS` · `RESEARCH` · `STRATEGY` · `FINANCE` · `MARKETING` · `OPERATIONS`  
`LEGAL` · `HUMAN_RESOURCES` · `ENGINEERING` · `PRODUCT` · `SALES` · `RISK`  
`COMMUNICATIONS` · `DESIGN` · `QUALITY`