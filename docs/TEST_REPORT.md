# Test Report

All results below come from 2026-11-17 on branch `refactor/restructure-and-improve`. **No test calls a real language model or touches Neon.**
- The backend suite blanks `OPENROUTER_API_KEY`, uses a temp SQLite file, and patches `ChatOpenAI.invoke` and DuckDuckGo to offline fakes.
- The e2e suite starts its own backend in offline mode with `SEARCH_PROVIDER=off`.

## 1. Results

| Gate | Command | Baseline (Phase 3) | Final |
|---|---|---|---|
| Backend lint | `cd backend && uv run ruff check app tests` | not configured (ad hoc: 11 unused imports, 3 unused variables) | **All checks passed** |
| Backend format | `uv run ruff format --check app tests` | 14 files unformatted | **25 files formatted** |
| Backend types | `uv run pyright` | 23 errors | **0 errors** |
| Backend tests | `uv run pytest --cov` | 34 passed, 8 xfailed (known bugs) | **102 passed, 95 % coverage** |
| Frontend lint | `cd frontend && npm run lint` (oxlint `--deny-warnings`) | 0 errors, 10 warnings | **0 errors, 0 warnings** |
| Frontend format | `npx prettier --check .` | not configured | **clean** |
| Frontend unit | `npm test` / `npm run test:coverage` | 13 passed, 1 expected fail (B26) | **41 passed, 84 % statements / 88 % lines** |
| End-to-end | `npm run test:e2e` (Playwright, system Edge) | none | **7 passed** |
| Build | `npm run build` | 447 kB JS / 54 kB CSS | **440 kB JS (137 kB gzip) / 32 kB CSS** |
| Dependency audit | `npm audit`, `uvx pip-audit -r requirements.txt` | 2 high (vite, source-map-js) | **0 vulnerabilities** in both (after bumping vite, certifi, langgraph-sdk, urllib3) |

Every bug that was a strict `xfail` in the baseline now passes and stays as a regression test: B1, B2, B3 (×2), B5, B7, B12, B19, B26.

## 2. What the suites cover

**Backend (`backend/tests`, 102 tests)**
- `test_api.py`:
  - full pipeline;
  - response shapes, validation and 404s;
  - history order and paging;
  - report by id;
  - chat answers, persistence, report edits (tiny edits ignored), off the event loop, honest 503 on model outage;
  - `/health`; `/api/models`;
  - sources saved in citation order;
  - critic "Approved"; UTC timestamps; per-desk status and model in logs;
  - writer outage fails the run with a reason;
  - offline demo report;
  - SSE replay and close;
  - interrupted-run recovery.
- `test_agents.py`:
  - critic routing and revision limit; feedback reaching the writer; critic decisions and outage;
  - planner fallback;
  - researcher mapping, no results, news fallback; ad links dropped; search off;
  - data analyst keeps only figures found in sources, with regex fallback;
  - figure extraction;
  - numbered sources;
  - verifier source mapping and outage; writer gets numbered URLs;
  - keyword shortening; JSON parsing (fences, prose, non-objects);
  - SSE broadcast, replay and bounded history.
- `test_llm_gateway.py`:
  - per-kind chains; shared primaries per kind; single-model mode;
  - fall-through on errors and empty replies;
  - DAILY_LIMIT / RATE_LIMITED / ALL_FAILED;
  - offline mode;
  - model-setting resolution, including legacy `provider`; unknown and paid models rejected (API and service);
  - stale `DEFAULT_MODEL`.
- `test_guards.py`:
  - research and chat rate limits with `Retry-After`;
  - concurrency cap and slot release;
  - query and chat length caps;
  - CORS allowlist.
- `test_features.py`:
  - undo chat edits step by step;
  - no versions without edits;
  - delete removes everything; 404s; 409 while a run is in progress.

**Frontend (`frontend/src/**/*.test.*`, 41 tests)**
- API client: bodies for both model modes, error detail and status, network failure, every endpoint, and the SSE lifecycle (reset on reconnect, close on finish).
- Format helpers and the pure run-state reducers (`applyEvent`, `nodesFromLogs`).
- `RoutingSlip` (8 rows, stamps, selection, fallback marker, revision mark, "Not run") and `WireLog`.
- `ModelPicker` (mode switch, model list).
- `ReportViewer` (copy, sources, citation chips, export filename, undo, arrow-key tabs).
- `ReportChat` (history, send, edit banner, error, B26).
- Pages:
  - Workspace: start a run, length guard, error, examples, recent runs.
  - Run page: live run → report, finished run without stream plus undo, failed run, load error.
  - History: search, delete, load more, error-not-empty.
- `ThemeToggle`.

**End-to-end (`frontend/e2e/app.spec.js`, 7 tests)**
- The full journey: compose → model picker → run finishes → report → desks → chat → reload restores → History → delete with confirmation.
- The theme survives a reload, plus a dark-theme capture.
- **No horizontal overflow at 390, 820 and 1440 px** on the Workspace, Run and History pages.
- Skip link and arrow-key tabs.
- Every test fails on any browser console error or warning.

## 3. Feature checklist walkthrough (ANALYSIS §4)

✅ means verified by automated tests. 👁 means also checked by hand in Edge at 390 / 820 / 1440 px, in light and dark, with real DuckDuckGo search in offline-LLM mode.

| # | Feature | Status | Notes |
|---|---|---|---|
| F1 | Create run, background pipeline | ✅ 👁 | Now also validates length and the model allowlist, and enforces rate limits |
| F2 | Run detail | ✅ 👁 | Sources now saved (B2); adds `version_count` |
| F3 | SSE progress | ✅ 👁 | Real `<node>_started` events, replay, closes when done |
| F4 | Chat history | ✅ | 404 for unknown runs |
| F5 | Chat answers and edits the report | ✅ 👁 | Edits can now be undone |
| F6 | History list | ✅ 👁 | **Response shape changed** from a list to `{runs, total, limit, offset}` (paging) |
| F7 | Report by id | ✅ | Unchanged |
| F8 | `/health` | ✅ | Fixed (was 500) |
| F9 | Graph with parallel gatherers and critic loop | ✅ | Same topology |
| F10 | Planner and per-agent queries | ✅ 👁 | Queries shown on the planner desk |
| F11 | Researcher (Tavily / DuckDuckGo) | ✅ (fakes) 👁 | Tavily path not exercised (no key) |
| F12 | News agent with web fallback | ✅ 👁 | |
| F13 | Data analyst | ✅ 👁 | **Changed:** own search, figures only from real sources |
| F14 | Verifier | ✅ 👁 | Claims cite source numbers; outage gives "not verified" instead of a fake 85 % |
| F15 | Writer | ✅ | Cites numbered sources |
| F16 | Critic | ✅ | Any decision except REVISE approves |
| F17 | LLM with fallback, offline mock | ✅ (fakes) 👁 | 4-tier chains, two modes |
| F18 | Persistence (Postgres / SQLite) | ✅ (SQLite) | Neon not exercised in tests; schema unchanged plus one new table |
| U1 | Header navigation | ✅ 👁 | Model selector moved into the composer (it only affects the next run) |
| U2 | Composer: auto-grow, examples, submit state | ✅ 👁 | Adds Ctrl/Cmd+Enter and a character counter |
| U3 | Error banner | ✅ 👁 | Inline `ErrorNotice` with the API's reason |
| U4 | Live workflow diagram | ✅ 👁 | Now the routing slip. **The show/hide toggle is gone:** the slip is always visible and compact |
| U5 | Live event log | ✅ 👁 | Collapsible, shows server timestamps |
| U6 | Per-agent inspector | ✅ 👁 | Slip rows replace the 9 tabs; every desk has its own view |
| U7 | Report: tabs, copy, export | ✅ 👁 | Plus citation chips and undo |
| U8 | Report chat | ✅ 👁 | "New Research Query" is now the header's / run page's "New research" |
| U9 | History: list, search, open | ✅ 👁 | Opens `/runs/:id`. Adds delete, load more, error state |
| U10 | SPA routing, `VITE_API_BASE_URL`, dev proxy | ✅ | `vercel.json` unchanged |

## 4. Known limitations

- **No real model calls this session** (your OpenRouter quota was used up). The prompts, the 4-tier chain and JSON handling are tested with fakes. Watch the first real run after the quota resets, especially whether each free model returns the JSON the planner, verifier and critic expect (non-JSON replies fall back honestly). OpenRouter rotates free models, so the defaults live in env vars.
- **DuckDuckGo text search is blocked from this network.** Only Bing answered, and only for short queries; news search works. The researcher and data analyst fall back to the news index, and Render's network may do better. For reliable search, set `TAVILY_API_KEY` (free tier).
- **Neon was not touched.** The first deploy creates the new `report_versions` table automatically. Old runs show without per-desk status or model (that data didn't exist), and their old `provider` values show as-is.
- **Single process:** rate limits, the concurrency cap and SSE replay live in memory (marked `shortcut:` in the code). That's fine for one Render instance; use Redis if you scale out. A restart marks in-flight runs as failed.
- Running research can't be cancelled (considered and not proposed, see PLAN §6).
- History search filters the runs already loaded (the UI says so). The frontend is plain JavaScript; type checking covers the backend only.
- The e2e suite drives Microsoft Edge (`channel: 'msedge'`). On a machine without Edge, change the channel or run `npx playwright install chromium`.
- Fonts load from Google Fonts. Offline, the UI falls back to system fonts.

## 5. Phase 3 baseline (for reference)

The characterization tests were written against the original code at `a393b3d`: backend 34 passed + 8 strict xfail, frontend 13 passed + 1 expected fail. Intentional behaviour changes are listed in [CHANGELOG.md](CHANGELOG.md). The tests that pinned them were updated in the same commit as the change and cite the bug number.
