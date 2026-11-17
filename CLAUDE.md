# CLAUDE.md

ResearchGraph: FastAPI + LangGraph backend (seven research agents, OpenRouter models, SSE progress) and a React 19 / Vite / Tailwind 4 frontend. Deployed on Render (backend), Vercel (frontend) and Neon (PostgreSQL).

## Commands

```bash
# backend (run from backend/)
uv sync                                         # install app + dev tools into .venv
uv run uvicorn app.main:app --reload --port 8000
uv run ruff check app tests && uv run ruff format app tests && uv run pyright
uv run pytest                                   # add --cov for coverage
uv export --no-hashes --no-dev --no-emit-project --format requirements.txt -o requirements.txt   # after any dependency change (Render installs this file)

# frontend (run from frontend/)
npm run dev                                     # :5173, proxies /api to :8000
npm run lint && npm run format:check
npm test                                        # Vitest (via scripts/vitest.mjs, see below)
npm run test:e2e                                # Playwright: own offline backend :8799 + Vite :5198, system Edge
npm run build
```

## Layout

- `backend/app/agent/`
  - `graph.py`: planner → (researcher ∥ data_analyst ∥ news_agent) → verifier → writer ⇄ critic
  - `nodes.py`: the agents
  - `llm.py`: the only way to call a model: `llm.invoke(agent, messages, model_setting, temperature, offline=...)`
  - `tools.py`: search
  - `prompts.py`
  - `offline.py`: demo replies when there is no key
- `backend/app/services/research_service.py` runs a graph: SSE events, AgentRunLog per node, sources at the verifier, report at the critic. `chat_service.py` handles follow-ups, edits and undo. `sse_manager.py` is pub/sub with replay.
- `backend/app/api/`: routes, `deps.py` (rate limits), `serializers.py` (UTC timestamps with `Z`).
- `frontend/src/pages`:
  - `WorkspacePage` (compose)
  - `RunPage` (`/runs/:id`, keyed by run id)
  - `HistoryPage`
- `frontend/src/hooks/useRun.js` holds live run state; its pure reducers `applyEvent` and `nodesFromLogs` are unit-tested.
- `frontend/src/lib/agents.js` is the one agent catalogue. `lib/format.js` has the formatting helpers.
- Design system: `.interface-design/system.md`, with tokens in `frontend/src/styles/index.css`. Use the `ui/` components and tokens (`bg-sheet`, `text-ink-2`, `border-rule`, …), never raw colours.

## Conventions

- **Never call a real model or Neon in tests.** `tests/conftest.py` sets env before importing `app`. Use the `llm` fixture (scripted replies per agent: planner, data_analyst, verifier, writer, critic, chat) and the `search` fixture (fake DDGS).
- **No invented content.** Search tools return only real results; figures must appear in their source; a model outage raises `LLMUnavailable` or marks the agent `degraded`. Never substitute plausible-looking text.
- Every agent reports `status` / `model_used` / `error` in `agent_outputs[agent]`. Status values: `completed`, `completed_with_no_results`, `degraded`, `failed`.
- `ResearchRun.provider` holds the **model setting**: `per-agent` or an allowed model id from `MODEL_OPTIONS`. The API validates it. Agents of the same kind share a model (`AGENT_KINDS` in `llm.py`).
- Citation numbers come from `nodes.numbered_sources()`. The verifier, writer, stored `Source` rows (ordered by `created_at`) and chat all rely on that order.
- **Database:** don't change existing columns. `create_all` only adds missing tables, and Neon has live data. Put new per-agent data in `AgentRunLog.details` (JSON), or add a new table.
- Python: type hints, `logging.getLogger(__name__)`, ruff line length 110, no imports inside functions (except optional providers).
- JS: function components, Prettier (single quotes, width 110), oxlint with warnings as errors. Effects must not set state synchronously: remount with `key` instead.
- Mark known limits with `# shortcut: <limit>, <when to upgrade>` (or `//`).
- Commits: small, one logical step each, tests passing.

## Gotchas

- Windows: Vitest breaks when the shell's drive letter is lowercase (`e:\`). `npm test` goes through `scripts/vitest.mjs`, which fixes it.
- DuckDuckGo text search is blocked on some networks; the researcher and data analyst fall back to the news index. `TAVILY_API_KEY` is the reliable option.
- SSE replay, rate limits and the concurrency cap are in-process. Run a single backend instance (or move them to Redis).
- After changing backend dependencies, regenerate `requirements.txt`.
