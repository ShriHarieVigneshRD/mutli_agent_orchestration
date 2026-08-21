# Autonomous Multi-Agent Research Intelligence System

An advanced, publication-grade research platform built with **Custom LangGraph Orchestration**, **FastAPI**, **OpenRouter Multi-LLM Engine**, **Neon PostgreSQL**, and **React (Vite)**.

The system decomposes complex research prompts into sub-tasks, coordinates specialist agents running in parallel, verifies claims against collected sources, and refines outputs using a Critic editorial reflection loop.

---

## 🌟 Key Features

* **🤖 Custom LangGraph Orchestration State Machine**:
  * **Supervisor / Planner**: Decomposes user prompts into structured tasks and routes work to specialist agents.
  * **Parallel Execution Fan-Out**: Runs **Web Researcher**, **Data Analyst**, and **News Agent** concurrently.
  * **Verifier Agent**: Cross-examines collected evidence, verifies source presence/urls, and flags unsupported claims.
  * **Writer Agent**: Synthesizes structured evidence into GitHub-flavored Markdown research reports.
  * **Critic Agent & Reflection Loop**: Reviews report quality and conditionally routes back to Writer if revision is required (up to 2 iterations).

* **🌐 OpenRouter Engine & Model Selector**:
  * Native integration with OpenRouter's multi-LLM router (`https://openrouter.ai/api/v1`).
  * Dropdown selector with high-performing free models (`openrouter/free`, `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`, `google/gemini-2.0-flash-exp:free`, `qwen/qwen-2.5-72b-instruct:free`, `mistralai/mistral-7b-instruct:free`).
  * Resilient fallback mechanism across free models in case of rate limits.

* **⚡ Real-Time SSE Event Streaming**:
  * Live event stream delivering node state transitions (`planner_started`, `researcher_completed`, etc.) directly to the UI.

* **🔍 Multi-Agent Output Inspection Interface**:
  * **9-Tab Inspector**: Inspect individual agent outputs (`Overview`, `Planner`, `Researcher`, `Data Analyst`, `News Agent`, `Verifier`, `Writer`, `Critic`, `Final Report`).
  * **Source Link Integrity**: Verified clickable URLs linking directly to original web articles in a new browser tab.
  * **Quantitative Analysis Table**: Distinguishes directly sourced metrics vs calculated values vs assumptions.
  * **Claims Verification Matrix**: Displays claims categorized as `Supported`, `Partially Supported`, `Unsupported`, or `Source Link Missing`.

* **🎨 ChatGPT-Style Dark Glassmorphism UI**:
  * Spacious full-screen width layout (`1700px`).
  * Auto-expanding ChatGPT prompt textarea.
  * High-contrast publication markdown typography hierarchy (`H1`, `H2`, `H3`, `H4`, tables, callout blocks).

* **🐘 Neon PostgreSQL Database Persistence**:
  * Asynchronous SQLAlchemy engine (`asyncpg`) storing research runs, plans, agent logs, sources, and report outputs.

---

## 🏗 System Architecture

```text
                                 ┌───────────────────────────┐
                                 │   User Research Query     │
                                 └─────────────┬─────────────┘
                                               │
                                               ▼
                                 ┌───────────────────────────┐
                                 │   Supervisor / Planner    │
                                 └─────────────┬─────────────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         │ Parallel Fan-Out    │                     │
                         ▼                     ▼                     ▼
               ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
               │ Web Research      │ │ Data Analyst      │ │ News Agent        │
               │ (Broad Web Search)│ │ (Metrics/Stats)   │ │ (2025/2026 Events)│
               └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
                         │                     │                     │
                         └─────────────────────┼─────────────────────┘
                                               │ Fan-In Aggregation
                                               ▼
                                 ┌───────────────────────────┐
                                 │     Verifier Agent        │
                                 │ (Evidence Integrity Check)│
                                 └─────────────┬─────────────┘
                                               │
                                               ▼
                                 ┌───────────────────────────┐
                      ┌─────────►│       Writer Agent        │
                      │          │ (Report Draft Synthesis)  │
                      │          └─────────────┬─────────────┘
                      │                        │
                      │                        ▼
            Revision  │          ┌───────────────────────────┐
            Required  └──────────┤       Critic Agent        │
            (Max 2)              │  (Review & Reflection)    │
                                 └─────────────┬─────────────┘
                                               │
                                               ▼ Approved / Max Revisions
                                 ┌───────────────────────────┐
                                 │   Final Research Report   │
                                 └───────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Agent Orchestration** | LangGraph, LangChain Core (`langchain-core`, `langchain-openai`) |
| **LLM Provider** | OpenRouter (`https://openrouter.ai/api/v1`) |
| **Backend Framework** | FastAPI (Python 3.11/3.14), Uvicorn, SSE Starlette |
| **Database** | Neon PostgreSQL / SQLite, SQLAlchemy 2.0 (Async), `asyncpg` |
| **Frontend Framework** | React 19, Vite, Tailwind CSS v4, Lucide React, React Markdown |
| **Search Tools** | DuckDuckGo Search / DDGS, PrimP HTTP Engine |

---

## 📁 Repository Structure

```text
multi_agent_research_proj/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── graph.py       # LangGraph StateGraph state machine
│   │   │   ├── llm.py         # LLM Factory & OpenRouter model client
│   │   │   ├── nodes.py       # Agent node functions (planner, researcher, etc.)
│   │   │   ├── state.py       # ResearchState TypedDict & reducers
│   │   │   └── tools.py       # Search & data analysis tools
│   │   ├── api/
│   │   │   ├── routes_history.py  # History REST endpoints
│   │   │   └── routes_research.py # Research execution & SSE stream routes
│   │   ├── db/
│   │   │   ├── database.py    # Async SQLAlchemy database engine
│   │   │   └── models.py      # ResearchRun, ResearchPlan, AgentRunLog, Source, Report
│   │   ├── services/
│   │   │   ├── research_service.py # Graph execution runner & DB logger
│   │   │   └── sse_manager.py      # Real-time SSE broadcaster
│   │   ├── config.py          # App settings & environment variables
│   │   └── main.py            # FastAPI entry point & CORS configuration
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentInspector.jsx  # Multi-Agent Output Inspection Interface
│   │   │   ├── EventStreamLog.jsx  # Real-time SSE log output
│   │   │   ├── Navbar.jsx          # Top header & OpenRouter model selector
│   │   │   ├── ReportViewer.jsx    # Synthesized report renderer
│   │   │   └── WorkflowGraph.jsx   # Interactive execution graph visualizer
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Main research workspace
│   │   │   └── HistoryPage.jsx     # Past research archive
│   │   ├── services/
│   │   │   └── api.js              # Axios & EventSource SSE client
│   │   ├── App.jsx
│   │   └── index.css               # Dark glassmorphism & Markdown typography
│   ├── package.json
│   └── vite.config.js
├── render.yaml                      # Render backend deployment configuration
├── vercel.json                      # Vercel frontend deployment configuration
└── README.md
```

---

## 🚀 Local Setup & Installation

### Prerequisites
- **Node.js**: `v18+`
- **Python**: `v3.11+`
- **OpenRouter API Key**: Obtain a free API key from [OpenRouter Keys](https://openrouter.ai/keys)

---

### 1. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment & install dependencies
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` directory:

```env
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key-here
DEFAULT_MODEL=openrouter/free

# Neon PostgreSQL Database URL (or leave empty for SQLite)
DATABASE_URL=postgresql://user:password@ep-your-db.neon.tech/neondb?sslmode=require
```

Start the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```
Backend API will be live at `http://127.0.0.1:8000`.

---

### 2. Frontend Setup

```bash
# Navigate to frontend folder
cd ../frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend application will be live at `http://localhost:5173`.

---

## 🔌 API Endpoints Reference

### Research Endpoints (`/api/research`)

* **`POST /api/research`**: Initiate a multi-agent research run asynchronously.
  * Request Body: `{ "query": "Your research question", "provider": "openrouter/free" }`
  * Response: `{ "run_id": "uuid", "status": "pending", "message": "..." }`

* **`GET /api/research/{run_id}`**: Fetch complete run details, logs, sources, and synthesized report.

* **`GET /api/research/{run_id}/stream`**: Server-Sent Events (SSE) stream for real-time node completion notifications.

### History Endpoints (`/api/history`)

* **`GET /api/history`**: Retrieve all past research runs sorted chronologically.

---

## 🌐 Production Deployment Guide

### Deploying Backend to Render
1. Connect your GitHub repository to [Render](https://dashboard.render.com/).
2. Create a new **Web Service** with:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add Environment Variables: `OPENROUTER_API_KEY`, `DEFAULT_MODEL`, `DATABASE_URL`.

### Deploying Frontend to Vercel
1. Import your GitHub repository to [Vercel](https://vercel.com/dashboard).
2. Configure project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-render-backend-url.onrender.com`

---

## 📝 License

This project is licensed under the **MIT License**.
