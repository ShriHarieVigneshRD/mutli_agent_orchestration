# Changelog

## 2.0.0: restructure, fixes, redesign (branch `refactor/restructure-and-improve`, 2026-11-17)

Planned in [PLAN.md](PLAN.md), from the problems in [ANALYSIS.md](ANALYSIS.md), and verified in [TEST_REPORT.md](TEST_REPORT.md).

### Behaviour changes you will notice
- **No more invented sources or statistics.** The old search tool fabricated two "Reuters/Bloomberg" links whenever search came back empty, and the data analyst made up figures such as "30% AI task automation" for any topic. Now an empty search is reported as *No results*, and figures come only from real search results (each with its link).
- **Model choice:**
  - The navbar dropdown of 6 models (9 of 10 model IDs in the code no longer existed) is replaced by a picker in the composer: **Per-agent** (four kinds of agent, each on its own model) or **One model for all** (pick from live free models).
  - Every agent falls back through 3 shared tiers ending at `openrouter/free`.
  - The API now rejects unknown or paid model ids.
- **Honest failures.**
  - If no model can write the report, the run fails with the reason (e.g. "daily limit used up") instead of producing a stub.
  - A verifier outage lists claims as *not verified* instead of a made-up 85 %.
  - The critic says when it could not review.
- **Revision limit:** `MAX_REVISIONS` now means the number of rewrites allowed. The default is 1, which is the same number of model calls as before; the old `max_revisions=2` only ever allowed 1.
- **Runs have URLs** (`/runs/:id`). The workspace no longer shows the run inline; History opens runs on their own page.
- **History API** returns `{runs, total, limit, offset}` instead of a bare list.
- **Removed:** the "Hide/Show graph" toggle (the routing slip is always shown and compact), the separate "New Research Query" button inside the chat (use **New research** in the header), and the dev-only scripts `backend/test_graph.py` (made real model calls) and `backend/test_db.py`, both replaced by the pytest suite.

### Added
- 4-tier model gateway with per-kind models and single-model mode, `/api/models`, and a model map in the UI.
- Abuse protection:
  - per-IP limits (`RESEARCH_RATE_LIMIT_PER_HOUR=6`, `CHAT_RATE_LIMIT_PER_MIN=10`, returning 429 with `Retry-After`);
  - `MAX_CONCURRENT_RUNS`;
  - length caps on questions and chat messages;
  - CORS from `CORS_ORIGINS`;
  - Render runs with proxy headers so limits see real IPs.
- Live progress: real "started" events, replay for late or reconnecting clients, stream closes when done, polling fallback, server timestamps.
- Routing slip: per-agent status, model used, fallback marker, timing, and the critic's "returned to the writer" mark. Each agent's output has its own view.
- Citation chips in reports, linked to numbered sources.
- Undo for chat edits of the report (new `report_versions` table) and delete runs from History.
- Offline demo mode built from real search results, clearly labelled.
- Light and dark themes, a responsive layout (390 / 820 / 1440 px), skip link, keyboard tabs, and loading / empty / error-with-retry states everywhere.
- History paging ("Load more" with a total).
- Tests: pytest (102 tests, 95 % coverage), Vitest (41), Playwright e2e (7). Ruff, pyright, Prettier and oxlint (warnings as errors) are all configured.
- `CLAUDE.md`, `.env.example` files, `.interface-design/system.md`, screenshots.

### Fixed
Numbers refer to ANALYSIS §7.
- B1 `/health` 500.
- B2 sources never saved.
- B3/B4 fabricated evidence; dead DuckDuckGo package (now `ddgs`, with ad links dropped and a news-index fallback).
- B5/B20 lost SSE events, and the stream never closing.
- B6 dead models.
- B7 runs stuck "running" when the critic said "Approved".
- B8 chat blocking the server.
- B9 data analyst seeing no data.
- B10 status badges never showing.
- B11 no "started" events.
- B12 timestamps 5 h 30 m off.
- B13 mobile and tablet overflow.
- B14 revision off-by-one.
- B15 stale edited report across runs.
- B16 incomplete reset.
- B17 failed runs shown as complete.
- B18 event labels and the fake "connected" badge.
- B19 404s.
- B21 invented references.
- B22 runs stuck after a restart.
- B23 `.env` only read from `backend/`.
- B24 (new) arbitrary model ids, including paid ones.
- B25 (new) History capped at 20.
- B26 (new) chat history wiping messages sent while it loaded.

### Changed (no behaviour change)
- Backend split into `prompts.py`, `offline.py`, `serializers.py`, `deps.py`, `routes_meta.py`. One shared helper for the search agents. SQLAlchemy 2.0 typed models with identical DDL.
- Frontend rebuilt around `pages/`, `hooks/`, `lib/` and `components/ui/`. The 501-line inspector and three hand-written copies of the model list are gone.
- Dependencies:
  - removed `langchain`, `langchain-groq`, `langchain-google-genai`, `duckduckgo-search`, `clsx`, `tailwind-merge` and the direct `python-dotenv`;
  - `httpx` moved to dev;
  - security bumps: vite 8.3.8, certifi, langgraph-sdk, urllib3.
- `requirements.txt` is generated from `uv.lock`.
- Dead template files removed; the previous agent's notes moved to `docs/archive/`.

### Upgrade notes
- **Render:** the start command changed (proxy headers) and a health check was added. If the service was configured in the dashboard, copy the command from `render.yaml`. Set `CORS_ORIGINS` to the Vercel URL.
- **Env:** `DEFAULT_MODEL=meta-llama/llama-3.3-70b-instruct:free` (in the old `.env`) no longer exists. The app warns and uses the first offered model; update it, or delete it to use the default. The model and limit variables are listed in `backend/.env.example`.
- **Neon:** the first start creates `report_versions`; nothing else changes.
