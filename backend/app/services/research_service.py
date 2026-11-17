"""Runs the research graph for one run: streams progress over SSE and persists every step."""

import logging
import re
from datetime import timedelta
from typing import Any

from sqlalchemy import update

from app.agent.graph import research_graph
from app.agent.llm import LLMUnavailable, extract_text
from app.agent.nodes import FINDING_KEYS, numbered_sources
from app.agent.state import ResearchState
from app.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import AgentRunLog, Report, ResearchPlan, ResearchRun, Source, get_utc_now
from app.services.sse_manager import sse_manager

logger = logging.getLogger(__name__)

# Runs accepted but not finished, for MAX_CONCURRENT_RUNS. Added by the route, removed here.
active_runs: set[str] = set()

INTERRUPTED = "Interrupted by a server restart."


def _report_title(markdown: str, query: str) -> str:
    match = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
    return (match.group(1).strip() if match else query)[:200]


async def _set_run(run_id: str, **fields: Any) -> None:
    async with AsyncSessionLocal() as session:
        run = await session.get(ResearchRun, run_id)
        if run:
            for key, value in fields.items():
                setattr(run, key, value)
            await session.commit()


async def _save_report(run_id: str, query: str, markdown: str, critic_feedback: str) -> None:
    async with AsyncSessionLocal() as session:
        session.add(
            Report(
                run_id=run_id,
                title=_report_title(markdown, query),
                executive_summary=markdown[:500],
                full_markdown=markdown,
                critic_feedback=critic_feedback,
                status="final",
            )
        )
        run = await session.get(ResearchRun, run_id)
        if run:
            run.status, run.current_step = "completed", "completed"
        await session.commit()


async def _save_sources(run_id: str, findings: dict[str, list]) -> None:
    sources = numbered_sources(findings)
    base = get_utc_now()
    async with AsyncSessionLocal() as session:
        for s in sources:
            session.add(
                Source(
                    run_id=run_id,
                    title=s["title"],
                    url=s["url"],
                    snippet=(s.get("content") or "")[:300],
                    source_type=s.get("source_type", "web"),
                    confidence_score=None,
                    # Microsecond steps keep citation order [n] without a schema change.
                    created_at=base + timedelta(microseconds=s["n"]),
                )
            )
        await session.commit()


def _node_details(node: str, update_: dict[str, Any]) -> dict[str, Any]:
    """What a node produced plus its status/model/error, as stored in AgentRunLog and sent over SSE."""
    details = {k: v for k, v in update_.items() if k not in ("agent_outputs", "current_node", "final_report")}
    details.update((update_.get("agent_outputs") or {}).get(node, {}))
    return details


async def execute_research_run(run_id: str, query: str, provider: str) -> None:
    logger.info("Starting research run %s", run_id)
    await _set_run(run_id, status="running")

    initial_state: ResearchState = {
        "query": query,
        "provider": provider,
        "run_id": run_id,
        "plan": None,
        "research_findings": [],
        "data_findings": [],
        "news_findings": [],
        "agent_outputs": {},
        "verified_evidence": [],
        "unsupported_claims": [],
        "draft_report": "",
        "critic_decision": "",
        "critic_feedback": "",
        "revision_count": 0,
        "max_revisions": settings.MAX_REVISIONS,
        "final_report": "",
        "current_node": "initialized",
        "error": None,
    }
    findings: dict[str, list] = {key: [] for key in FINDING_KEYS}
    running: set[str] = set()
    last_draft, last_feedback, report_saved = "", "", False

    try:
        await sse_manager.broadcast(run_id, "research_started", {"status": "running", "query": query})

        async for part in research_graph.astream(
            initial_state, stream_mode=["updates", "tasks"], version="v2"
        ):
            if part["type"] == "tasks":
                task = part["data"]
                if "input" in task and not task["name"].startswith("__"):  # start; results carry "result"
                    running.add(task["name"])
                    await sse_manager.broadcast(run_id, f"{task['name']}_started", {"node": task["name"]})
                continue
            if part["type"] != "updates":
                continue

            for node, node_update in part["data"].items():
                node_update = node_update or {}
                running.discard(node)
                details = _node_details(node, node_update)
                for key in FINDING_KEYS:
                    findings[key] += node_update.get(key) or []
                if node == "writer":
                    last_draft = extract_text(node_update.get("draft_report", ""))
                if node == "critic":
                    last_feedback = node_update.get("critic_feedback", "")

                await sse_manager.broadcast(
                    run_id,
                    f"{node}_completed",
                    {
                        "node": node,
                        "details": details,
                        "state_summary": {
                            "revision_count": node_update.get("revision_count", 0),
                            "critic_decision": node_update.get("critic_decision", ""),
                        },
                    },
                )

                async with AsyncSessionLocal() as session:
                    session.add(
                        AgentRunLog(
                            run_id=run_id,
                            agent_name=node,
                            status=details.get("status", "completed"),
                            details=details,
                        )
                    )
                    run = await session.get(ResearchRun, run_id)
                    if run:
                        run.current_step = node
                        if "revision_count" in node_update:
                            run.revision_count = node_update["revision_count"]
                    if node == "planner" and node_update.get("plan"):
                        plan = node_update["plan"]
                        session.add(
                            ResearchPlan(
                                run_id=run_id,
                                tasks=plan.get("tasks", []),
                                agents_required=plan.get("agents_required", []),
                            )
                        )
                    await session.commit()

                if node == "verifier":
                    await _save_sources(run_id, findings)
                if node == "critic" and node_update.get("final_report"):
                    await _save_report(
                        run_id, query, extract_text(node_update["final_report"]), last_feedback
                    )
                    report_saved = True

        if not report_saved:
            if not last_draft:
                raise RuntimeError("The pipeline ended without a report.")
            # Safety net: the graph ended without an approved report; keep the last draft rather than lose it.
            await _save_report(run_id, query, last_draft, last_feedback)

        await sse_manager.broadcast(run_id, "research_completed", {"status": "completed", "run_id": run_id})

    except Exception as e:
        message = str(e) if isinstance(e, LLMUnavailable) else f"Research failed: {e}"
        logger.exception("Research run %s failed", run_id)
        async with AsyncSessionLocal() as session:
            for node in running:
                session.add(
                    AgentRunLog(run_id=run_id, agent_name=node, status="failed", details={"error": message})
                )
            run = await session.get(ResearchRun, run_id)
            if run:
                run.status, run.current_step, run.error_message = "failed", "failed", message
            await session.commit()
        for node in running:
            await sse_manager.broadcast(run_id, f"{node}_failed", {"node": node, "error": message})
        await sse_manager.broadcast(run_id, "research_failed", {"status": "failed", "error": message})
    finally:
        active_runs.discard(run_id)


async def recover_interrupted_runs() -> int:
    """Runs left pending/running by a previous process can never finish: mark them failed."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            update(ResearchRun)
            .where(ResearchRun.status.in_(["pending", "running"]))
            .values(status="failed", current_step="failed", error_message=INTERRUPTED)
        )
        await session.commit()
        return getattr(result, "rowcount", 0) or 0
