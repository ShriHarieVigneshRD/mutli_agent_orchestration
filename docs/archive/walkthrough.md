# Walkthrough - Autonomous Multi-Agent Research Intelligence System

The **Autonomous Multi-Agent Research Intelligence System** has been fully implemented with a custom **LangGraph** orchestration architecture, **FastAPI** backend, **React (Vite + Tailwind CSS)** frontend, and **PostgreSQL (Neon)** database integration.

---

## 1. Core AI & LangGraph Architecture

The system uses a custom **`StateGraph`** with explicit node definitions, parallel execution, evidence verification, synthesis, and reflection loops.

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

### Specialist Agents Implemented:
1. **Planner / Supervisor** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L29-L72)): Decomposes research question into sub-tasks and specialist routing assignments.
2. **Research Agent** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L75-L93)): Gathers broad web search findings using Tavily / DuckDuckGo fallback.
3. **Data Analyst Agent** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L96-L117)): Extracts quantitative metrics, growth trends, and statistical figures.
4. **News Agent** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L120-L139)): Discovers 2025/2026 industry news and dated developments.
5. **Verifier Agent** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L142-L200)): Validates claims, scores confidence levels, and flags unsupported evidence.
6. **Writer Agent** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L203-L248)): Synthesizes verified findings into publication-grade Markdown reports.
7. **Critic Agent** ([nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py#L251-L300)): Evaluates report completeness. Decides `APPROVE` or `REVISE` with feedback (max 2 revision iterations).

---

## 2. Neon Database Connection Setup Guide

To connect the backend to your live **Neon PostgreSQL** database:

1. **Sign up / Log in**: Go to [neon.tech](https://neon.tech) and log in.
2. **Create Project**: Click **New Project** and name it `multi-agent-research`.
3. **Copy Connection String**:
   - In your project dashboard, copy the PostgreSQL connection string.
   - Example raw string: `postgresql://alex:password123@ep-cool-db-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. **Format string for Async SQLAlchemy**:
   - Ensure the prefix is `postgresql+asyncpg://`
   - Set it as `DATABASE_URL` in `backend/.env` (and in Render environment variables):
     ```env
     DATABASE_URL=postgresql+asyncpg://alex:password123@ep-cool-db-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
5. *Note: If `DATABASE_URL` is omitted during local development, the backend automatically uses an async SQLite database (`sqlite+aiosqlite:///./research_system.db`).*

---

## 3. Deployment Instructions

### A. Deploy Backend to Render

1. Push your repository to **GitHub**.
2. Go to [render.com](https://render.com) and create a **Web Service**.
3. Select your repository.
4. Set the following configuration (or use `render.yaml`):
   - **Root Directory**: `backend`
   - **Build Command**: `pip install uv && uv sync`
   - **Start Command**: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Add Environment Variables**:
   - `LLM_PROVIDER`: `groq` (or `gemini`)
   - `GROQ_API_KEY`: `<your-groq-api-key>`
   - `GEMINI_API_KEY`: `<your-gemini-api-key>`
   - `TAVILY_API_KEY`: `<your-tavily-api-key>`
   - `DATABASE_URL`: `<your-neon-postgres-connection-string>`

---

### B. Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Select your GitHub repository.
3. Set configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://<your-render-backend-name>.onrender.com`
5. Deploy! Vercel automatically uses `vercel.json` for SPA routing.

---

## 4. Verification & Testing

### Frontend Production Build
The Vite production bundle built with **0 errors**:
- `dist/index.html`
- `dist/assets/index-BKkuZmfS.js` (418 kB)
- `dist/assets/index-C6ifECe0.css` (41.79 kB)

### Running Locally
To launch the app locally:

1. **Backend**:
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload --port 8000
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
