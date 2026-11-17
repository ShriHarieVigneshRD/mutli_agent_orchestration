import json
import logging
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agent.llm import LLMUnavailable, resolve_model_setting
from app.api.deps import limit_chat, limit_research
from app.api.serializers import run_detail
from app.config import settings
from app.db.database import AsyncSessionLocal, get_db
from app.db.models import AgentRunLog, Report, ResearchPlan, ResearchRun, Source
from app.services import research_service
from app.services.chat_service import RunNotFound, get_chat_history, process_followup_chat
from app.services.sse_manager import is_terminal, sse_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/research", tags=["research"])

MIN_QUERY_CHARS = 4


class CreateResearchRequest(BaseModel):
    query: str
    model_mode: Literal["per_agent", "single"] | None = None
    model: str | None = None
    provider: str | None = None  # legacy: a model id; kept so older clients keep working


class CreateResearchResponse(BaseModel):
    run_id: str
    status: str
    message: str


class ChatMessageRequest(BaseModel):
    message: str


def _clean_text(text: str, max_chars: int, what: str, min_chars: int = 1) -> str:
    cleaned = text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{what} cannot be empty")
    if len(cleaned) < min_chars:
        raise HTTPException(status_code=422, detail=f"{what} is too short (at least {min_chars} characters).")
    if len(cleaned) > max_chars:
        raise HTTPException(status_code=422, detail=f"{what} is too long (at most {max_chars} characters).")
    return cleaned


@router.post("", response_model=CreateResearchResponse, dependencies=[Depends(limit_research)])
async def create_research_run(
    payload: CreateResearchRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    query = _clean_text(payload.query, settings.MAX_QUERY_CHARS, "Query", MIN_QUERY_CHARS)
    try:
        model_setting = resolve_model_setting(payload.model_mode, payload.model, payload.provider)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    if len(research_service.active_runs) >= settings.MAX_CONCURRENT_RUNS:
        raise HTTPException(
            status_code=429,
            detail="The research desk is busy with other runs. Try again in a minute.",
            headers={"Retry-After": "60"},
        )

    run = ResearchRun(query=query, provider=model_setting, status="pending", current_step="initialized")
    db.add(run)
    await db.commit()
    await db.refresh(run)

    research_service.active_runs.add(run.id)
    background_tasks.add_task(research_service.execute_research_run, run.id, run.query, model_setting)
    return CreateResearchResponse(
        run_id=run.id, status="pending", message="Research run initiated asynchronously."
    )


@router.get("/{run_id}")
async def get_research_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(ResearchRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Research run not found")

    plan = (await db.execute(select(ResearchPlan).where(ResearchPlan.run_id == run_id))).scalar_one_or_none()
    sources_stmt = select(Source).where(Source.run_id == run_id).order_by(Source.created_at)
    sources = (await db.execute(sources_stmt)).scalars().all()
    report = (await db.execute(select(Report).where(Report.run_id == run_id))).scalar_one_or_none()
    logs_stmt = select(AgentRunLog).where(AgentRunLog.run_id == run_id).order_by(AgentRunLog.timestamp.asc())
    logs = (await db.execute(logs_stmt)).scalars().all()
    return run_detail(run, plan, list(sources), list(logs), report)


@router.get("/{run_id}/chat")
async def get_research_chat(run_id: str):
    try:
        return {"run_id": run_id, "messages": await get_chat_history(run_id)}
    except RunNotFound as e:
        raise HTTPException(status_code=404, detail="Research run not found") from e


@router.post("/{run_id}/chat", dependencies=[Depends(limit_chat)])
async def post_research_chat(run_id: str, payload: ChatMessageRequest):
    message = _clean_text(payload.message, settings.MAX_CHAT_CHARS, "Message")
    try:
        return await process_followup_chat(run_id, message)
    except RunNotFound as e:
        raise HTTPException(status_code=404, detail="Research run not found") from e
    except LLMUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.exception("Chat processing error for run %s", run_id)
        raise HTTPException(
            status_code=500, detail="The assistant could not answer. Please try again."
        ) from e


@router.get("/{run_id}/stream")
async def stream_research_events(run_id: str):
    """Replays every event so far, then streams live ones; closes after the run finishes."""
    async with AsyncSessionLocal() as session:
        run = await session.get(ResearchRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Research run not found")
        status, error = run.status, run.error_message

    queue = sse_manager.subscribe(run_id)
    finished_without_history = status in ("completed", "failed") and not sse_manager.has_history(run_id)

    async def event_generator():
        try:
            yield {
                "event": "connected",
                "data": json.dumps({"message": "SSE Stream Connected", "run_id": run_id}),
            }
            if finished_without_history:  # e.g. after a server restart: report the stored outcome
                event = "research_completed" if status == "completed" else "research_failed"
                data = {"status": status, "run_id": run_id, "error": error}
                yield {
                    "event": "message",
                    "data": json.dumps({"event": event, "run_id": run_id, "data": data}),
                }
                return
            while True:
                payload = await queue.get()
                yield {"event": "message", "data": payload}
                if is_terminal(payload):
                    return
        finally:
            sse_manager.unsubscribe(run_id, queue)

    return EventSourceResponse(event_generator())
