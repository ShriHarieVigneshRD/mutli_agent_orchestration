"""The seven agent nodes of the research graph.

Every node reports `status` (completed / completed_with_no_results / degraded / failed), `model_used`
and `error` in `agent_outputs`, so the UI can show what really happened instead of a silent fallback.
"""

import json
import logging
import re
from collections.abc import Callable, Mapping
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent import llm, offline, prompts
from app.agent.llm import LLMUnavailable, extract_text, parse_json_from_llm
from app.agent.state import FindingItem, ResearchPlanDict, ResearchState, VerifiedClaim
from app.agent.tools import execute_news_search, extract_figures, search_with_news_fallback

logger = logging.getLogger(__name__)

GATHERER_AGENTS = ["researcher", "data_analyst", "news_agent"]
FINDING_KEYS = ["research_findings", "data_findings", "news_findings"]


def _output(status: str, model_used: str | None = None, error: str | None = None, **extra: Any) -> dict:
    return {"status": status, "model_used": model_used, "error": error, **extra}


def numbered_sources(state: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Gathered findings with a URL, de-duplicated and numbered [1..n]. The verifier, writer, chat and the
    stored Source rows all use this order, so a citation [n] always means the same source."""
    seen: dict[str, dict[str, Any]] = {}
    for key in FINDING_KEYS:
        for f in state.get(key) or []:
            url = f.get("url")
            if url and url not in seen:
                seen[url] = {**f, "n": len(seen) + 1}
    return list(seen.values())


def _sources_block(sources: list[dict[str, Any]]) -> str:
    return "\n---\n".join(
        f"[{s['n']}] ({s['source_type']}) {s['title']}\nURL: {s['url']}\n{s['content']}" for s in sources
    )


# ---- 1. Planner (supervisor)


def planner_node(state: ResearchState) -> dict[str, Any]:
    query = state["query"]
    logger.info("[Planner] Decomposing query: %s", query[:120])
    messages = [
        SystemMessage(content=prompts.PLANNER_SYSTEM),
        HumanMessage(content=f"Decompose this research request: {query}"),
    ]
    model_used, error = None, None
    try:
        reply = llm.invoke(
            "planner", messages, state.get("provider"), 0.1, offline=lambda: offline.plan(query)
        )
        model_used, parsed = reply.model, parse_json_from_llm(reply.text)
    except LLMUnavailable as e:
        parsed, error = {}, str(e)

    agents_required = [a for a in parsed.get("agents_required") or [] if a in GATHERER_AGENTS]
    plan: ResearchPlanDict = {
        "tasks": parsed.get("tasks")
        or [
            f"Gather core concepts and literature on: {query[:80]}",
            f"Analyze quantitative trends and adoption metrics for: {query[:80]}",
            f"Investigate recent industry news regarding: {query[:80]}",
        ],
        "agents_required": agents_required or list(GATHERER_AGENTS),
        "focus_areas": parsed.get("focus_areas") or ["General Analysis"],
        "agent_prompts": parsed.get("agent_prompts") or {},
    }
    status = "completed" if parsed else "degraded"
    summary = "Plan created." if parsed else "Model plan unavailable; using the default plan."
    return {
        "plan": plan,
        "agent_outputs": {"planner": _output(status, model_used, error, summary=summary)},
        "current_node": "planner",
    }


# ---- 2-4. Gatherers (specialists)


def _agent_query(state: ResearchState, agent: str) -> str:
    """The planner's short search query for this agent, or the raw research question."""
    agent_prompts = (state.get("plan") or {}).get("agent_prompts") or {}
    return agent_prompts.get(agent) or state["query"]


def _finding(
    title: str, content: str, url: str | None, source_type: str, ts: str | None = None
) -> FindingItem:
    return {"title": title, "content": content, "url": url, "source_type": source_type, "timestamp": ts}


def _run_search_agent(
    agent: str, findings_key: str, source_type: str, search: Callable[[], list[dict[str, Any]]], noun: str
) -> dict[str, Any]:
    findings: list[FindingItem] = []
    try:
        for r in search():
            kind = r.get("source_type") or source_type  # a web search may fall back to news articles
            findings.append(_finding(r["title"], r["content"], r.get("url"), kind, r.get("timestamp")))
        status = "completed" if findings else "completed_with_no_results"
        summary = f"Gathered {len(findings)} {noun}." if findings else f"Search returned no {noun}."
        payload = _output(status, summary=summary)
    except Exception as e:
        logger.error("[%s] Search error: %s", agent, e)
        payload = _output("failed", error=str(e), summary=f"Search failed: {e}")
    return {findings_key: findings, "agent_outputs": {agent: payload}, "current_node": agent}


def research_node(state: ResearchState) -> dict[str, Any]:
    q = _agent_query(state, "researcher")
    return _run_search_agent(
        "researcher", "research_findings", "web", lambda: search_with_news_fallback(q, 5), "web findings"
    )


def news_node(state: ResearchState) -> dict[str, Any]:
    q = _agent_query(state, "news_agent")
    return _run_search_agent(
        "news_agent", "news_findings", "news", lambda: execute_news_search(q, 4), "news items"
    )


def _digits(text: str) -> str:
    return re.sub(r"\D", "", text)


def data_analyst_node(state: ResearchState) -> dict[str, Any]:
    """Runs its own statistics search, then extracts figures that really appear in those results."""
    q = _agent_query(state, "data_analyst")
    try:
        results = search_with_news_fallback(f"{q} statistics", 5)
    except Exception as e:
        logger.error("[data_analyst] Search error: %s", e)
        payload = _output("failed", error=str(e), summary=f"Search failed: {e}")
        return {
            "data_findings": [],
            "agent_outputs": {"data_analyst": payload},
            "current_node": "data_analyst",
        }

    findings: list[FindingItem] = []
    model_used, error = None, None
    if results:
        numbered = "\n---\n".join(f"[{i}] {r['title']}\n{r['content']}" for i, r in enumerate(results, 1))
        messages = [
            SystemMessage(content=prompts.DATA_ANALYST_SYSTEM),
            HumanMessage(content=f"Research question: {state['query']}\n\nSearch results:\n{numbered}"),
        ]
        try:
            reply = llm.invoke(
                "data_analyst", messages, state.get("provider"), 0.1, offline=lambda: '{"figures": []}'
            )
            model_used = reply.model
            for fig in parse_json_from_llm(reply.text).get("figures") or []:
                try:
                    source = results[int(fig.get("source", 0)) - 1]
                except (TypeError, ValueError, IndexError):
                    continue
                value = str(fig.get("value", "")).strip()
                # Keep a figure only if its digits occur in the cited source: no invented numbers.
                if _digits(value) and _digits(value) in _digits(source["content"]):
                    title = f"{fig.get('metric') or 'Figure'}: {value}"
                    findings.append(_finding(title, str(fig.get("context") or ""), source.get("url"), "data"))
        except LLMUnavailable as e:
            error = str(e)

        if not findings:  # offline, model failure, or no usable figures: plain extraction
            for r in results:
                if figs := extract_figures(r["content"]):
                    content = "\n".join(f"- {f}" for f in figs)
                    findings.append(_finding(f"Figures in: {r['title']}", content, r.get("url"), "data"))

    if findings:
        status, summary = ("degraded" if error else "completed"), f"Found {len(findings)} figures."
    else:
        status, summary = "completed_with_no_results", "No figures found in the search results."
    return {
        "data_findings": findings,
        "agent_outputs": {"data_analyst": _output(status, model_used, error, summary=summary)},
        "current_node": "data_analyst",
    }


# ---- 5. Verifier (reviewer)


def _source_numbers(values: Any, sources: list[dict[str, Any]]) -> list[int]:
    by_url = {s["url"]: s["n"] for s in sources}
    numbers = []
    for v in values if isinstance(values, list) else [values]:
        if isinstance(v, int | float) and 1 <= int(v) <= len(sources):
            numbers.append(int(v))
        elif isinstance(v, str):
            n = by_url.get(v) or (int(v.strip("[] ")) if v.strip("[] ").isdigit() else None)
            if n and 1 <= n <= len(sources):
                numbers.append(n)
    return list(dict.fromkeys(numbers))


def verifier_node(state: ResearchState) -> dict[str, Any]:
    sources = numbered_sources(state)
    logger.info("[Verifier] Checking %d sources", len(sources))
    verified: list[VerifiedClaim] = []
    unsupported: list[str] = []
    model_used, error = None, None

    if sources:
        messages = [
            SystemMessage(content=prompts.VERIFIER_SYSTEM),
            HumanMessage(
                content=f"Research question: {state['query']}\n\nSources:\n{_sources_block(sources)}"
            ),
        ]
        try:
            reply = llm.invoke(
                "verifier",
                messages,
                state.get("provider"),
                0.1,
                offline=lambda: offline.verification(sources),
            )
            model_used, parsed = reply.model, parse_json_from_llm(reply.text)
            for item in parsed.get("verified_evidence") or []:
                score = item.get("confidence_score")
                verified.append(
                    {
                        "claim": str(item.get("claim", "")).strip(),
                        "is_verified": bool(item.get("is_verified", True)),
                        "confidence_score": float(score) if isinstance(score, int | float) else None,
                        "reasoning": str(item.get("reasoning", "")),
                        "supporting_sources": _source_numbers(item.get("supporting_sources", []), sources),
                    }
                )
            unsupported = [str(c) for c in parsed.get("unsupported_claims") or []]
        except LLMUnavailable as e:
            error = str(e)
            verified = [
                {
                    "claim": s["title"],
                    "is_verified": False,
                    "confidence_score": None,
                    "reasoning": f"Not checked: {e}",
                    "supporting_sources": [s["n"]],
                }
                for s in sources
            ]

    status = "degraded" if error else ("completed" if sources else "completed_with_no_results")
    payload = _output(
        status,
        model_used,
        error,
        verified_count=sum(1 for v in verified if v["is_verified"]),
        unsupported_count=len(unsupported),
    )
    return {
        "verified_evidence": verified,
        "unsupported_claims": unsupported,
        "agent_outputs": {"verifier": payload},
        "current_node": "verifier",
    }


# ---- 6. Writer


def writer_node(state: ResearchState) -> dict[str, Any]:
    """Raises LLMUnavailable when no model can write: the run then fails with that reason."""
    query = state["query"]
    revision_count = state.get("revision_count", 0)
    sources = numbered_sources(state)
    logger.info("[Writer] Drafting report (revision %d, %d sources)", revision_count, len(sources))

    evidence = "\n".join(
        f"- {v['claim']} (sources: {', '.join(f'[{n}]' for n in v['supporting_sources']) or 'none'}; "
        f"{'verified' if v['is_verified'] else 'not verified'}) {v['reasoning']}"
        for v in state.get("verified_evidence", [])
    )
    figures = "\n".join(f"- {f['title']} ({f.get('url')})" for f in state.get("data_findings", []))
    source_list = "\n".join(f"[{s['n']}] {s['title']}, {s['url']}" for s in sources) or "(no sources found)"
    user_content = (
        f"Original research query: {query}\n\n"
        f"Research plan: {json.dumps(state.get('plan') or {})}\n\n"
        f"Numbered sources:\n{source_list}\n\n"
        f"Verified evidence:\n{evidence or '(none)'}\n\n"
        f"Figures found by the data analyst:\n{figures or '(none)'}\n"
    )
    unsupported = state.get("unsupported_claims") or []
    if unsupported:
        user_content += "\nUnsupported claims (do not state as fact):\n" + "\n".join(
            f"- {c}" for c in unsupported
        )
    if state.get("critic_feedback") and revision_count:
        user_content += (
            f"\n\nCRITIC REVISION FEEDBACK TO ADDRESS:\n{state['critic_feedback']}\n"
            "Please explicitly improve the report according to this feedback."
        )
    messages = [SystemMessage(content=prompts.WRITER_SYSTEM), HumanMessage(content=user_content)]

    reply = llm.invoke(
        "writer",
        messages,
        state.get("provider"),
        0.3,
        offline=lambda: offline.report(query, sources, list(state.get("data_findings", []))),
    )
    draft = extract_text(reply.text)
    payload = _output("completed", reply.model, draft_report=draft, revision_count=revision_count)
    return {"draft_report": draft, "agent_outputs": {"writer": payload}, "current_node": "writer"}


# ---- 7. Critic (reviewer)


def critic_node(state: ResearchState) -> dict[str, Any]:
    draft = extract_text(state.get("draft_report", ""))
    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 1)
    logger.info("[Critic] Reviewing draft (revision %d of max %d)", revision_count, max_revisions)

    messages = [
        SystemMessage(content=prompts.CRITIC_SYSTEM),
        HumanMessage(
            content=f"Original query: {state['query']}\n\nDraft report to evaluate:\n{draft[:6000]}"
        ),
    ]
    model_used, error = None, None
    try:
        reply = llm.invoke("critic", messages, state.get("provider"), 0.1, offline=offline.critic)
        model_used, parsed = reply.model, parse_json_from_llm(reply.text)
        decision = str(parsed.get("decision") or "APPROVE").strip().upper()
        feedback = str(parsed.get("feedback") or "").strip() or "Approved without comments."
    except LLMUnavailable as e:
        error = str(e)
        decision, feedback = "APPROVE", f"Critic unavailable ({e}); draft accepted without review."

    # Models answer "Approved", "revise.", ...; anything not asking for a revision approves.
    wants_revision = decision.startswith("REVIS")
    if wants_revision and revision_count < max_revisions:
        decision, revision_count = "REVISE", revision_count + 1
    else:
        if wants_revision:
            feedback += f" (Revision limit of {max_revisions} reached; final report approved.)"
        decision = "APPROVE"

    payload = _output(
        "degraded" if error else "completed",
        model_used,
        error,
        critic_decision=decision,
        critic_feedback=feedback,
        revision_count=revision_count,
    )
    result: dict[str, Any] = {
        "critic_decision": decision,
        "critic_feedback": feedback,
        "revision_count": revision_count,
        "agent_outputs": {"critic": payload},
        "current_node": "critic",
    }
    if decision == "APPROVE":
        result["final_report"] = draft
    return result
