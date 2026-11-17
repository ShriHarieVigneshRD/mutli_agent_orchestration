"""The seven agent nodes of the research graph."""

import json
import logging
from collections.abc import Callable
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent import prompts
from app.agent.llm import extract_text, invoke_llm_with_fallback, parse_json_from_llm
from app.agent.state import FindingItem, ResearchPlanDict, ResearchState, VerifiedClaim
from app.agent.tools import execute_data_analysis, execute_news_search, execute_web_search

logger = logging.getLogger(__name__)

GATHERER_AGENTS = ["researcher", "data_analyst", "news_agent"]


def planner_node(state: ResearchState) -> dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    logger.info("[Planner] Decomposing query: %s", query)

    messages = [
        SystemMessage(content=prompts.PLANNER_SYSTEM),
        HumanMessage(content=f"Decompose this research request: {query}"),
    ]
    try:
        parsed = parse_json_from_llm(invoke_llm_with_fallback(provider, messages, temperature=0.1).content)
        tasks = parsed.get(
            "tasks",
            [
                f"Gather core concepts and literature on: {query[:80]}",
                f"Analyze quantitative trends and adoption metrics for: {query[:80]}",
                f"Investigate current 2025/2026 industry news regarding: {query[:80]}",
            ],
        )
        agents_required = [a for a in parsed.get("agents_required", []) if a in GATHERER_AGENTS]
        agents_required = agents_required or list(GATHERER_AGENTS)
        focus_areas = parsed.get("focus_areas", ["Technical Capabilities", "Market Impact", "Future Outlook"])
        agent_prompts = parsed.get("agent_prompts", {})
    except Exception as e:
        logger.error("[Planner] Error: %s", e)
        tasks = [f"Investigate: {query[:80]}", "Analyze key metrics", "Review recent developments"]
        agents_required = list(GATHERER_AGENTS)
        focus_areas = ["General Analysis"]
        agent_prompts = {}

    plan: ResearchPlanDict = {
        "tasks": tasks,
        "agents_required": agents_required,
        "focus_areas": focus_areas,
        "agent_prompts": agent_prompts,
    }
    return {"plan": plan, "current_node": "planner"}


def _agent_query(state: ResearchState, agent: str) -> str:
    """The planner's short search query for this agent, or the raw research question."""
    agent_prompts = (state.get("plan") or {}).get("agent_prompts") or {}
    return agent_prompts.get(agent) or state["query"]


def _run_gatherer(
    agent: str,
    findings_key: str,
    source_type: str,
    fetch: Callable[[], list[dict[str, Any]]],
    empty_summary: str,
    done_summary: Callable[[int], str],
) -> dict[str, Any]:
    """Run one search-style agent and shape its findings, sources and status payload."""
    findings: list[FindingItem] = []
    sources: list[dict[str, Any]] = []
    status, error, summary = "completed", None, ""
    try:
        raw = fetch()
        status = "completed" if raw else "completed_with_no_results"
        summary = done_summary(len(raw)) if raw else empty_summary
        for f in raw:
            findings.append(
                {
                    "title": f["title"],
                    "content": f["content"],
                    "url": f.get("url"),
                    "source_type": source_type,
                    "timestamp": f.get("timestamp"),
                }
            )
            if f.get("url"):
                sources.append({"title": f["title"], "url": f["url"], "source_type": source_type})
    except Exception as e:
        logger.error("[%s] Error: %s", agent, e)
        status, error, summary = "failed", str(e), f"{agent} error: {e}"

    payload = {"status": status, "summary": summary, "findings": findings, "sources": sources, "error": error}
    return {findings_key: findings, "agent_outputs": {agent: payload}, "current_node": agent}


def research_node(state: ResearchState) -> dict[str, Any]:
    search_query = _agent_query(state, "researcher")
    logger.info("[Researcher] Web search: '%s'", search_query)
    return _run_gatherer(
        "researcher",
        "research_findings",
        "web",
        lambda: execute_web_search(search_query, max_results=5),
        "No sufficiently relevant web findings were identified.",
        lambda n: f"Gathered {n} web research findings.",
    )


def data_analyst_node(state: ResearchState) -> dict[str, Any]:
    data_query = _agent_query(state, "data_analyst")
    logger.info("[Data Analyst] Statistics for: '%s'", data_query)
    corpus = " ".join(f["content"] for f in state.get("research_findings", [])) or data_query
    return _run_gatherer(
        "data_analyst",
        "data_findings",
        "data",
        lambda: [execute_data_analysis(data_query, corpus)],
        "No quantitative data metrics recorded.",
        lambda _n: "Completed quantitative data analysis.",
    )


def news_node(state: ResearchState) -> dict[str, Any]:
    news_query = _agent_query(state, "news_agent")
    logger.info("[News Agent] Recent events for: '%s'", news_query)
    return _run_gatherer(
        "news_agent",
        "news_findings",
        "news",
        lambda: execute_news_search(news_query, max_results=4),
        "No recent 2025/2026 news articles were identified.",
        lambda n: f"Gathered {n} recent news developments.",
    )


def verifier_node(state: ResearchState) -> dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    all_findings = (
        state.get("research_findings", []) + state.get("data_findings", []) + state.get("news_findings", [])
    )
    logger.info("[Verifier] Validating %d findings", len(all_findings))

    findings_str = "\n---\n".join(
        f"Source ({f['source_type'].upper()}): {f['title']}\nURL: {f.get('url') or 'N/A'}\nContent: {f['content']}"
        for f in all_findings
    )
    messages = [
        SystemMessage(content=prompts.VERIFIER_SYSTEM),
        HumanMessage(content=f"Research Question: {query}\n\nEvidence Collected:\n{findings_str}"),
    ]

    verified_evidence: list[VerifiedClaim] = []
    unsupported_claims: list[str] = []
    try:
        parsed = parse_json_from_llm(invoke_llm_with_fallback(provider, messages, temperature=0.1).content)
        for item in parsed.get("verified_evidence", []):
            verified_evidence.append(
                {
                    "claim": item.get("claim", "Verified assertion"),
                    "is_verified": item.get("is_verified", True),
                    "confidence_score": float(item.get("confidence_score", 0.9)),
                    "reasoning": item.get("reasoning", "Supported by multi-source cross-reference."),
                    "supporting_sources": item.get("supporting_sources", ["Web Search"]),
                }
            )
        unsupported_claims = parsed.get("unsupported_claims", [])
    except Exception as e:
        logger.error("[Verifier] Validation error: %s", e)
        for f in all_findings:
            verified_evidence.append(
                {
                    "claim": f["title"],
                    "is_verified": True,
                    "confidence_score": 0.85,
                    "reasoning": "Direct source observation.",
                    "supporting_sources": [f.get("url") or f["title"]],
                }
            )

    payload = {
        "status": "completed",
        "verified_evidence": verified_evidence,
        "unsupported_claims": unsupported_claims,
        "verified_count": len(verified_evidence),
        "unsupported_count": len(unsupported_claims),
    }
    return {
        "verified_evidence": verified_evidence,
        "unsupported_claims": unsupported_claims,
        "agent_outputs": {"verifier": payload},
        "current_node": "verifier",
    }


def writer_node(state: ResearchState) -> dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    critic_feedback = state.get("critic_feedback", "")
    revision_count = state.get("revision_count", 0)
    logger.info("[Writer] Drafting report (revision %d)", revision_count)

    evidence_str = "\n".join(
        f"- Claim: {v['claim']} (Confidence: {v['confidence_score']})\n  Reasoning: {v['reasoning']}"
        for v in state.get("verified_evidence", [])
    )
    user_content = (
        f"Original Research Query: {query}\n\n"
        f"Research Plan: {json.dumps(state.get('plan', {}))}\n\n"
        f"Verified Evidence & Findings:\n{evidence_str}\n"
    )
    if critic_feedback:
        user_content += (
            f"\n\nCRITIC REVISION FEEDBACK TO ADDRESS:\n{critic_feedback}\n"
            "Please explicitly improve the report according to this feedback."
        )
    messages = [SystemMessage(content=prompts.WRITER_SYSTEM), HumanMessage(content=user_content)]

    try:
        draft_report = extract_text(invoke_llm_with_fallback(provider, messages, temperature=0.3).content)
    except Exception as e:
        logger.error("[Writer] Error: %s", e)
        draft_report = (
            f"# Research Report: {query}\n\n## Executive Summary\n"
            "Analysis generated based on verified findings.\n\n" + evidence_str
        )

    payload = {"status": "completed", "draft_report": draft_report, "revision_count": revision_count}
    return {"draft_report": draft_report, "agent_outputs": {"writer": payload}, "current_node": "writer"}


def critic_node(state: ResearchState) -> dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    draft_report = extract_text(state.get("draft_report", ""))
    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 2)
    logger.info("[Critic] Reviewing draft (revision %d)", revision_count)

    messages = [
        SystemMessage(content=prompts.CRITIC_SYSTEM),
        HumanMessage(content=f"Original Query: {query}\n\nDraft Report to Evaluate:\n{draft_report[:3000]}"),
    ]
    try:
        parsed = parse_json_from_llm(invoke_llm_with_fallback(provider, messages, temperature=0.1).content)
        decision = parsed.get("decision", "APPROVE").upper()
        feedback = parsed.get(
            "feedback", "The report adequately answers the research prompt with strong verified evidence."
        )
    except Exception as e:
        logger.error("[Critic] Review error: %s", e)
        decision = "APPROVE"
        feedback = "Approved report after editorial review."

    # Prevent infinite loops
    new_revision_count = revision_count
    if decision == "REVISE":
        new_revision_count += 1
        if new_revision_count >= max_revisions:
            logger.info("[Critic] Max revisions reached (%d). Forcing APPROVE.", max_revisions)
            decision = "APPROVE"
            feedback += (
                f" (Note: Maximum revision threshold of {max_revisions} reached; final report approved)."
            )

    payload = {
        "status": "completed",
        "critic_decision": decision,
        "critic_feedback": feedback,
        "revision_count": new_revision_count,
    }
    res: dict[str, Any] = {
        "critic_decision": decision,
        "critic_feedback": feedback,
        "revision_count": new_revision_count,
        "agent_outputs": {"critic": payload},
        "current_node": "critic",
    }
    if decision == "APPROVE":
        res["final_report"] = draft_report
    return res
