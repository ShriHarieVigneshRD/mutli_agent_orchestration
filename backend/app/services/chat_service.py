import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select

from app.agent import prompts
from app.agent.llm import extract_text, invoke_llm_with_fallback, parse_json_from_llm
from app.db.database import AsyncSessionLocal
from app.db.models import ChatMessage, Report, ResearchRun, Source

logger = logging.getLogger("ChatService")


async def get_chat_history(run_id: str) -> list[dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        stmt = select(ChatMessage).where(ChatMessage.run_id == run_id).order_by(ChatMessage.created_at.asc())
        res = await session.execute(stmt)
        messages = res.scalars().all()
        return [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]


async def process_followup_chat(run_id: str, user_message: str) -> dict[str, Any]:
    logger.info(f"[Chat Service] Processing follow-up for run {run_id}: '{user_message[:60]}...'")

    async with AsyncSessionLocal() as session:
        run_record = await session.get(ResearchRun, run_id)
        if not run_record:
            raise ValueError("Research run not found")

        report_stmt = select(Report).where(Report.run_id == run_id)
        report_res = await session.execute(report_stmt)
        report = report_res.scalar_one_or_none()
        report_md = report.full_markdown if report else "No report available."

        sources_stmt = select(Source).where(Source.run_id == run_id)
        sources_res = await session.execute(sources_stmt)
        sources = sources_res.scalars().all()
        sources_str = "\n".join(
            [f"- [{i + 1}] {s.title}: {s.snippet} (URL: {s.url})" for i, s in enumerate(sources)]
        )

        history_stmt = (
            select(ChatMessage).where(ChatMessage.run_id == run_id).order_by(ChatMessage.created_at.asc())
        )
        history_res = await session.execute(history_stmt)
        chat_history = history_res.scalars().all()

        # Build context from recent 6 messages
        history_context = "\n".join([f"{m.role.upper()}: {m.content}" for m in chat_history[-6:]])

        # Save user message to DB
        user_chat_msg = ChatMessage(run_id=run_id, role="user", content=user_message)
        session.add(user_chat_msg)
        await session.commit()

    provider = run_record.provider or "openrouter/free"

    context_prompt = (
        f"Original Research Question: {run_record.query}\n\n"
        f"Current Final Report:\n{report_md}\n\n"
        f"Verified Sources:\n{sources_str}\n\n"
        f"Recent Conversation History:\n{history_context}\n\n"
        f"User Follow-up Message: {user_message}"
    )

    messages = [SystemMessage(content=prompts.CHAT_SYSTEM), HumanMessage(content=context_prompt)]

    try:
        llm_response = invoke_llm_with_fallback(provider, messages, temperature=0.2)
        parsed = parse_json_from_llm(llm_response.content)

        chat_response = parsed.get("chat_response")
        if not chat_response:
            chat_response = extract_text(llm_response.content)

        is_report_modified = bool(parsed.get("is_report_modified", False))
        updated_report_md = parsed.get("updated_report_markdown")

    except Exception as e:
        logger.error(f"[Chat Service] Error generating follow-up response: {e}")
        chat_response = f"I've analyzed your question based on the report. (Note: {e})"
        is_report_modified = False
        updated_report_md = None

    # Persist assistant response and report modifications
    async with AsyncSessionLocal() as session:
        assistant_chat_msg = ChatMessage(run_id=run_id, role="assistant", content=chat_response)
        session.add(assistant_chat_msg)

        if is_report_modified and updated_report_md and len(updated_report_md.strip()) > 100:
            report_stmt = select(Report).where(Report.run_id == run_id)
            report_res = await session.execute(report_stmt)
            report_rec = report_res.scalar_one_or_none()
            if report_rec:
                report_rec.full_markdown = updated_report_md
                report_rec.executive_summary = updated_report_md[:500] + "..."
                logger.info(f"[Chat Service] Report modified via chat for run {run_id}")

        await session.commit()

    return {
        "chat_response": chat_response,
        "is_report_modified": is_report_modified,
        "updated_report_markdown": updated_report_md if is_report_modified else None,
    }
