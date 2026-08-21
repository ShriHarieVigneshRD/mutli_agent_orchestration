# Tasks - Autonomous Multi-Agent Research Intelligence System

- [x] Phase 1: Environment & Project Setup <!-- id: 0 -->
  - [x] Initialize backend structure using `uv` with FastAPI, LangGraph, SQLAlchemy, asyncpg, DuckDuckGo/Tavily search <!-- id: 1 -->
  - [x] Initialize frontend structure using Vite + React + Tailwind CSS <!-- id: 2 -->
  - [x] Setup database models & connection layer (Neon PostgreSQL / async SQLite fallback) <!-- id: 3 -->

- [x] Phase 2: LangGraph Core Architecture <!-- id: 4 -->
  - [x] Define graph state (`ResearchState`) in `state.py` <!-- id: 5 -->
  - [x] Implement swappable LLM factory (`llm.py`) supporting Groq & Gemini with fallback <!-- id: 6 -->
  - [x] Implement web search & data tools (`tools.py`) <!-- id: 7 -->
  - [x] Implement nodes (`planner`, `researcher`, `data_analyst`, `news_agent`, `verifier`, `writer`, `critic`) in `nodes.py` <!-- id: 8 -->
  - [x] Construct custom `StateGraph` with parallel execution fan-out, verifier aggregation, and critic reflection loop in `graph.py` <!-- id: 9 -->
  - [x] Verify standalone LangGraph execution script (`test_graph.py`) <!-- id: 10 -->

- [x] Phase 3: FastAPI Backend & Asynchronous SSE Streaming <!-- id: 11 -->
  - [x] Implement SSE Manager & event callbacks (`sse_manager.py`) <!-- id: 12 -->
  - [x] Implement research service (`research_service.py`) for long-running run management & DB persistence <!-- id: 13 -->
  - [x] Implement REST endpoints & SSE route (`routes_research.py`, `routes_history.py`) <!-- id: 14 -->
  - [x] Verify backend APIs and live SSE event stream <!-- id: 15 -->

- [x] Phase 4: Modern React Frontend <!-- id: 16 -->
  - [x] Setup design system & index.css with glassmorphism, dark theme, and typography <!-- id: 17 -->
  - [x] Build Navbar & Header components <!-- id: 18 -->
  - [x] Build interactive Workflow Graph visualizer component (`WorkflowGraph.jsx`) <!-- id: 19 -->
  - [x] Build Live SSE Log timeline (`EventStreamLog.jsx`) <!-- id: 20 -->
  - [x] Build Formatted Report Viewer & Source Inspector (`ReportViewer.jsx`) <!-- id: 21 -->
  - [x] Build Research History & Dashboard page (`Dashboard.jsx`, `HistoryPage.jsx`) <!-- id: 22 -->
  - [x] Test end-to-end frontend integration with backend <!-- id: 23 -->

- [x] Phase 5: Deployment Configuration & Final Verification <!-- id: 24 -->
  - [x] Create Render configuration (`render.yaml`) and Vercel configuration (`vercel.json`) <!-- id: 25 -->
  - [x] Generate deployment & Neon DB connection verification guide in walkthrough <!-- id: 26 -->
