# Test Report

## Baseline (Phase 3, before any refactor), 2026-11-17

Characterization tests written against the original code on `refactor/restructure-and-improve` @ `a393b3d`. No test makes a real AI call or touches Neon: `tests/conftest.py` blanks `OPENROUTER_API_KEY`, uses a temp SQLite DB, and patches `ChatOpenAI.invoke` and DuckDuckGo to offline fakes.

| Suite | Command | Result |
|---|---|---|
| Backend (pytest) | `cd backend && uv run pytest` | **34 passed, 8 xfailed** |
| Frontend (Vitest) | `cd frontend && npm test` | **13 passed, 1 expected fail** |

The expected failures are known bugs from [ANALYSIS.md §7](ANALYSIS.md), written as strict `xfail` / `it.fails`. Fixing a bug flips its test to passing, and it then stays as a regression test.

| Test | Bug |
|---|---|
| `test_health` | B1 `/health` 500 |
| `test_sources_are_saved` | B2 sources never saved |
| `test_empty_web_search_returns_nothing` | B3 fabricated search results |
| `test_data_analysis_never_invents_figures` | B3 fabricated statistics |
| `test_sse_replays_events_to_late_subscribers` | B5 SSE events lost before subscribe |
| `test_non_exact_critic_approval_completes_run` | B7 run stuck "running" |
| `test_timestamps_are_utc_aware` | B12 naive timestamps |
| `test_chat_history_unknown_run_is_404` | B19 |
| `ReportChat › B26` | **B26 (new)**: a chat message sent before the history finishes loading is wiped when the history arrives |

What the baseline pins (feature checklist): create run → full 7-agent pipeline → plan / logs / report persisted; response shapes; blank query and history limit validation; 404s; history order and report flags; report by id; chat answers, persistence, report editing (and ignoring tiny edits); writer failure still yields a run record; critic REVISE loop (writer ×2, forced approve); critic feedback reaches the writer; planner fallback plan and agent filtering; researcher mapping; news → web fallback; figure extraction; keyword shortening; JSON parsing; mock LLM without key; SSE broadcast. Frontend: API client (URLs, bodies, errors, SSE parse/close); Dashboard submit → live events → final report; launch error banner; example prompts; ReportChat history / send / edit / error; ReportViewer markdown / copy / sources / export.

Environment note: on Windows, Vitest breaks when the shell's drive letter is lower-case (`e:\`). `npm test` goes through `scripts/vitest.mjs`, which normalises it.
