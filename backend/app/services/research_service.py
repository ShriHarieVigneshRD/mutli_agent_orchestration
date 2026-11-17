import logging

from app.agent.graph import research_graph
from app.agent.llm import extract_text
from app.agent.state import ResearchState
from app.db.database import AsyncSessionLocal
from app.db.models import AgentRunLog, Report, ResearchPlan, ResearchRun, Source
from app.services.sse_manager import sse_manager

logger = logging.getLogger("ResearchService")


async def execute_research_run(run_id: str, query: str, provider: str = "groq"):
    logger.info(f"Starting research run execution for run_id: {run_id}")

    async with AsyncSessionLocal() as session:
        run_record = await session.get(ResearchRun, run_id)
        if not run_record:
            logger.error(f"Run record not found: {run_id}")
            return
        run_record.status = "running"
        await session.commit()

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
        "max_revisions": 2,
        "final_report": "",
        "current_node": "initialized",
        "error": None,
    }

    try:
        await sse_manager.broadcast(
            run_id, "research_started", {"status": "running", "query": query, "provider": provider}
        )

        # Stream graph node outputs
        async for output in research_graph.astream(initial_state):
            for node_name, node_state in output.items():
                logger.info(f"[Graph Stream] Node completed: {node_name}")

                # Build rich node detail payload for SSE and DB log
                node_detail = {}
                if node_name == "planner":
                    node_detail = {"plan": node_state.get("plan")}
                elif node_name == "researcher":
                    node_detail = {"research_findings": node_state.get("research_findings", [])}
                elif node_name == "data_analyst":
                    node_detail = {"data_findings": node_state.get("data_findings", [])}
                elif node_name == "news_agent":
                    node_detail = {"news_findings": node_state.get("news_findings", [])}
                elif node_name == "verifier":
                    node_detail = {
                        "verified_evidence": node_state.get("verified_evidence", []),
                        "unsupported_claims": node_state.get("unsupported_claims", []),
                    }
                elif node_name == "writer":
                    node_detail = {
                        "draft_report": extract_text(node_state.get("draft_report", "")),
                        "revision_count": node_state.get("revision_count", 0),
                    }
                elif node_name == "critic":
                    node_detail = {
                        "critic_decision": node_state.get("critic_decision", ""),
                        "critic_feedback": extract_text(node_state.get("critic_feedback", "")),
                        "revision_count": node_state.get("revision_count", 0),
                    }

                # Broadcast node completed event with full output payload
                await sse_manager.broadcast(
                    run_id,
                    f"{node_name}_completed",
                    {
                        "node": node_name,
                        "details": node_detail,
                        "state_summary": {
                            "has_plan": bool(node_state.get("plan")),
                            "research_count": len(node_state.get("research_findings", [])),
                            "data_count": len(node_state.get("data_findings", [])),
                            "news_count": len(node_state.get("news_findings", [])),
                            "verified_count": len(node_state.get("verified_evidence", [])),
                            "unsupported_count": len(node_state.get("unsupported_claims", [])),
                            "draft_length": len(extract_text(node_state.get("draft_report", ""))),
                            "critic_decision": node_state.get("critic_decision", ""),
                            "revision_count": node_state.get("revision_count", 0),
                        },
                    },
                )

                # Persist intermediate logs to DB
                async with AsyncSessionLocal() as session:
                    agent_log = AgentRunLog(
                        run_id=run_id, agent_name=node_name, status="completed", details=node_detail
                    )
                    session.add(agent_log)

                    run_record = await session.get(ResearchRun, run_id)
                    if run_record:
                        run_record.current_step = node_name
                        if "revision_count" in node_state:
                            run_record.revision_count = node_state["revision_count"]
                    await session.commit()

                # Handle specific node outputs for DB entities
                if node_name == "planner" and node_state.get("plan"):
                    plan_data = node_state["plan"]
                    async with AsyncSessionLocal() as session:
                        p_record = ResearchPlan(
                            run_id=run_id,
                            tasks=plan_data.get("tasks", []),
                            agents_required=plan_data.get("agents_required", []),
                        )
                        session.add(p_record)
                        await session.commit()

                if node_name == "verifier":
                    # Persist sources
                    findings = (
                        node_state.get("research_findings", [])
                        + node_state.get("data_findings", [])
                        + node_state.get("news_findings", [])
                    )
                    async with AsyncSessionLocal() as session:
                        for f in findings:
                            s_record = Source(
                                run_id=run_id,
                                title=f.get("title", "Source"),
                                url=f.get("url"),
                                snippet=f.get("content", "")[:300],
                                source_type=f.get("source_type", "web"),
                                confidence_score=0.9,
                            )
                            session.add(s_record)
                        await session.commit()

                if node_name == "critic" and node_state.get("final_report"):
                    final_md = extract_text(node_state["final_report"])
                    critic_fb = extract_text(node_state.get("critic_feedback", ""))
                    async with AsyncSessionLocal() as session:
                        rep_record = Report(
                            run_id=run_id,
                            title=f"Research Intelligence Report: {query[:50]}",
                            executive_summary=final_md[:500] + "...",
                            full_markdown=final_md,
                            critic_feedback=critic_fb,
                            status="final",
                        )
                        session.add(rep_record)

                        run_rec = await session.get(ResearchRun, run_id)
                        if run_rec:
                            run_rec.status = "completed"
                            run_rec.current_step = "completed"
                        await session.commit()

        await sse_manager.broadcast(run_id, "research_completed", {"status": "completed", "run_id": run_id})

    except Exception as e:
        logger.exception(f"Error executing research run {run_id}: {e}")
        async with AsyncSessionLocal() as session:
            run_rec = await session.get(ResearchRun, run_id)
            if run_rec:
                run_rec.status = "failed"
                run_rec.error_message = str(e)
                await session.commit()

        await sse_manager.broadcast(run_id, "research_failed", {"status": "failed", "error": str(e)})
