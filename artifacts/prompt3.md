V1.1 – Fix Agent Output Reliability and Add Report Conversation Continuation

The project V1 is complete and deployed. Do NOT redesign the core multi-agent architecture or change the existing technology stack.

There are two main issues to fix:

1. Research Agent and News Agent outputs are unreliable or missing.
2. The application needs conversation continuation so users can ask follow-up questions about a generated research report.

The goal is to fix these issues cleanly while preserving the existing multi-agent workflow.

==================================================
PART 1: DEBUG AND FIX RESEARCH/NEWS AGENT OUTPUTS
==================================================

Current issue:

During some research runs, the Research Agent and/or News Agent appear to execute but do not produce usable or visible output. However, the Writer still generates a final report.

This must be investigated and fixed at the actual backend/workflow level.

Do not solve this by generating fake frontend output.

A. TRACE THE COMPLETE AGENT EXECUTION

For every research run, log and persist:

- Agent name
- Agent start event
- Agent completion event
- Agent status
- Input received by the agent
- Structured output returned by the agent
- Number of findings produced
- Number of sources collected
- Errors or exceptions
- Execution time

Specifically investigate the complete path:

Planner
   ↓
Research Agent / News Agent
   ↓
LangGraph shared state
   ↓
Verifier / Writer
   ↓
Database persistence
   ↓
SSE event
   ↓
Frontend agent inspection UI

Determine exactly where the output is being lost or becoming empty.

Possible areas to investigate include:

- Incorrect LangGraph state updates
- State keys being overwritten by parallel agents
- Parallel execution merge/reducer issues
- Agent returning a different schema than expected
- Empty tool/search results not being handled
- Exceptions being swallowed
- Async task completion issues
- Agent output not being persisted
- SSE completion event being emitted before output is stored
- Frontend reading the wrong field or stale run data

Do not assume the cause. Inspect the actual implementation and fix the real issue.

B. PARALLEL AGENT STATE SAFETY

Research Agent, Data Analyst, and News Agent may execute in parallel.

Ensure that parallel agent outputs do not overwrite each other in the shared LangGraph state.

Use clear independent state fields, for example:

research_output
data_analysis_output
news_output

or an appropriate structured collection with a correct merge/reducer strategy.

A result from one specialist agent must never accidentally replace the result of another specialist agent.

C. REQUIRE EXPLICIT STRUCTURED AGENT OUTPUTS

Each specialist agent should return a predictable structured result.

Research Agent:

{
  "status": "completed",
  "summary": "...",
  "findings": [...],
  "sources": [...],
  "error": null
}

News Agent:

{
  "status": "completed",
  "summary": "...",
  "developments": [...],
  "sources": [...],
  "error": null
}

If an agent genuinely finds no useful information, return an explicit completed result such as:

{
  "status": "completed",
  "summary": "No sufficiently relevant findings were identified.",
  "findings": [],
  "sources": [],
  "error": null
}

Do not return null or silently disappear.

If an error occurs:

{
  "status": "failed",
  "summary": null,
  "findings": [],
  "sources": [],
  "error": "Actual error message"
}

D. DO NOT ALLOW SILENT AGENT FAILURES

If Research Agent or News Agent fails:

- Mark that agent as FAILED in the database.
- Emit an SSE event indicating failure.
- Show the failure in the frontend.
- Log the actual backend error.
- Do not display the agent as successfully completed with an empty output.

The UI should distinguish:

WAITING
RUNNING
COMPLETED
COMPLETED_WITH_NO_RESULTS
FAILED

E. WRITER INPUT VALIDATION

Before the Writer generates the report, log exactly what evidence it receives from:

- Research Agent
- Data Analyst
- News Agent
- Verifier

The Writer should not silently receive empty research/news outputs without visibility.

For debugging and observability, persist evidence counts such as:

Research findings: 12
Research sources: 8

Data findings: 5
Data sources: 4

News developments: 6
News sources: 6

Verified claims: 18

This information should also be available in the run details.

F. FRONTEND DISPLAY

The Research Agent and News Agent tabs must display actual backend output.

If completed successfully:

✓ Completed
12 findings
8 sources

If no results:

✓ Completed – No relevant results found

If failed:

✗ Failed

Error:
[meaningful error message]

Never show an empty agent panel without explaining the actual state.

==================================================
PART 2: ADD REPORT CHAT / CONVERSATION CONTINUATION
==================================================

After a final research report has been generated, the user should be able to continue the conversation naturally.

Example:

Initial question:

"Should India prioritize renewable energy, nuclear energy, or both?"

The system generates a research report.

Then the user asks:

"What would change if financing constraints became much more severe?"

The system should understand that this is a follow-up to the existing report and respond in the context of:

- The original research question
- The generated report
- Previous conversation messages
- Relevant verified findings and sources where appropriate

This must be a true conversation continuation feature.

A. ADD CHAT UI TO THE REPORT PAGE

Below or alongside the generated report, add a clear section such as:

Ask about this report

Input:
"Ask a follow-up question..."

Example questions:

- Explain this recommendation in simpler terms
- Compare the two options in more detail
- What would change under a different assumption?
- What are the biggest uncertainties?
- Summarize this for a policymaker

Display the conversation as a normal chat interface:

User:
...

Assistant:
...

User:
...

Assistant:
...

B. CONTEXT STRATEGY

Each research run should have a conversation associated with it.

The follow-up request must be associated with the existing:

run_id / research_id

The backend should retrieve:

1. Original research question
2. Final report
3. Relevant verified findings
4. Relevant source metadata
5. Previous conversation messages

Do not send unlimited conversation history forever.

Implement a reasonable context strategy:

Recent messages:
Keep the most recent relevant conversation messages.

Stable research context:
Use the original question and final report.

Evidence context:
Retrieve relevant verified findings/sources when needed.

The system should answer follow-up questions based on the existing research context whenever possible.

C. FOLLOW-UP CHAT SHOULD NOT RERUN THE ENTIRE MULTI-AGENT PIPELINE BY DEFAULT

This is important.

A normal follow-up question such as:

"Can you explain the financing challenges more simply?"

should NOT trigger:

Planner
Researcher
Data Analyst
News Agent
Verifier
Writer
Critic

again.

Instead:

User Follow-up
      ↓
Conversation Context
      ↓
Report Context + Relevant Findings
      ↓
Follow-up LLM Response
      ↓
Save Conversation Message

This makes the application faster and more natural.

D. WHEN NEW RESEARCH IS REQUIRED

If the user asks for information that requires new research, such as:

"What happened after August 2026?"
"Find recent policy changes since this report was generated."
"Compare this with the latest government announcement."

then the system should detect that the existing report may not be sufficient.

In this case, provide an explicit option or route to:

Update Research

Do not automatically rerun the full workflow for every follow-up message.

A possible response:

"This question requires information beyond the existing research. Would you like me to run an updated research analysis?"

If the user confirms, create a new research/update run while preserving the conversation relationship.

E. CHAT PERSISTENCE

Persist chat messages in PostgreSQL.

Suggested conceptual structure:

ResearchRun
- id
- original_query
- final_report
- status
- created_at

Conversation
- id
- research_run_id
- created_at

Message
- id
- conversation_id
- role
- content
- created_at

A user should be able to:

- Reload the page
- Open a previous research run
- Continue the conversation
- See previous follow-up messages

F. CHAT RESPONSE RULES

For follow-up questions, the assistant should:

- Use the existing report as primary context.
- Preserve the meaning of the previous research.
- Clearly distinguish report-backed facts from new reasoning.
- Avoid inventing sources.
- If citing a source from the report, use the existing verified source metadata.
- State uncertainty when the report does not contain enough evidence.
- Ask to update/research further when genuinely new external information is required.

G. OPTIONAL RESPONSE MODES

If practical, support simple user intents such as:

Explain:
"Explain the report simply."

Compare:
"Compare renewable and nuclear energy."

Challenge:
"What is the strongest argument against the recommendation?"

Scenario:
"What changes if electricity demand is lower than projected?"

Summarize:
"Give me a 5-bullet summary."

These should all work using the existing research context without rerunning the full multi-agent system.

==================================================
PART 3: DO NOT BREAK EXISTING FUNCTIONALITY
==================================================

Keep unchanged:

- Core multi-agent architecture
- LangGraph orchestration
- Planner
- Research Agent
- Data Analyst
- News Agent
- Verifier
- Writer
- Critic
- Parallel execution
- Conditional routing
- Critic revision loop
- Source verification
- FastAPI backend
- React + JavaScript frontend
- PostgreSQL
- SSE for research workflow progress
- Existing deployment architecture

Do not add Docker, Deep Agents, MCP, pgvector, or unnecessary new infrastructure.

==================================================
PART 4: TESTING REQUIREMENTS
==================================================

Before considering the changes complete, test at least:

Test 1:
A broad research question requiring Research + Data + News agents.

Verify:
- All agents return visible structured output.
- No parallel agent overwrites another output.
- Sources are persisted.
- Writer receives the expected evidence.

Test 2:
Force or simulate an agent failure.

Verify:
- Failed status is visible.
- Error is logged and persisted.
- The UI does not falsely show success.

Test 3:
Generate a report, then ask:

"Explain the final recommendation in simpler terms."

Verify:
- The follow-up uses the existing report.
- The full multi-agent pipeline is not rerun.

Test 4:
Ask:

"What would change if financing constraints became much more severe?"

Verify:
- The answer uses the existing report context.
- The conversation continues naturally.

Test 5:
Ask for genuinely new/latest information.

Verify:
- The system identifies that new research is required.
- It does not hallucinate that the old report contains new information.

==================================================
FINAL GOAL
==================================================

After this V1.1 update, the application should reliably demonstrate:

1. Real multi-agent execution with visible outputs from every agent.
2. Reliable handling of parallel agent state.
3. No silent Research or News Agent failures.
4. Clear debugging and observability for agent execution.
5. A persistent chat experience attached to each research report.
6. Natural follow-up questions using the generated report as context.
7. New research only when genuinely required.
8. No unnecessary changes to the existing architecture or stack.

This should be treated as a reliability and product-experience enhancement to V1, not a redesign.