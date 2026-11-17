# Implementation Plan - V1.1: Fix Agent Output Reliability & Report Conversation Continuation

This plan addresses V1.1 requirements from `artifacts/prompt3.md` along with user feedback:
1. Fixing and hardening Research Agent & News Agent output reliability, parallel state safety, structured agent results, error handling, and observability.
2. Adding report conversation continuation (follow-up chat) attached to each research report with DB persistence, smart context management, report modification capability, History page chat resumption, and a clear "New Research" trigger.

---

## User Review Adjustments Incorporated

1. **No Automatic Intent Detection Needed**: All input questions in the report chat box are processed directly as follow-up questions to the current report. A clear **"New Research Query"** button is provided to launch a fresh multi-agent research pipeline.
2. **History Page Chat Continuation**: Clicking any past research run in `HistoryPage.jsx` renders the persisted chat history for that run, allowing users to ask follow-up questions on past reports.
3. **Report Modifications via Chat**: If a follow-up question requests changes/modifications to the report (e.g. *"Rewrite the executive summary"*, *"Modify section 2 to emphasize cost risks"*), the fast chat handler modifies `Report.full_markdown` in the database and returns the updated report to instantly update the UI.

---

## Proposed Changes

### Backend Components

#### [MODIFY] [backend/app/agent/state.py](file:///e:/multi_agent_research_proj/backend/app/agent/state.py)
- Ensure `ResearchState` has explicit independent keys and robust reducers so parallel execution of `researcher`, `data_analyst`, and `news_agent` NEVER overwrites each other's outputs.
- Add `agent_outputs`: `Dict[str, Any]` reducer (`reduce_dict_update`) to store explicit structured results per agent node:
  ```python
  {
      "status": "completed" | "completed_with_no_results" | "failed",
      "summary": str,
      "findings": list,
      "sources": list,
      "error": str | None
  }
  ```

#### [MODIFY] [backend/app/agent/nodes.py](file:///e:/multi_agent_research_proj/backend/app/agent/nodes.py)
- Harden `research_node`, `data_analyst_node`, and `news_node`:
  - Catch and record search errors gracefully into the structured result payload without swallowing errors silently.
  - Return `status`: `"completed"`, `"completed_with_no_results"`, or `"failed"`.
  - Pass structured `agent_outputs` into `ResearchState`.
- Update `verifier_node` and `writer_node`:
  - Log exact findings count & sources count received from each agent before synthesizing reports.

#### [MODIFY] [backend/app/db/models.py](file:///e:/multi_agent_research_proj/backend/app/db/models.py)
- Add `ChatMessage` model linked to `ResearchRun`:
  - `id`: String(36) UUID primary key
  - `run_id`: String(36) ForeignKey("research_runs.id")
  - `role`: String(20) ("user" / "assistant")
  - `content`: Text
  - `created_at`: DateTime
- Add `chat_messages` relationship on `ResearchRun`.

#### [MODIFY] [backend/app/services/research_service.py](file:///e:/multi_agent_research_proj/backend/app/services/research_service.py)
- Enhance graph runner SSE broadcasts and `AgentRunLog` DB records:
  - Broadcast detailed agent execution status, metrics (`findings_count`, `sources_count`), and error messages over SSE.
  - Store full structured output and status in `AgentRunLog.details`.

#### [NEW] [backend/app/services/chat_service.py](file:///e:/multi_agent_research_proj/backend/app/services/chat_service.py)
- Implement follow-up conversation & report editing handler:
  - `get_chat_history(run_id)`
  - `process_followup_chat(run_id, user_message)`:
    1. Loads `ResearchRun`, `Report`, `Source` records, and previous `ChatMessage` history.
    2. Constructs prompt with the existing report, verified sources, and conversation history.
    3. Instructs LLM to answer follow-up question OR update report markdown if user asks to edit/modify the report.
    4. If report is modified, updates `Report.full_markdown` in DB and sets `updated_report` in return payload.
    5. Saves `user` and `assistant` messages to `ChatMessage` table.

#### [MODIFY] [backend/app/api/routes_research.py](file:///e:/multi_agent_research_proj/backend/app/api/routes_research.py)
- Add endpoints:
  - `GET /api/research/{run_id}/chat`: Returns chat message history.
  - `POST /api/research/{run_id}/chat`: Process follow-up user question or report modification.

---

### Frontend Components

#### [MODIFY] [frontend/src/components/AgentInspector.jsx](file:///e:/multi_agent_research_proj/frontend/src/components/AgentInspector.jsx)
- Display explicit agent status badges: `WAITING`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_NO_RESULTS`, `FAILED`.
- Render helpful fallback messages if an agent returns no results or fails (showing exact backend error message).
- Pass report updates down to ReportViewer.

#### [NEW] [frontend/src/components/ReportChat.jsx](file:///e:/multi_agent_research_proj/frontend/src/components/ReportChat.jsx)
- Interactive conversation section embedded below the research report:
  - Preset follow-up chips ("Explain in simpler terms", "Modify section 2 to emphasize startup risks", etc.).
  - Chat message bubble history with persistent DB sync.
  - "New Research Query" button to easily return to main prompt box.
  - Dynamically updates report in real-time if follow-up requests report edits.

#### [MODIFY] [frontend/src/components/ReportViewer.jsx](file:///e:/multi_agent_research_proj/frontend/src/components/ReportViewer.jsx)
- Embed `ReportChat` component directly beneath the report reader.

#### [MODIFY] [frontend/src/pages/HistoryPage.jsx](file:///e:/multi_agent_research_proj/frontend/src/pages/HistoryPage.jsx)
- Render `AgentInspector` and `ReportChat` for any clicked historical research run, allowing users to inspect past outputs and ask follow-up questions.

#### [MODIFY] [frontend/src/services/api.js](file:///e:/multi_agent_research_proj/frontend/src/services/api.js)
- Add `getReportChat(run_id)` and `sendReportChatMessage(run_id, message)` API client functions.

---

## Verification Plan

### Automated Tests
- Run `backend/test_graph.py` to verify:
  - Parallel agent execution returns valid `agent_outputs` without key overwrites.
  - Structured outputs include `status`, `summary`, `findings`, `sources`, `error`.
  - Failure cases log error status properly.

### Manual Verification
1. Launch full research query (`POST /api/research`).
2. Verify in UI (`AgentInspector` tabs) that `Researcher` and `News Agent` display `✓ Completed` with exact findings and sources counts, or explicit `No results` / `Failed` badges if applicable.
3. Open a completed report, type follow-up question *"Explain the final recommendation in simpler terms"*.
4. Verify chat responds fast using report context **without** triggering the full multi-agent workflow.
5. Type modification request: *"Modify executive summary to highlight startup risk"*. Verify report text updates dynamically.
6. Open History page, click a past run, verify previous follow-up chat messages load and user can continue asking follow-ups.
7. Click "New Research Query" button to launch fresh multi-agent research pipeline.
