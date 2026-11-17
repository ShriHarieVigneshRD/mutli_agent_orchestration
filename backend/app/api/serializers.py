"""DB rows → JSON-ready dicts, shared by the API routes."""

from datetime import datetime
from typing import Any

from app.db.models import AgentRunLog, Report, ResearchPlan, ResearchRun, Source


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def report_to_dict(report: Report) -> dict[str, Any]:
    return {
        "id": report.id,
        "run_id": report.run_id,
        "title": report.title,
        "executive_summary": report.executive_summary,
        "full_markdown": report.full_markdown,
        "critic_feedback": report.critic_feedback,
        "status": report.status,
        "created_at": iso(report.created_at),
    }


def source_to_dict(s: Source) -> dict[str, Any]:
    return {
        "id": s.id,
        "title": s.title,
        "url": s.url,
        "snippet": s.snippet,
        "source_type": s.source_type,
        "confidence_score": s.confidence_score,
    }


def log_to_dict(log: AgentRunLog) -> dict[str, Any]:
    return {
        "agent_name": log.agent_name,
        "status": log.status,
        "details": log.details,
        "timestamp": iso(log.timestamp),
    }


def run_summary(run: ResearchRun, report: Report | None) -> dict[str, Any]:
    return {
        "id": run.id,
        "query": run.query,
        "provider": run.provider,
        "status": run.status,
        "current_step": run.current_step,
        "revision_count": run.revision_count,
        "created_at": iso(run.created_at),
        "has_report": report is not None,
        "report_id": report.id if report else None,
    }


def run_detail(
    run: ResearchRun,
    plan: ResearchPlan | None,
    sources: list[Source],
    logs: list[AgentRunLog],
    report: Report | None,
) -> dict[str, Any]:
    return {
        "id": run.id,
        "query": run.query,
        "provider": run.provider,
        "status": run.status,
        "current_step": run.current_step,
        "revision_count": run.revision_count,
        "error_message": run.error_message,
        "created_at": iso(run.created_at),
        "plan": {"tasks": plan.tasks, "agents_required": plan.agents_required} if plan else None,
        "sources": [source_to_dict(s) for s in sources],
        "logs": [log_to_dict(log) for log in logs],
        "report": report_to_dict(report) if report else None,
    }
