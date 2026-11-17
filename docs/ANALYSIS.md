# Phase 1 Analysis: ResearchGraph AI (Autonomous Multi-Agent Research Intelligence System)

Analysed on 2026-11-17 on branch `refactor/restructure-and-improve` (from `main` @ `1fac72e`).
No code was changed in this phase. Every run below used `OPENROUTER_API_KEY=""` (the app's built-in mock LLM, **no AI calls**) and a throwaway SQLite file, so neither the OpenRouter quota nor the Neon database was touched.

---

## 1. What the project is

A web app that takes one open-ended research question and runs it through a LangGraph pipeline of seven "agents": a planner, three gatherers running in parallel (web, data, news), a verifier, a writer, and a critic that can send the draft back for revision. It produces a Markdown report, streams progress live, keeps a history, and lets you chat with a finished report or ask the chat to edit it.

**Target user:** a student, analyst or recruiter-facing demo user who wants a sourced, structured brief on a topic and wants to *see* the agents work. Live deployment: frontend on Vercel, backend on Render (free tier), database on Neon PostgreSQL.

### Tech stack (installed versions)

| Layer | Tech |
|---|---|
| Backend runtime | Python 3.11.15 (`.python-version`), managed with `uv` 0.11 |
| API | FastAPI 0.141.1, Starlette 1.6.0, Uvicorn 0.52.4, sse-starlette 3.4.8 |
| Agents | LangGraph 1.2.11, langchain-core 1.6.0, langchain-openai 1.6.0 (`ChatOpenAI` pointed at OpenRouter) |
| Search | duckduckgo-search 8.1.1 (deprecated, renamed `ddgs`), tavily-python 0.7.27 (optional) |
| DB | SQLAlchemy 2.0.52 async, asyncpg 0.31 (Neon), aiosqlite 0.22.1 (local) |
| Config | pydantic 2.13.4, pydantic-settings 2.15.0 |
| Frontend | React 19.2, Vite 8.2.2, Tailwind CSS 4.3 (`@tailwindcss/vite`), react-router-dom 7.18, react-markdown 10 + remark-gfm 4, lucide-react 1.33 |
| Lint | oxlint 1.75 (frontend). Backend has no linter configured. |
| Tests | none (see §10) |
| Deploy | `render.yaml` (backend), `frontend/vercel.json` (SPA rewrites) |

Unused but installed: `langchain`, `langchain-groq`, `langchain-google-genai` (and their transitive `groq`, `google-genai`), plus frontend `clsx` and `tailwind-merge`, which are declared and never imported.

---

## 2. Folder structure

```text
multi_agent_research_proj/
├── README.md                 # Marketing-style README; several claims are inaccurate (§8)
├── render.yaml               # Render web service for backend/
├── artifacts/                # Previous agent's prompts, plans, walkthroughs (2.7k lines, not code)
├── backend/
│   ├── main.py               # DEAD: uv template "Hello from backend!"
│   ├── README.md             # empty
│   ├── test_db.py            # manual script: creates tables (not a test)
│   ├── test_graph.py         # manual script: runs the whole graph with REAL LLM calls (not a test)
│   ├── pyproject.toml        # deps (uv), duplicated by...
│   ├── requirements.txt      # ...a 253-line pinned export used by Render
│   ├── .env.example          # 3 vars; out of date vs config.py
│   └── app/
│       ├── main.py           # FastAPI app, CORS, routers, /health
│       ├── config.py         # pydantic Settings
│       ├── agent/
│       │   ├── state.py      # ResearchState TypedDict + reducers
│       │   ├── graph.py      # StateGraph wiring + critic routing
│       │   ├── nodes.py      # 511 lines: 7 node functions + JSON parsing + LLM fallback loop
│       │   ├── llm.py        # LLMFactory (ChatOpenAI→OpenRouter) + MockFallbackLLM
│       │   └── tools.py      # web/news search, keyword extraction, "data analysis"
│       ├── api/
│       │   ├── routes_research.py  # create/get run, SSE stream, chat
│       │   └── routes_history.py   # history list, report by id
│       ├── db/
│       │   ├── database.py   # engine, URL normalisation, session, init_db (create_all)
│       │   └── models.py     # ResearchRun, ResearchPlan, AgentRunLog, Source, Report, ChatMessage
│       └── services/
│           ├── research_service.py # runs the graph, broadcasts SSE, persists everything
│           ├── chat_service.py     # follow-up Q&A and report editing
│           └── sse_manager.py      # in-memory pub/sub of asyncio.Queues per run
└── frontend/
    ├── README.md             # Vite template boilerplate
    ├── vercel.json, vite.config.js (dev proxy /api → :8000), .oxlintrc.json
    ├── public/favicon.svg, public/icons.svg (unused)
    └── src/
        ├── main.jsx, App.jsx (router + model state), index.css (theme + markdown typography)
        ├── App.css           # DEAD: Vite template CSS, never imported
        ├── assets/           # DEAD: hero.png, react.svg, vite.svg never referenced
        ├── services/api.js   # fetch wrappers + EventSource
        ├── pages/Dashboard.jsx (308 lines), pages/HistoryPage.jsx (160)
        └── components/
            ├── Navbar.jsx           # brand, model <select>, nav links
            ├── WorkflowGraph.jsx    # 7-node pipeline diagram (markup repeated 3×)
            ├── EventStreamLog.jsx   # raw SSE log list
            ├── AgentInspector.jsx   # 501 lines: 9 tabs, one inline block per agent
            ├── ReportViewer.jsx     # report / sources / critic tabs, copy, export .md
            └── ReportChat.jsx       # follow-up chat + report edit banner
```

---

## 3. Install, configure, run

### Documented setup
Backend: `cd backend && python -m venv .venv && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`.
Frontend: `cd frontend && npm install && npm run dev` (port 5173, proxies `/api` to `127.0.0.1:8000`). Production frontend reads `VITE_API_BASE_URL`.

### Environment variables (backend, read by `app/config.py`)

| Var | Default | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | `""` | Empty → mock LLM (offline mode) |
| `DEFAULT_MODEL` | `openrouter/free` | Your `.env` sets `meta-llama/llama-3.3-70b-instruct:free`, which **no longer exists** on OpenRouter |
| `DATABASE_URL` | `sqlite+aiosqlite:///./research_system.db` | `postgresql://` is rewritten to asyncpg; `sslmode`/`channel_binding` are cleaned |
| `TAVILY_API_KEY` | `""` | Optional; DuckDuckGo otherwise. Not in `.env.example` |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | `""` | Read but **never used** anywhere |
| CORS | hard-coded list incl. `"*"` | Not configurable via env |

`backend/.env` exists locally, is gitignored, and **has never been committed** (checked with `git log --all -- backend/.env`). Good.

### What happened when I ran it

| Check | Result |
|---|---|
| Backend boot (`uvicorn app.main:app`) | Boots and creates tables. `duckduckgo_search` prints `RuntimeWarning: package renamed to ddgs` on every search |
| `GET /health` and `/api/health` | **500** `AttributeError: 'Settings' object has no attribute 'LLM_PROVIDER'` |
| `GET /api/history` | 200 |
| `GET /api/research/<unknown>` | 404 (correct) |
| `POST /api/research` with blank query | 400 (correct) |
| `GET /api/research/<unknown>/chat` | 200 with `[]` (should be 404) |
| Full run (mock LLM, real DuckDuckGo) | Completes in ~3 s. **0 sources saved.** Web search returned 0 results, so the tool **invented two "Reuters"/"Bloomberg" tech-workforce links** for a *solar panel* query. The data analyst reported "15-25% hiring shift, 30% AI task automation" with a fake Statista URL. News search did return 4 real articles |
| SSE subscribing right after POST (as the UI does) | Missed `research_started`, `planner_completed` and `data_analyst_completed` (race, §7 B5) |
| Chat `POST` in mock mode | 200, persists messages |
| `npm run lint` (oxlint) | 0 errors, 10 warnings (unused vars, `Date.now` during render, use-before-define, missing hook deps) |
| `npm run build` | Passes. 447 kB JS (135 kB gzip), 54 kB CSS |
| `ruff check` (backend, ad hoc) | 11 unused imports, 3 unused variables, 1 bare f-string. 14 files unformatted |
| UI at 390 px (mobile) | **Horizontal overflow**: page is 918 px wide (navbar does not wrap) |
| UI at 820 px (tablet) | **Horizontal overflow**: 1010 px wide |
| UI at 1440 px | Renders correctly. No console errors or warnings |
| OpenRouter model IDs (public `/models` list, no key) | **9 of 10 hard-coded model IDs no longer exist.** Only `openrouter/free` is valid. All 4 models in AutonomePay's chain exist |

---

## 4. Feature checklist (must not break)

**Backend / pipeline**
- [ ] F1 `POST /api/research {query, provider}` creates a run (blank → 400) and runs the graph in the background
- [ ] F2 `GET /api/research/{id}` returns run, plan, sources, agent logs and report (unknown → 404)
- [ ] F3 `GET /api/research/{id}/stream` SSE: `connected`, `research_started`, `<node>_completed` per node (with `details` + `state_summary`), `research_completed` / `research_failed`
- [ ] F4 `GET /api/research/{id}/chat` returns chat history
- [ ] F5 `POST /api/research/{id}/chat` answers follow-ups using report + sources + last 6 messages, and **edits the stored report** when asked (blank → 400, unknown run → 404)
- [ ] F6 `GET /api/history?limit&offset` lists runs, newest first, with `has_report` / `report_id`
- [ ] F7 `GET /api/history/reports/{id}` returns one report (not used by the UI)
- [ ] F8 `GET /health`, `GET /api/health` (currently broken)
- [ ] F9 Graph: planner → (researcher ∥ data_analyst ∥ news_agent) → verifier → writer → critic → writer (revise) or END, bounded by `max_revisions`
- [ ] F10 Planner returns `tasks`, `agents_required` (filtered to the 3 valid gatherers), `focus_areas`, and short per-agent search queries `agent_prompts`
- [ ] F11 Researcher: Tavily when `TAVILY_API_KEY` is set, otherwise DuckDuckGo. Long prompts are shortened to search keywords
- [ ] F12 News agent: DuckDuckGo news, falling back to web search
- [ ] F13 Data analyst: extracts figures (%, $, years) from text
- [ ] F14 Verifier: LLM cross-checks findings into verified claims (confidence, reasoning) and unsupported claims
- [ ] F15 Writer: Markdown report with 8 fixed sections, addresses critic feedback on revisions
- [ ] F16 Critic: APPROVE/REVISE with feedback; reflection loop
- [ ] F17 LLM: OpenRouter via `ChatOpenAI`, user-selected model, fallback list on error, **offline mock LLM when no key**
- [ ] F18 Persistence of runs, plans, logs, sources, reports and chat to Postgres (Neon) or SQLite, including Neon URL normalisation

**Frontend**
- [ ] U1 Navbar: brand, model selector, Workspace / History links with active state
- [ ] U2 Workspace: hero, auto-growing prompt box (max 250 px), 3 example prompts that fill the box, submit button with running state
- [ ] U3 Error banner when launch or run fails
- [ ] U4 Live workflow diagram: 7 nodes with Waiting / Executing / Done and a revision badge; show/hide toggle
- [ ] U5 Live SSE event log
- [ ] U6 Agent inspector with 9 tabs: overview grid (click to open a tab), planner, researcher (links), data analyst, news (links), verifier (counts + claims), writer draft, critic decision, final report
- [ ] U7 Report viewer: Report / Sources / Critic tabs, copy Markdown, export `.md`
- [ ] U8 Report chat: loads history, 5 suggested prompts, send, optimistic user bubble, loading and error states, "report updated" banner with live report update, "New Research Query" reset
- [ ] U9 History: list (model, status, date), client-side search, select → full inspector + chat continuation, loading and empty states
- [ ] U10 SPA routing (Vercel rewrites), `VITE_API_BASE_URL`, dev proxy

---

## 5. Architecture and data flow

```text
React (Vite)                             FastAPI                                  LangGraph (sync nodes in threadpool)
────────────                             ───────                                  ────────────────────────────────────
Dashboard ──POST /api/research──────────► create ResearchRun(pending) ─ BackgroundTasks ─► execute_research_run
          ◄─────────── {run_id} ────────┘                                        │  astream(initial_state)
          ──EventSource /stream─────────► SSEManager.subscribe(run_id) ◄─broadcast┤  per node update:
          ◄── "message" events ───────────────────────────────────────────────────┤   • SSE <node>_completed
                                                                                  │   • AgentRunLog row
on research_completed ──GET /api/research/{id}──► run+plan+sources+logs+report    │   • planner → ResearchPlan
ReportChat ──POST /chat──► chat_service (LLM, sync) → ChatMessage, maybe Report   │   • verifier → Source rows (bug: none)
History ──GET /api/history──► runs (+1 query per run for report)                  │   • critic(final) → Report, status=completed
```

- **State management (frontend):** local `useState` in each page. No shared store. The selected model lives in `App` and is passed down as props. Agent outputs come from SSE `details`, then are replaced by `GET /api/research/{id}` logs at completion.
- **State (backend):** `ResearchState` TypedDict. Parallel gatherers write to separate list keys merged with `operator.add`, and to `agent_outputs` via a dict-merge reducer.
- **Persistence:** one new `AsyncSession` per write (about 10 per run). Tables are created with `Base.metadata.create_all` at startup, with **no migrations**, so adding a column will not reach the existing Neon tables automatically.
- **Live updates:** in-process memory only (`SSEManager`). There is no replay, so a client that connects late or reconnects misses earlier events. This works only with a single worker.
- **LLM:** every node uses the run's single `provider` model. `invoke_llm_with_fallback` tries the selected model, then 4 hard-coded fallbacks (3 are dead). If the key is missing, `MockFallbackLLM` echoes a canned "Mock Research Synthesis" for every call.

---

## 6. Code quality problems

**Duplication**
- The model list exists three times and the copies disagree: `llm.py:41-49`, `nodes.py:47-52`, `Navbar.jsx:5-12`.
- `agents_required` defaults and the initial state dict are repeated (`nodes.py`, `research_service.py:25-43`, `test_graph.py`).
- Each gatherer node (`nodes.py:132-295`) is the same ~55-line try / map / payload block written three times.
- The `WorkflowGraph` node card markup is written 3 times. `AgentInspector`'s per-agent tabs repeat the header / status / empty-state markup 8 times. "Run details → agentLogs map" is duplicated in `Dashboard.jsx:118-124` and `HistoryPage.jsx:42-48`.
- The query `select(Report).where(Report.run_id == …)` is copied in 4 places.

**Dead code**
- Backend: `backend/main.py`; empty `backend/README.md`; unused variables `llm = LLMFactory.get_model(...)` in planner (`nodes.py:69`) and writer (`nodes.py:391`); `GROQ_API_KEY`/`GEMINI_API_KEY`; `reduce_latest` behaviour can be replaced by a plain key; `getReportById` in `api.js` (no caller); 11 unused imports.
- Frontend: `App.css`, `src/assets/*`, `public/icons.svg`, `.glass-panel-hover`, `.glow-text-*`, and unused props `status`/`revisionCount` in `AgentInspector`/`WorkflowGraph`.
- Repo: `artifacts/` holds 2.7k lines of old agent prompts and walkthroughs.

**Hard-coded values**
- CORS list including `"*"` (`config.py:22-28`).
- OpenRouter base URL and a fake `HTTP-Referer: researchgraph.ai` (`llm.py:67-71`).
- `max_revisions = 2`, `max_results` 5/4, the critic's 3000-character draft cut, executive summary = first 500 characters + `"..."`, source `confidence_score=0.9` for every source (`research_service.py:148`), report title `"Research Intelligence Report: " + query[:50]`.
- `provider` defaults to `"groq"` in 5 places, even though Groq is no longer supported.

**Naming**
- `provider` actually holds a **model id**, across the API, DB and state.
- `routes_*.py` vs `*_service.py` naming is fine. `nodes.py` mixes LLM utilities (`parse_json_from_llm`, `invoke_llm_with_fallback`) with node logic, and `chat_service` imports from `nodes`.

**Large files**
- `nodes.py` (511 lines) and `AgentInspector.jsx` (501) are the largest. `Dashboard.jsx` (308) mixes SSE handling, run state and layout.

**Error handling**
- Nodes catch everything and quietly substitute plausible-looking content. The verifier marks every finding as verified at 0.85 (`nodes.py:355-362`), the critic approves with "strong verified evidence" (`nodes.py:478-482`), and the writer falls back to a stub. Failures look like successes.
- Frontend fetch errors are only logged to the console in `HistoryPage` and in `fetchRunDetails` and `ReportChat.fetchHistory`, so users see "No research runs recorded yet" when the API is down.

**Inconsistent patterns**
- Some routes use `Depends(get_db)`; `chat_service` opens its own sessions.
- Routes import inside the function (`routes_research.py:132,141`, `routes_history.py:53`).
- `config.py` mixes `os.getenv` defaults with pydantic-settings, and `env_file=".env"` is relative to the current directory, so starting the app from the repo root ignores `backend/.env`.
- `pyproject.toml` and `requirements.txt` can drift apart.

**Security**
- **No auth or rate limiting on a public deployment** that spends your OpenRouter key. Anyone can start unlimited runs and chats and exhaust the free daily quota.
- CORS `allow_origins` includes `"*"` together with `allow_credentials=True`. `"https://*.vercel.app"` is not a valid literal origin, so it does nothing.
- No length limits on `query` or chat `message`: unbounded tokens and DB rows.
- The LLM output is rendered with `react-markdown` without `rehype-raw`, so it is HTML-safe. Good.
- SQL is parameterised via the ORM. Good.
- The chat can overwrite the stored report with any LLM output longer than 100 characters, and there is no undo or version history.

---

## 7. Bugs (with repro)

| # | Severity | Where | Bug | Repro |
|---|---|---|---|---|
| B1 | High | `backend/app/main.py:54` | `/health` and `/api/health` always 500 (`settings.LLM_PROVIDER` does not exist). Render health checks fail | `curl :8000/health` |
| B2 | High | `services/research_service.py:132-150` | **Sources are never saved.** The verifier's update dict has no `research_findings`/`data_findings`/`news_findings`, so `findings == []`. The Sources tab always shows 0, and chat gets no sources | Run anything, then `GET /api/research/{id}` → `"sources": []` |
| B3 | High | `agent/tools.py:83-101`, `136-158` | **Fabricated evidence.** When search returns nothing, the tool invents 2 "Reuters/Bloomberg" articles about tech hiring. The data analyst invents "15-25% hiring shift, 30% AI task automation" with a Statista URL for any topic. These feed the verifier and writer as real sources | Query "solar panel costs" with DDG text search failing (current state) |
| B4 | High | `agent/tools.py:68`, `pyproject.toml` | `duckduckgo_search` is deprecated (renamed `ddgs`). Its text search returns 0 results now, which triggers B3 on every run | Server log: `RuntimeWarning … renamed to ddgs`, `Web search returned 0 items` |
| B5 | High | `api/routes_research.py:151-173`, `Dashboard.jsx:54` | **SSE race / no replay.** Events published before the browser subscribes are lost (`research_started`, often `planner_completed`/`data_analyst_completed`). If `research_completed` is missed, the UI spins forever. Refreshing mid-run shows nothing | Subscribe ~1 s after POST: only 6 of 9 events arrive |
| B6 | High | `agent/llm.py:41-49`, `nodes.py:47-52`, `Navbar.jsx:5-12`, `.env` | **9 of 10 model IDs are dead** on OpenRouter. Every model choice except `openrouter/free` errors and then falls through a fallback list that is also dead except `openrouter/free` | OpenRouter `/api/v1/models` |
| B7 | Medium | `nodes.py:477`, `508`; `research_service.py:152-170` | Run **stuck in `running`** if the critic returns anything other than exactly `APPROVE`/`REVISE` (e.g. `"Approved"`): routing ends, `final_report` is never set, no Report row is written, and status never becomes `completed`, while SSE still says `research_completed` | Unit-test `critic_node` with `{"decision":"Approved"}` |
| B8 | Medium | `services/chat_service.py:88` | Sync `llm.invoke` inside an async handler **blocks the event loop** for the whole LLM call, freezing every SSE stream and request on the server | Send a chat while another run streams |
| B9 | Medium | `nodes.py:204` | The data analyst reads `research_findings`, but it runs **in parallel** with the researcher, so the list is always empty and it only regex-scans the planner's query string | Inspect any run's data analyst output |
| B10 | Medium | `AgentInspector.jsx:53-62` | Status / error badges ("Failed", "No results") **never render**. They read `details.agent_outputs`, which is never put in SSE `details` or logs | Force a search exception; the tab still says "Completed" |
| B11 | Medium | `Dashboard.jsx:77-80`, `86` | The UI waits for `<node>_started` events that the backend never sends (only planner is ever "Executing", and only from client state). `state_summary.critic_feedback` does not exist, so live critic feedback is never set | Watch a live run |
| B12 | Medium | `db/models.py:11`, `HistoryPage.jsx:125` | Timestamps are naive UTC without `Z`. The browser parses them as local time, so IST users see times **5 h 30 m early** | Run at 20:47 IST → History shows 3:17 pm |
| B13 | Medium | `Navbar.jsx`, `Dashboard.jsx`, `HistoryPage.jsx` | Horizontal overflow on mobile (918 px at 390 px viewport) and tablet (1010 px at 820 px) | Resize to 390 px |
| B14 | Low | `nodes.py:486-491` | `max_revisions=2` allows only **1** actual revision (forced APPROVE when the counter reaches 2) | Critic always REVISE → writer runs twice, not three times |
| B15 | Low | `ReportViewer.jsx:27`, `31` | `localReportContent` survives switching runs in History, so run B can display run A's chat-edited report | Edit report via chat in History, select another run |
| B16 | Low | `Dashboard.jsx:293-302` | "New Research Query" does not reset `sources`, `errorMsg`, `criticFeedback`, `revisionCount` | Start a new query after a failed one: the old error stays |
| B17 | Low | `HistoryPage.jsx:138` | Every node is shown as completed even for failed or running runs | Open a failed run |
| B18 | Low | `EventStreamLog.jsx:42`, `12-14` | `replace('_',' ')` only replaces the first underscore (`data analyst_completed`). The "Real-time Connected" badge is hard-coded and always shown | Watch the log |
| B19 | Low | `routes_research.py:130-134` | `GET /chat` for an unknown run returns 200 `[]` instead of 404 | `curl …/research/nope/chat` |
| B20 | Low | `routes_research.py:151-173` | SSE stream never ends after completion, and `EventSource` is never closed, so the connection stays open (and auto-reconnects) until you navigate away | Network tab |
| B21 | Low | `nodes.py:393-396` | The writer only gets claim text, no URLs, so its "References & Sources" section is invented by the model | Read any real report's references |
| B22 | Low | `research_service.py` (background task) | Runs left `running` forever if the server restarts mid-run (Render free tier sleeps) | Kill the server mid-run |
| B23 | Low | `config.py:30` | `.env` is only read when the current directory is `backend/` | Run uvicorn from the repo root |

---

## 8. README / docs claims vs reality

- "Live event stream delivering `planner_started`…": no `*_started` events exist (B11).
- "Claims categorized as Supported / Partially Supported / Unsupported / Source Link Missing" and "Quantitative Analysis Table: sourced vs calculated vs assumptions": not implemented.
- "Verifier … verifies source presence/urls": it does not check URLs.
- "Resilient fallback across free models": the fallback models no longer exist (B6).
- The `api.js` comment says "Axios & EventSource client"; Axios is not used. `vercel.json` is listed at the root, but it is in `frontend/`.
- V1.1 walkthrough: "Visual status badges (✓ Completed – No Results / ✗ Failed)… showing exact error output": never rendered (B10).

---

## 9. UI/UX problems

- **Responsive:** overflow on mobile and tablet (B13). The navbar never collapses. The 9-tab inspector bar scrolls sideways with no affordance. On desktop the hero card pushes live progress below the fold once a run starts.
- **Visual consistency:** neon "glassmorphism" with 5+ competing gradients (cyan / indigo / purple / fuchsia / amber). Every surface uses `shadow-2xl`, `rounded-3xl` and a glow. There are perpetual animations (bouncing arrow, spinning revision icon, pinging "connected" dot, spinning Activity icon on every non-final log line). `!important` is used throughout the markdown CSS. `Inter` is named but never loaded, so headings render in a fallback system font.
- **Hierarchy:** the hero copy and badges ("Custom LangGraph Multi-Agent Architecture", "Powered by… Multi-LLM Engine", "OpenRouter Engine") are marketing text repeated 3×. The report, the actual deliverable, is buried in tab 9 inside a scroll box inside another scroll box (nested `max-h-[850px]` containers).
- **Accessibility:**
  - Overview stage cards are clickable `<div>`s, not keyboard reachable.
  - Tabs lack `role="tablist"`/`aria-selected`.
  - The icon-only send button has no label.
  - The model `<select>` has no `<label>`.
  - There are no `prefers-reduced-motion` rules.
  - Status is conveyed by colour plus a small dot only.
  - The live log is not an `aria-live` region.
  - `text-[11px]` captions.
- **Loading / empty / error states:**
  - History errors look like "No runs yet".
  - Selecting a history run shows no loading state.
  - The Final Report tab is blank (not an empty state) when there is no report.
  - The chat history load error is silent.
  - There is no visible reconnecting state for SSE.
  - Mock mode ships a "Mock Research Synthesis" report that looks like a real result. There is no global banner saying the app is in offline / demo mode.
- **Flow:** the model selector sits in the global navbar but only affects the next run. After completion, the user has to find the "Final Report" tab manually. There is no way to cancel a running job or delete a past run.

---

## 10. Tests and coverage

There are **no automated tests**. `backend/test_db.py` and `backend/test_graph.py` are manual scripts: the second makes real LLM calls, uses the obsolete `provider: "groq"`, and asserts nothing. No `pytest`, `vitest` or e2e tooling is installed, and there is no CI. **Coverage: 0 %.**

---

## 11. Decisions needed before Phase 2

1. **Fabricated sources and stats (B3, B9):** I recommend removing them. A search with no results should report "no results", and the data analyst should extract figures only from findings that were actually gathered (with their real URLs). This changes visible output, so I'm flagging it.
2. **Per-role models (your request):** how agents map to model "kinds", and what happens to the navbar model dropdown. A proposal is in the Phase 1 summary message and goes into `PLAN.md`.
3. **Database changes:** the Neon tables already exist and there are no migrations. I propose **no schema changes**: store new data such as `model_used` inside the existing `AgentRunLog.details` JSON column, and fix timestamps at the API layer by emitting a `Z` suffix.
4. **Public abuse protection:** add a simple per-IP rate limit on run and chat creation, plus max query/message length (no new dependency)?
5. **Theme:** dark only (current) or dark + light toggle?
