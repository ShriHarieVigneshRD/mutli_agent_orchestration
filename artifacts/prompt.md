# Build Specification: Autonomous Multi-Agent Research Intelligence System

## Project Goal and Motive

Build a production-style full-stack **Autonomous Multi-Agent Research Intelligence System** that can take a complex research question, break it into specialized tasks, coordinate multiple AI agents, gather and analyze information from external sources, verify claims, generate a high-quality research report, and revise the report through a critic/reflection loop.

The main purpose of this project is to demonstrate a strong understanding of **Agentic AI and custom multi-agent orchestration using LangGraph**.

This must not be a simple chatbot or a basic “LLM calls several agents” application. The core value of the project is the **explicit orchestration logic**: planning, task routing, parallel agent execution, shared state, verification, reflection, conditional loops, and controlled termination.

The project should be built as a polished full-stack application with:

* A professional React frontend
* A FastAPI backend
* A custom LangGraph multi-agent architecture
* PostgreSQL persistence
* Real-time research progress updates
* Long-running asynchronous research workflows
* Swappable LLM providers
* Deployment of frontend and backend as separate services

The application should be suitable as a flagship portfolio project for **GenAI and Agentic AI roles**.

---

# 1. Core AI Architecture

The core architecture must use **custom LangGraph multi-agent orchestration**.

Do not use Deep Agents for the core architecture. The goal is to explicitly implement and demonstrate the orchestration logic ourselves rather than hiding planning and delegation behind a higher-level framework abstraction.

The high-level agent flow should be:

```text
                            User
                              │
                              ▼
                     Planner / Supervisor
                              │
                    Research Plan Creation
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
          Research Agent   Data Analyst   News Agent
                │             │             │
                └─────────────┼─────────────┘
                              │
                       Parallel Execution
                              │
                              ▼
                          Verifier
                              │
                              ▼
                           Writer
                              │
                              ▼
                           Critic
                          /      \
                         /        \
                    Revise       Approve
                       │            │
                       └─────┬──────┘
                             ▼
                        Final Report
```

## Agent Responsibilities

### 1. Planner / Supervisor

The Planner receives the user's research question and:

* Understands the research objective
* Determines the scope of the research
* Breaks the question into specialized tasks
* Creates a structured research plan
* Decides which specialist agents are required
* Routes work to the appropriate agents

Example:

```text
User Query:
"Analyze how AI coding agents may impact junior software engineering jobs."

Generated Plan:

1. Research current AI coding agent capabilities
2. Analyze developer productivity studies
3. Analyze current industry adoption
4. Research employment and workforce trends
5. Identify limitations and counterarguments
6. Compare evidence and produce conclusions
```

---

### 2. Research Agent

Responsible for broad and deep information gathering.

Capabilities:

* Web search
* Source discovery
* Information extraction
* Evidence collection
* Source summarization
* Identification of important claims

The Research Agent should return structured findings rather than only raw text.

---

### 3. Data Analyst Agent

Responsible for numerical and structured analysis.

Capabilities may include:

* Data interpretation
* Statistical calculations
* Trend analysis
* Comparison of numerical information
* Structured data processing

When appropriate, this agent can use Python-based analysis tools.

---

### 4. News Agent

Responsible for identifying relevant recent developments.

Capabilities:

* Search recent news
* Identify new developments
* Summarize current trends
* Distinguish recent information from background information
* Return dated and structured findings

---

### 5. Verifier Agent

Responsible for checking the evidence collected by other agents.

The Verifier should:

* Check whether important claims have supporting sources
* Identify unsupported claims
* Detect conflicting evidence
* Compare information from multiple sources
* Flag weak or low-confidence findings
* Determine whether additional research is required

The Verifier should not simply repeat the work of the Research Agent. Its specific purpose is evidence validation.

---

### 6. Writer Agent

Responsible for synthesizing verified findings into a coherent research report.

The report may contain:

* Executive Summary
* Research Question
* Research Plan
* Key Findings
* Detailed Analysis
* Data and Trends
* Counterarguments and Limitations
* Conclusions
* Sources and Citations

The Writer should primarily use verified findings rather than inventing unsupported conclusions.

---

### 7. Critic Agent

Responsible for evaluating the generated report.

The Critic should examine:

* Completeness
* Logical consistency
* Unsupported claims
* Missing perspectives
* Weak reasoning
* Poorly supported conclusions
* Whether the report adequately answers the original question

The Critic must make an explicit decision:

```text
APPROVE
```

or

```text
REVISE
```

If revision is required, the LangGraph workflow must conditionally route back to the appropriate earlier stage.

For example:

```text
Critic
   │
   ├── APPROVE → Final Report
   │
   └── REVISE → Writer / Verifier / Research
```

The workflow should also include clear termination conditions to prevent infinite revision loops.

---

# 2. Key LangGraph Concepts to Demonstrate

The project must explicitly demonstrate:

* Custom `StateGraph` architecture
* Shared graph state
* Multiple agent nodes
* Conditional edges
* Dynamic routing
* Parallel execution of independent agents
* Fan-out and fan-in patterns
* Agent-to-agent information flow
* Reflection and critic loops
* Controlled termination
* Error handling
* Retry handling where appropriate

The multi-agent architecture should be understandable from the code and not hidden behind excessive abstractions.

A major goal is to be able to explain in an interview:

> The Planner decomposes the user's research question into specialized tasks. Independent agents execute in parallel where possible, their outputs are merged into shared state, the Verifier validates evidence, the Writer synthesizes a report, and the Critic conditionally routes the workflow for revision or approval.

---

# 3. Long-Running Request Architecture

Research workflows may take significant time because multiple agents may perform web searches, analysis, verification, report generation, and revision.

Do not keep a single HTTP request open for the entire research process.

Instead, handle research runs asynchronously.

The request flow should be:

```text
POST /research
      │
      ▼
Create Research Run
      │
      ▼
Persist run in PostgreSQL
      │
      ▼
Return run_id immediately
      │
      ▼
Start LangGraph workflow
      │
      ▼
Frontend subscribes to run events using SSE
      │
      ▼
Receive live events
```

Example events:

```text
planner_started
planner_completed

researcher_started
researcher_completed

data_analyst_started
data_analyst_completed

news_agent_started
news_agent_completed

verifier_started
verifier_completed

writer_started
writer_completed

critic_started
critic_revision
critic_approved

research_completed
research_failed
```

The frontend should use the `run_id` to subscribe to live updates.

The user should be able to visually observe the progress of the multi-agent workflow.

Example:

```text
Research Run #42

✓ Planner completed
✓ Research Agent completed
⏳ Data Analyst running
⏳ News Agent running
○ Verifier waiting
○ Writer waiting
○ Critic waiting
```

Use **Server-Sent Events (SSE)** initially for one-way backend-to-frontend progress streaming.

WebSockets should not be introduced unless a later requirement genuinely needs two-way real-time communication.

---

# 4. Overall System Architecture

```text
┌───────────────────────────────────────────────┐
│             React + JavaScript Frontend       │
│                                               │
│ Dashboard                                     │
│ Research Workspace                            │
│ Live Agent Progress                           │
│ Research History                              │
│ Final Reports                                 │
└───────────────────────┬───────────────────────┘
                        │
                  REST API + SSE
                        │
┌───────────────────────▼───────────────────────┐
│                    FastAPI                    │
│                                               │
│ Research APIs                                 │
│ Run Management                                │
│ Event Streaming                               │
│ Persistence Layer                             │
└───────────────────────┬───────────────────────┘
                        │
┌───────────────────────▼───────────────────────┐
│                  LangGraph                    │
│                                               │
│ Planner / Supervisor                          │
│        │                                      │
│   ┌───────────────────┼───────────────┐       │
│   ▼                   ▼               ▼       │
│ Researcher       Data Analyst       News      │
│   └─────────────────┴─────────────────┘       │
│              │                                │
│           Verifier                            │
│              │                                │
│            Writer                             │
│              │                                │
│            Critic                             │
└──────────────┬────────────────────────────────┘
               │
       ┌───────┼───────────────┐
       ▼       ▼               ▼
   LLM APIs  Web Tools     PostgreSQL
```

---

# 5. Finalized Technology Stack

## Frontend

Use:

* React
* JavaScript
* Vite
* Tailwind CSS
* React Router
* React Query or an equivalent API state management solution

The frontend should provide:

* Landing/dashboard page
* Research query interface
* Research plan display
* Live agent execution view
* Agent status/progress visualization
* Final report viewer
* Research history page
* Source display

The UI should feel like a professional AI research product rather than a simple form.

---

## Backend

Use:

* Python
* FastAPI
* Uvicorn
* Pydantic

Responsibilities:

* REST APIs
* Research run creation
* Run status management
* SSE event streaming
* LangGraph integration
* Database access
* LLM provider configuration

---

## AI and Agent Framework

Use:

* LangGraph
* LangChain where useful for LLM and tool integrations

Do not use Deep Agents in the core architecture.

The multi-agent orchestration should be custom-built using LangGraph.

---

## LLM Providers

Support swappable LLM providers.

Initially support:

```text
Groq
Gemini
```

Use a provider abstraction layer such as:

```text
                    LLM Factory
                   /           \
                  ▼             ▼
                Groq          Gemini
                   \           /
                    ▼         ▼
                  LangGraph Agents
```

The active provider should be configurable through environment variables.

Example:

```text
LLM_PROVIDER=groq
```

or:

```text
LLM_PROVIDER=gemini
```

Do not tightly couple individual agents to one provider.

---

## Tools

Initial tools may include:

* Web search
* Tavily or another suitable web search service
* Python/data analysis tools

MCP is not part of the required core version.

MCP may be added later only if it provides a meaningful integration or interoperability benefit.

Do not force MCP into the architecture simply because it is a trending technology.

---

## Database

Use:

```text
PostgreSQL
```

Initially, PostgreSQL is for structured application persistence.

Store entities such as:

```text
users
research_projects
research_queries
research_plans
research_runs
agent_runs
sources
reports
feedback
```

Initial database architecture:

```text
User
  │
  └── Research Project
         │
         ├── Research Query
         ├── Research Plan
         ├── Research Run
         ├── Agent Execution Records
         ├── Sources
         └── Final Report
```

Do not add pgvector in the first version.

### Future Phase: pgvector

Later, add `pgvector` to PostgreSQL when implementing a genuine **Research Memory** feature.

Possible use cases:

* Semantic search over previous reports
* Retrieval of previous findings
* Comparing current research with historical research
* Research memory

Example:

> "What has changed since our research on this topic three months ago?"

The future system could:

1. Semantically retrieve previous research.
2. Perform fresh research.
3. Compare historical and current findings.
4. Generate a “What Changed?” analysis.

---

# 6. Python Environment and Package Management

Use:

```text
uv
```

for Python environment and dependency management.

Do not use traditional `venv` + `pip` as the primary workflow.

The backend should use `uv` for:

* Project initialization
* Virtual environment management
* Dependency installation
* Dependency locking
* Reproducible development environments

Example development workflow:

```text
uv init
uv add fastapi
uv add langgraph
uv add langchain
uv add uvicorn
```

The backend project should maintain its dependency configuration using the standard `uv` project workflow.

---

# 7. Deployment Architecture

Deploy frontend and backend separately.

## Frontend

```text
React + JavaScript
        │
        ▼
      Vercel
```

Use Vercel for:

* Frontend hosting
* Automatic deployment from GitHub
* Preview deployments
* Environment variables
* Public production URL

---

## Backend

```text
FastAPI + LangGraph
        │
        ▼
      Render
```

Use Render for:

* Python backend hosting
* FastAPI service
* LangGraph execution
* Environment variables
* Public backend API

Docker/containerization is not required for the initial version.

Do not introduce Docker unless it becomes necessary in a future phase.

---

## Database

Use:

```text
Neon PostgreSQL
```

Initial deployment architecture:

```text
                   Users
                     │
                     ▼
              Vercel Frontend
                     │
                REST + SSE
                     │
                     ▼
               Render Backend
              FastAPI + LangGraph
                     │
                     ▼
              Neon PostgreSQL
```

External AI and tool services:

```text
Render Backend
      │
      ├── Groq API
      ├── Gemini API
      └── Web Search API
```

---

# 8. Security and Configuration

Never commit secrets to GitHub.

Use environment variables for:

```text
GROQ_API_KEY
GEMINI_API_KEY
TAVILY_API_KEY
DATABASE_URL
LLM_PROVIDER
```

Frontend and backend environment variables should be configured separately in their deployment platforms.

---

# 9. Project Scope and Development Philosophy

Build the project incrementally.

Do not attempt to implement every feature at once.

Recommended development phases:

## Phase 1 — Project Foundation

* Set up repository structure
* Initialize Python backend using `uv`
* Set up FastAPI
* Set up React + JavaScript frontend
* Configure PostgreSQL
* Establish frontend-backend communication

## Phase 2 — Core LangGraph Orchestration

* Define shared graph state
* Implement Planner
* Implement specialist agent routing
* Implement parallel execution
* Implement fan-in/aggregation

## Phase 3 — Research Quality Pipeline

* Implement Verifier
* Implement Writer
* Implement Critic
* Implement revision loops
* Add controlled termination conditions

## Phase 4 — Persistence

* Store research runs
* Store agent status
* Store sources
* Store reports
* Implement research history

## Phase 5 — Long-Running Request Handling

* Create research run IDs
* Return immediately from `POST /research`
* Implement run status APIs
* Implement SSE event streaming
* Display live agent progress in React

## Phase 6 — Full Frontend Experience

* Research dashboard
* Live workflow visualization
* Final report interface
* History and report retrieval
* Source display

## Phase 7 — Deployment

* Deploy frontend to Vercel
* Deploy backend to Render
* Deploy database on Neon
* Configure production environment variables
* Test CORS, SSE, and long-running workflows

## Phase 8 — Advanced Features

Potential future additions:

* Research Memory with pgvector
* MCP integrations
* Human-in-the-loop approval
* User authentication
* Advanced source confidence scoring
* Research comparison over time
* Evaluation and observability integration

---

# 10. Explicit Non-Goals for the Initial Version

Do not add the following prematurely:

* Deep Agents
* Docker/containerization
* pgvector
* Multiple unnecessary MCP servers
* Complex microservices
* WebSockets when SSE is sufficient
* Overly complicated authentication
* Too many agents without a clear purpose

The goal is not to use every trending AI technology.

The goal is to build a **clean, technically strong, explainable multi-agent system** where every component has a clear architectural purpose.

---

# Final Project Identity

The final project should be positioned as:

## Autonomous Multi-Agent Research Intelligence System

A full-stack Agentic AI platform that uses custom LangGraph orchestration to decompose complex research questions, coordinate specialized agents in parallel, verify evidence, generate research reports, and improve outputs through critic-driven revision loops.

### Core Resume Concepts

```text
LangGraph
→ Multi-Agent Orchestration
→ Supervisor / Planner
→ Parallel Agent Execution
→ Conditional Routing
→ Tool Calling
→ Web Research
→ Verification
→ Reflection Loops
→ Long-Running Agent Workflows
→ SSE Streaming
→ FastAPI
→ React
→ PostgreSQL
→ Groq / Gemini
→ Vercel + Render Deployment
```

The final project should clearly demonstrate two things:

> **I can design and build a custom multi-agent AI system.**

and:

> **I can turn that AI system into a real full-stack, persistent, deployable application.**
