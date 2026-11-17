# Final Implementation Change: Multi-Agent Visibility, Source Verification and Professional Report Formatting

This is the final functional enhancement before deployment.

Do NOT change the existing core multi-agent architecture, agent responsibilities, overall technology stack, database architecture, request flow, or deployment plan.

The existing core workflow must remain:

```text
Planner
   ↓
┌────────────┬──────────────┬───────────┐
↓            ↓              ↓
Researcher   Data Analyst   News Agent
└────────────┴──────────────┴───────────┘
                     ↓
                  Verifier
                     ↓
                   Writer
                     ↓
                   Critic
                 ↙        ↘
             Revise      Approve
                 ↓          ↓
                 Final Report
```

The purpose of this enhancement is to make the multi-agent orchestration clearly visible to the user and improve the trustworthiness and presentation quality of the generated research report.

Do not add unnecessary new agents or redesign the LangGraph workflow.

---

# 1. Make the Multi-Agent Workflow Visible in the Frontend

The user should not only see the final report.

They should be able to clearly understand:

* Which agent executed
* What each agent did
* What output each agent produced
* What sources each research-related agent used
* What the Verifier accepted, flagged, or rejected
* Whether the Critic requested revision
* How many revision cycles occurred
* The final execution path through the workflow

The frontend should visually demonstrate that this is a real multi-agent system rather than a single LLM generating one large answer.

---

# 2. Live Agent Execution View

During research execution, display the current workflow status in real time using the existing SSE-based event streaming architecture.

Example:

```text
Research Run

✓ Planner                    Completed
  └─ Created 6 research tasks

✓ Research Agent             Completed
  └─ 18 sources collected | 42 findings

⏳ Data Analyst              Running
  └─ Performing quantitative analysis...

⏳ News Agent                Running
  └─ Searching recent developments...

○ Verifier                   Waiting
○ Writer                     Waiting
○ Critic                     Waiting
```

Requirements:

* Agent statuses must update live.
* Clearly distinguish:

  * Waiting
  * Running
  * Completed
  * Revision Required
  * Failed
* Display meaningful progress messages where available.
* Do not fake progress. Progress information must come from actual backend workflow events.
* If specialist agents run in parallel, the UI should visibly show that multiple agents are running concurrently.

---

# 3. Add a Workflow / Agent Inspection Interface

After or during execution, provide a clear interface for inspecting individual agent outputs.

Recommended structure:

```text
[ Overview ]
[ Planner ]
[ Researcher ]
[ Data Analyst ]
[ News Agent ]
[ Verifier ]
[ Writer ]
[ Critic ]
[ Final Report ]
```

Each tab or section should display actual persisted agent output.

Do not generate separate summaries solely for the UI if the actual agent output can be displayed directly.

---

# 4. Planner Output

The Planner view should display:

* Original user research question
* Research objective
* Scope
* Research plan
* Generated tasks
* Which specialist agents were assigned
* Task routing decisions

Example:

```text
Research Objective
Understand the impact of AI coding agents on entry-level software engineering jobs.

Research Plan

1. Analyze current AI coding capabilities
2. Examine productivity evidence
3. Analyze industry adoption
4. Research employment trends
5. Identify limitations and counterarguments
6. Synthesize findings

Agent Routing

✓ Research Agent
✓ Data Analyst
✓ News Agent
```

Use proper headings, spacing, lists, and visual hierarchy.

---

# 5. Research Agent Output

The Researcher view should show structured findings rather than one large unformatted block of text.

For each major finding, display:

```text
Finding

Claim or key finding:
...

Evidence:
...

Source:
Source title

Publisher:
...

Publication date:
...

Source link:
View Source

Confidence:
High / Medium / Low
```

The source link must be clickable and open the original source in a new browser tab.

Do not display fake URLs.

If a valid source URL is unavailable, clearly mark the finding as:

```text
Source URL unavailable
```

The source URL must be stored and passed through the backend rather than being generated or reconstructed by the frontend.

---

# 6. Data Analyst Output

The Data Analyst view should clearly separate:

* Input data
* Calculations performed
* Quantitative comparisons
* Assumptions
* Derived conclusions

Example:

```text
Quantitative Analysis

Metric Comparison

Metric                    Option A    Option B
------------------------------------------------
Projected Capacity         ...         ...
Estimated Cost             ...         ...

Calculation Method
...

Assumptions
...

Conclusion
...
```

Important rule:

The Data Analyst must distinguish between:

1. Directly sourced numerical data
2. Calculated or derived values
3. Assumptions

Never present an LLM-generated estimate as if it were directly sourced factual data.

Where a numerical value comes from an external source, provide the associated source link.

---

# 7. News Agent Output

The News Agent should display recent developments in a timeline or structured card format.

For each development:

```text
Date

Headline

Summary

Why It Matters

Source:
Publisher / Source Title

View Original Source
```

Every news item must contain a valid original source URL.

The News Agent should not provide only a source name without a usable source link.

---

# 8. Strengthen Source Handling and Verification

This is a critical requirement.

The current system must not allow the final report to contain unsupported citation placeholders such as:

```text
[IEA 2024]
[CEA 2024]
[BloombergNEF 2024]
```

unless the system has actually collected and stored the corresponding source information.

Each source record should contain, where available:

```text
source_id
title
publisher
url
publication_date
retrieval_date
source_type
relevant_excerpt
```

The system should preserve source information throughout the workflow:

```text
Research / News Agent
        ↓
Structured Findings + Source Metadata
        ↓
Evidence / Shared Graph State
        ↓
Verifier
        ↓
Writer
        ↓
Final Report + Source References
```

Do not lose source URLs between agents.

---

# 9. Strengthen the Verifier Agent

The Verifier must explicitly verify source links and evidence quality.

For every important factual claim, the Verifier should check:

### A. Source Presence

Does the claim have an associated source?

### B. Source URL Validity

Is there an actual URL associated with the source?

The Verifier should reject citation labels that do not map to a real collected source record.

For example:

```text
Claim:
"India's renewable capacity will reach X GW."

Citation:
[IEA 2024]
```

The Verifier should check whether:

* The source was actually collected.
* A source title exists.
* A valid URL exists.
* The relevant evidence supports the claim.

If the source record cannot be found, the claim must be flagged.

---

### C. Evidence Support

The Verifier should determine whether the available source evidence actually supports the claim.

A source merely existing is not enough.

The verification result should distinguish:

```text
SUPPORTED
PARTIALLY_SUPPORTED
WEAKLY_SUPPORTED
UNSUPPORTED
SOURCE_LINK_MISSING
```

Example:

```text
Claim:
...

Verification Status:
SUPPORTED

Source:
...

Source Link:
View Original Source

Reason:
The source directly supports the numerical value and time period stated.
```

Or:

```text
Verification Status:
SOURCE_LINK_MISSING

Reason:
A citation label was provided, but no corresponding source URL was collected.

Action:
Do not use this claim in the final report until verified.
```

---

# 10. Unsupported Claims Must Not Silently Reach the Final Report

The Writer should primarily receive verified evidence.

Claims marked as:

```text
UNSUPPORTED
SOURCE_LINK_MISSING
```

must not be presented in the final report as established facts.

The workflow may:

1. Remove the claim, or
2. Qualify it appropriately if the information is still useful but uncertain, or
3. Route the issue back for additional research if the existing graph logic supports revision.

Do not invent citations to make unsupported claims appear credible.

---

# 11. Verifier Frontend View

The Verifier tab should make the system's verification work visible.

Example:

```text
VERIFICATION SUMMARY

✓ 31 Claims Supported
⚠ 4 Claims Partially Supported
✗ 2 Claims Rejected
🔗 3 Source Links Missing

Issues Found

1. Claim:
...

Status:
SOURCE_LINK_MISSING

Reason:
No valid source URL was collected.

Action:
Excluded from final report.

-------------------------

2. Claim:
...

Status:
PARTIALLY_SUPPORTED

Reason:
The source supports the general trend but not the exact numerical projection.

Action:
Claim wording was softened.
```

This should use actual verification results from the backend, not fabricated UI statistics.

---

# 12. Writer Output

The Writer view should display:

* Draft report
* Report generation status
* Evidence/finding count used
* Revision number

If a revision occurs:

```text
Draft Version: 1
Critic Decision: REVISE

Draft Version: 2
Critic Decision: APPROVE
```

The user should be able to understand that the report was generated, evaluated, and potentially revised.

---

# 13. Critic Output

The Critic view should clearly display its decision.

Example:

```text
CRITIC DECISION

REVISE
```

Then:

```text
Issues Identified

1. The recommendation is stronger than the available evidence.
2. Cost comparisons require additional qualification.
3. Counterarguments need more coverage.

Required Actions

→ Strengthen uncertainty discussion
→ Add additional evidence
→ Revise recommendation wording

Revision Round: 1
```

After the final review:

```text
CRITIC DECISION

APPROVED

Reason:
The report sufficiently answers the research question and major claims are supported by verified evidence.
```

The actual decision and revision feedback must come from the Critic agent output.

---

# 14. Add a Final Workflow History / Execution Timeline

After completion, display the actual execution path.

Example:

```text
Planner
   │
   ▼
Parallel Specialist Agents
   │
   ▼
Verifier
   │
   ▼
Writer
   │
   ▼
Critic
   │
   ├── REVISE ──────────────┐
   │                        │
   └── APPROVE ◄────────────┘
            │
            ▼
       Final Report
```

For the actual UI, show:

* Execution order
* Parallel stages
* Start/completion timestamps where available
* Revision rounds
* Final status

This can be implemented as a visual timeline or workflow diagram, but it should accurately reflect the actual execution rather than displaying a static fake diagram.

---

# 15. Professional Final Report Formatting

The final report must not be displayed as one large plain-text block.

Render the report with strong professional formatting and visual hierarchy.

Requirements:

## Main Title

Use a large, prominent heading.

Example:

```text
India's Long-Term Energy Strategy:
Renewables, Nuclear, or Both?
```

---

## Major Sections

Use clearly larger headings such as:

```text
# Executive Summary

# Research Methodology

# Current Landscape

# Key Findings

# Data and Trends

# Recent Developments

# Counterarguments and Limitations

# Comparative Analysis

# Final Recommendation

# Sources and References
```

---

## Subsections

Use smaller but clearly visible headings.

Example:

```text
## Renewable Energy

### Cost Trends
```

---

## Body Formatting

Support proper rendering of:

* Paragraphs
* Bullet lists
* Numbered lists
* Tables
* Bold text
* Important findings/callouts
* Blockquotes where appropriate
* Source references

Use a consistent typography hierarchy and sufficient whitespace.

The report should look like a professional research report, not raw LLM output.

---

# 16. Final Sources and References Section

The final report must include a proper Sources / References section.

Do not show only:

```text
[IEA 2024]
[CEA 2024]
```

Instead, show:

```text
Sources and References

1. Source Title
   Publisher
   Publication Date
   View Original Source

2. Source Title
   Publisher
   Publication Date
   View Original Source
```

Every displayed source with an available URL must have a clickable link.

If the report uses inline citation markers, those markers should map to actual source records.

Example:

```text
India's electricity demand is projected to increase significantly over the next decade. [1]
```

Clicking or hovering over `[1]` may show source information if practical, but at minimum the numbered source must appear in the Sources section with its actual link.

Do not include a reference in the final Sources section if no source record was actually collected.

---

# 17. Final Report Quality Rules

The Writer and Critic should follow these rules:

* Do not invent statistics.
* Do not invent source names.
* Do not invent URLs.
* Do not use citation placeholders without an actual source record.
* Clearly distinguish sourced facts from analysis.
* Clearly identify assumptions.
* Use cautious language when evidence is uncertain.
* Prefer removing unsupported claims over fabricating citations.
* Do not present LLM-generated estimates as externally verified facts.
* Ensure the final recommendation reflects the actual strength and limitations of the evidence.

---

# 18. Backend and Database Changes

Update persistence as necessary so that the following information survives beyond the current process:

```text
Research Run
├── Agent Execution Records
│   ├── Agent Name
│   ├── Status
│   ├── Started At
│   ├── Completed At
│   ├── Structured Output
│   └── Errors
│
├── Findings
│   ├── Claim
│   ├── Evidence
│   ├── Confidence
│   └── Verification Status
│
├── Sources
│   ├── Title
│   ├── Publisher
│   ├── URL
│   ├── Publication Date
│   ├── Retrieval Date
│   └── Relevant Excerpt
│
├── Verification Results
│
├── Writer Draft Versions
│
├── Critic Decisions
│
└── Final Report
```

Avoid unnecessary database redesign beyond what is needed to support this functionality.

Maintain compatibility with the existing PostgreSQL architecture.

---

# 19. Frontend Design Goal

The frontend should answer two questions clearly:

### Question 1: What is happening right now?

This is answered through:

* Live agent status
* SSE events
* Workflow progress
* Running/completed states

### Question 2: How did the system reach this answer?

This is answered through:

* Agent-by-agent outputs
* Research plan
* Findings
* Sources
* Verification results
* Critic feedback
* Revision history
* Final execution timeline

This is a core product requirement.

The multi-agent orchestration must be visible and inspectable.

---

# 20. Important Constraints

Do NOT:

* Change the existing core agent architecture.
* Add Deep Agents.
* Add unnecessary new agents.
* Add Docker/containerization.
* Add pgvector yet.
* Add unnecessary MCP integrations.
* Replace SSE with WebSockets.
* Change React + JavaScript to TypeScript.
* Replace FastAPI.
* Replace PostgreSQL.
* Add fake workflow progress.
* Generate fake source URLs.
* Display unsupported claims as verified facts.

Keep the existing project architecture intact.

---

# Final Goal

After this enhancement, the application should demonstrate:

> A custom multi-agent LangGraph research system whose reasoning workflow is visible, whose individual agent contributions are inspectable, whose factual claims are tied to actual collected sources, whose source links are explicitly verified, and whose final report is presented in a polished professional format.

The user should be able to:

1. Submit a complex research question.
2. Watch the multi-agent workflow execute live.
3. See specialist agents working in parallel.
4. Inspect each agent's actual output.
5. Inspect collected findings and sources.
6. See what the Verifier supported, flagged, or rejected.
7. See Critic feedback and revision rounds.
8. Read a professionally formatted final research report.
9. Open the original source links used to support the report.

This enhancement should be implemented cleanly and integrated with the existing architecture.

Once this is complete and tested, the project should be ready for deployment.