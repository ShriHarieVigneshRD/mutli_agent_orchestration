"""Follow-up chat about a finished report, including edits to the report itself."""

import asyncio
import logging
from datetime import timedelta
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import func, select

from app.agent import llm, offline, prompts
from app.agent.llm import parse_json_from_llm
from app.api.serializers import iso
from app.db.database import AsyncSessionLocal
from app.db.models import ChatMessage, Report, ReportVersion, ResearchRun, Source, get_utc_now

logger = logging.getLogger(__name__)

HISTORY_TURNS = 6
MIN_REPORT_EDIT_CHARS = 100  # shorter "edits" are almost always a model mistake, not a rewrite


class RunNotFound(Exception):
    pass


async def get_chat_history(run_id: str) -> list[dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        if not await session.get(ResearchRun, run_id):
            raise RunNotFound(run_id)
        stmt = select(ChatMessage).where(ChatMessage.run_id == run_id).order_by(ChatMessage.created_at.asc())
        messages = (await session.execute(stmt)).scalars().all()
        return [
            {"id": m.id, "role": m.role, "content": m.content, "created_at": iso(m.created_at)}
            for m in messages
        ]


async def process_followup_chat(run_id: str, user_message: str) -> dict[str, Any]:
    """Raises RunNotFound, or llm.LLMUnavailable when no model answers (nothing is saved then)."""
    async with AsyncSessionLocal() as session:
        run = await session.get(ResearchRun, run_id)
        if not run:
            raise RunNotFound(run_id)
        report = (await session.execute(select(Report).where(Report.run_id == run_id))).scalar_one_or_none()
        sources = (
            (await session.execute(select(Source).where(Source.run_id == run_id).order_by(Source.created_at)))
            .scalars()
            .all()
        )
        history_stmt = (
            select(ChatMessage).where(ChatMessage.run_id == run_id).order_by(ChatMessage.created_at.asc())
        )
        history = (await session.execute(history_stmt)).scalars().all()
        query, model_setting = run.query, run.provider

    sources_str = "\n".join(f"[{i}] {s.title}: {s.snippet} ({s.url})" for i, s in enumerate(sources, 1))
    history_str = "\n".join(f"{m.role.upper()}: {m.content}" for m in history[-HISTORY_TURNS:])
    context = (
        f"Original research question: {query}\n\n"
        f"Current report:\n{report.full_markdown if report else 'No report available.'}\n\n"
        f"Numbered sources:\n{sources_str or '(none)'}\n\n"
        f"Recent conversation:\n{history_str or '(none)'}\n\n"
        f"User follow-up message: {user_message}"
    )
    messages = [SystemMessage(content=prompts.CHAT_SYSTEM), HumanMessage(content=context)]

    # The model call blocks for seconds; keep it off the event loop so streams and requests keep flowing.
    reply = await asyncio.to_thread(llm.invoke, "chat", messages, model_setting, 0.2, offline.chat)
    parsed = parse_json_from_llm(reply.text)
    chat_response = str(parsed.get("chat_response") or reply.text)
    updated = parsed.get("updated_report_markdown")
    is_modified = bool(
        parsed.get("is_report_modified")
        and report
        and isinstance(updated, str)
        and len(updated.strip()) > MIN_REPORT_EDIT_CHARS
    )

    async with AsyncSessionLocal() as session:
        now = get_utc_now()  # explicit, distinct timestamps keep the pair in order
        session.add(ChatMessage(run_id=run_id, role="user", content=user_message, created_at=now))
        session.add(
            ChatMessage(
                run_id=run_id,
                role="assistant",
                content=chat_response,
                created_at=now + timedelta(microseconds=1),
            )
        )
        version_count = None
        if is_modified and report:
            report_row = await session.get(Report, report.id)
            if report_row:
                # Keep the previous text so the edit can be undone (chat edits used to overwrite it).
                session.add(
                    ReportVersion(run_id=run_id, full_markdown=report_row.full_markdown, created_at=now)
                )
                report_row.full_markdown = str(updated)
                report_row.executive_summary = str(updated)[:500]
        await session.commit()
        if is_modified:
            version_count = await count_versions(session, run_id)

    return {
        "chat_response": chat_response,
        "is_report_modified": is_modified,
        "updated_report_markdown": updated if is_modified else None,
        "model_used": reply.model,
        "version_count": version_count,
    }


async def count_versions(session, run_id: str) -> int:
    stmt = select(func.count()).select_from(ReportVersion).where(ReportVersion.run_id == run_id)
    return (await session.execute(stmt)).scalar_one()


async def revert_report(run_id: str) -> dict[str, Any]:
    """Restore the report as it was before the latest chat edit. Raises RunNotFound / LookupError."""
    async with AsyncSessionLocal() as session:
        if not await session.get(ResearchRun, run_id):
            raise RunNotFound(run_id)
        report = (await session.execute(select(Report).where(Report.run_id == run_id))).scalar_one_or_none()
        latest_stmt = (
            select(ReportVersion)
            .where(ReportVersion.run_id == run_id)
            .order_by(ReportVersion.created_at.desc())
            .limit(1)
        )
        version = (await session.execute(latest_stmt)).scalar_one_or_none()
        if not report or not version:
            raise LookupError("There is no earlier version of this report.")
        report.full_markdown = version.full_markdown
        report.executive_summary = version.full_markdown[:500]
        await session.delete(version)
        await session.commit()
        return {"full_markdown": report.full_markdown, "version_count": await count_versions(session, run_id)}
