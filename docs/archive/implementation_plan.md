# Implementation Plan - Autonomous Multi-Agent Research Intelligence System

Build a full-stack, production-grade **Autonomous Multi-Agent Research Intelligence System** using custom **LangGraph** orchestration, **FastAPI**, **React (Vite + Tailwind CSS)**, and **PostgreSQL (Neon)**, ready for deployment to **Render** (backend) and **Vercel** (frontend).

---

## User Review Required

> [!IMPORTANT]
> **Neon PostgreSQL Setup Required**
> To connect your backend to a live PostgreSQL database, please follow the steps below and provide your connection string:
> 1. Create a free account at [neon.tech](https://neon.tech).
> 2. Create a new database project (e.g. `multi-agent-research`).
> 3. In your Neon dashboard, copy the PostgreSQL connection string.
> 4. Set it as `DATABASE_URL` in backend `.env` (Format: `postgresql+asyncpg://<user>:<password>@<ep-name>.neon.tech/<dbname>?sslmode=require`).
> *Note: For local development before Neon is connected, the backend will auto-fallback gracefully to an SQLite database or local Postgres if `DATABASE_URL` is unconfigured.*

> [!NOTE]
> **LLM & Search API Credentials**
> Provide your API keys in `backend/.env`:
> - `GROQ_API_KEY` (Free high-speed inference via Llama 3 models)
> - `GEMINI_API_KEY` (Google Gemini models)
> - `TAVILY_API_KEY` (Optional; fallback web search tool via DuckDuckGo search is included if Tavily is missing)

---

## Proposed System Architecture & LangGraph Design

```text
                                User Query
                                    │
                                    ▼
                          Planner / Supervisor
                     (Decomposes into ResearchPlan)
                                    │
                  ┌─────────────────┼─────────────────┐
                  ▼                 ▼                 ▼
            Research Agent    Data Analyst      News Agent
             (Web Search)   (Data & Trends)  (Recent Events)
                  │                 │                 │
                  └─────────────────┼─────────────────┘
                                    │
                           Parallel Aggregator
                                    │
                                    ▼
                             Verifier Agent
                      (Validates claims & sources)
                                    │
                                    ▼
                              Writer Agent
                   (Synthesizes report from evidence)
                                    │
                                    ▼
                              Critic Agent
                           /                \
                REVISE (Loop back)       APPROVE
                         │                    │
                         └───────┬────────────┘
                                 ▼
                            Final Report
```

---

## Proposed Changes

### Project Structure Overview

```text
multi_agent_research_proj/
├── backend/
│   ├── pyproject.toml              # Managed via uv
│   ├── .env.example
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry point & CORS
│   │   ├── config.py               # Env settings & configuration
│   │   ├── db/
│   │   │   ├── database.py         # SQLAlchemy async engine & session
│   │   │   └── models.py           # DB Entities (Run, Query, Plan, Source, Report)
│   │   ├── agent/
│   │   │   ├── state.py            # LangGraph TypedDict state definitions
│   │   │   ├── llm.py              # LLM Factory (Groq / Gemini switchable)
│   │   │   ├── tools.py            # Search & analysis tools
│   │   │   ├── nodes.py            # Planner, Research, Data, News, Verifier, Writer, Critic nodes
│   │   │   └── graph.py            # LangGraph StateGraph assembly & compiled workflow
│   │   ├── services/
│   │   │   ├── research_service.py # Orchestrates run state, DB updates, SSE event emission
│   │   │   └── sse_manager.py      # Real-time event broadcasting queues
│   │   └── api/
│   │       ├── routes_research.py  # REST endpoints & SSE streaming handler
│   │       └── routes_history.py   # Historical report retrieval
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── index.css               # Tailwind & glassmorphism theme tokens
│   │   ├── App.jsx                 # Router & Layout
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Header with branding & system status
│   │   │   ├── WorkflowGraph.jsx   # Interactive real-time LangGraph visualizer
│   │   │   ├── EventStreamLog.jsx  # Live SSE log timeline
│   │   │   ├── ReportViewer.jsx    # Formatted report reader with markdown & sources
│   │   │   └── HistoryTable.jsx    # Searchable list of past research runs
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Create new research run & live progress monitor
│   │   │   └── HistoryPage.jsx     # View past research reports
│   │   └── services/
│   │       └── api.js              # Fetch & EventSource SSE client wrapper
│   └── vercel.json                 # Vercel deployment config
└── render.yaml                     # Render backend deployment config
```

---

### Backend Components (`backend/`)

#### [NEW] [pyproject.toml](file:///e:/multi_agent_research_proj/backend/pyproject.toml)
- Initialized using `uv` with dependencies: `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `langgraph`, `langchain`, `langchain-core`, `langchain-groq`, `langchain-google-genai`, `sqlalchemy`, `asyncpg`, `aiosqlite`, `duckduckgo-search`, `tavily-python`, `httpx`, `sse-starlette`.

#### [NEW] [state.py](file:///e:/multi_agent_research_proj/backend/app/agent/state.py)
- LangGraph graph state `ResearchState`:
  - `query`: str
  - `plan`: dict (tasks list, specialist assignments)
  - `research_findings`: list of structured dicts
  - `data_findings`: list of structured dicts
  - `news_findings`: list of structured dicts
  - `verified_evidence`: list of validated claims & scores
  - `draft_report`: str
  - `critic_feedback`: str
  - `status`: str
  - `revision_count`: int
  - `final_report`: str

#### [NEW] [llm.py](file:///e:/multi_agent_research_proj/backend/app/agent/llm.py)
- Unified `LLMFactory.get_model(provider="groq"|"gemini", temperature=0.2)` returning standard `BaseChatModel` compatible with LangGraph nodes.

#### [NEW] [tools.py](file:///e:/multi_agent_research_proj/backend/app/agent/tools.py)
- Web search tool (`Tavily` search with fallback to `DuckDuckGoSearchRun`).
- Structured data analysis tool (Python evaluator / statistics summarizer).

#### [NEW] [nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py)
- Explicit node functions for:
  - `planner_node`: Generates structured execution steps.
  - `research_node`: Broad search & evidence extraction.
  - `data_analyst_node`: Numerical calculations & quantitative trends.
  - `news_node`: Current event search and timestamps.
  - `verifier_node`: Assesses evidence quality, flags weak claims.
  - `writer_node`: Synthesizes findings into comprehensive Markdown report.
  - `critic_node`: Reviews report, outputs decision (`APPROVE` or `REVISE`) and actionable feedback.

#### [NEW] [graph.py](file:///e:/multi_agent_research_proj/backend/app/agent/graph.py)
- Custom `StateGraph` compilation:
  - Entry point: `planner_node`
  - Fan-out to `research_node`, `data_analyst_node`, `news_node`
  - Fan-in aggregation to `verifier_node`
  - Flow to `writer_node` -> `critic_node`
  - Conditional edge from `critic_node`:
    - `APPROVE` or `revision_count >= 2` -> `END`
    - `REVISE` -> `writer_node` (with critic feedback passed in state)

#### [NEW] [routes_research.py](file:///e:/multi_agent_research_proj/backend/app/api/routes_research.py)
- `POST /api/research`: Trigger research run, launch background LangGraph task, persist to DB, return `{ "run_id": ... }`.
- `GET /api/research/{run_id}/stream`: SSE endpoint (`EventSourceResponse`) pushing JSON events for each node state transition.

---

### Frontend Components (`frontend/`)

#### [NEW] [index.css](file:///e:/multi_agent_research_proj/frontend/src/index.css)
- Deep space modern theme: glassmorphic cards, vibrant glowing borders, custom scrollbars, animated pulse effects for agent execution nodes.

#### [NEW] [WorkflowGraph.jsx](file:///e:/multi_agent_research_proj/frontend/src/components/WorkflowGraph.jsx)
- Visual graph diagram showing node status badges (`idle`, `running`, `completed`, `revision_loop`).
- Real-time highlight of active node in the LangGraph workflow.

#### [NEW] [Dashboard.jsx](file:///e:/multi_agent_research_proj/frontend/src/pages/Dashboard.jsx)
- Research query input box with example prompts (e.g. "Impact of Quantum Computing on Post-Quantum Cryptography by 2030").
- Swappable provider dropdown (`Groq` / `Gemini`).
- Real-time progress layout showing visual graph + live event stream log + live report rendering.

---

## Verification Plan

### Automated Verification
1. **Backend Unit & Flow Tests**:
   - Run python verification script `test_graph.py` to execute the complete LangGraph state machine end-to-end with mock/live LLM models.
   - Verify parallel execution, verifier aggregation, writer output, and critic decision routing.
2. **FastAPI & SSE API Verification**:
   - Test `POST /api/research` and listen to `GET /api/research/{run_id}/stream` via python client/curl to verify event payload structure.
3. **Frontend Build**:
   - Run `npm run build` in `frontend/` to confirm zero JSX/CSS compile errors.

### Manual Verification
1. Open frontend in browser.
2. Submit a research topic.
3. Observe live SSE progress updates and node animations on the interactive workflow visualizer.
4. Verify the generated research report, source links, and critic reflection logs.
5. Check research history persistence.

---

## Deployment & Setup Guide

### 1. Neon PostgreSQL Setup Instructions for User
1. Sign up / log into [Neon](https://neon.tech).
2. Create a project `multi-agent-research`.
3. In dashboard dashboard, copy your database connection string.
4. Set env var `DATABASE_URL=postgresql+asyncpg://...` in `backend/.env` (and in Render settings).

### 2. Render Deployment (Backend)
- Connect GitHub repository to Render.
- Create a new **Web Service**.
- Root Directory: `backend`
- Build Command: `pip install uv && uv sync`
- Start Command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set Environment Variables: `GROQ_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, `DATABASE_URL`, `LLM_PROVIDER`.

### 3. Vercel Deployment (Frontend)
- Connect GitHub repository to Vercel.
- Framework Preset: `Vite`
- Root Directory: `frontend`
- Environment Variables: `VITE_API_BASE_URL=https://<your-render-backend-url>.onrender.com`
