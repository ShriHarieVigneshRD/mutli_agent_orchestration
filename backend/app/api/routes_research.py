import asyncio
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.serializers import run_detail
from app.db.database import get_db
from app.db.models import AgentRunLog, Report, ResearchPlan, ResearchRun, Source
from app.services.chat_service import get_chat_history, process_followup_chat
from app.services.research_service import execute_research_run
from app.services.sse_manager import sse_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/research", tags=["research"])


class CreateResearchRequest(BaseModel):
    query: str
    provider: str | None = "groq"


class CreateResearchResponse(BaseModel):
    run_id: str
    status: str
    message: str


class ChatMessageRequest(BaseModel):
    message: str


@router.post("", response_model=CreateResearchResponse)
async def create_research_run(
    payload: CreateResearchRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    new_run = ResearchRun(
        query=payload.query.strip(),
        provider=payload.provider or "groq",
        status="pending",
        current_step="initialized",
    )
    db.add(new_run)
    await db.commit()
    await db.refresh(new_run)

    background_tasks.add_task(
        execute_research_run, run_id=new_run.id, query=new_run.query, provider=new_run.provider
    )
    return CreateResearchResponse(
        run_id=new_run.id, status="pending", message="Research run initiated asynchronously."
    )


@router.get("/{run_id}")
async def get_research_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(ResearchRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Research run not found")

    plan = (await db.execute(select(ResearchPlan).where(ResearchPlan.run_id == run_id))).scalar_one_or_none()
    sources = (await db.execute(select(Source).where(Source.run_id == run_id))).scalars().all()
    report = (await db.execute(select(Report).where(Report.run_id == run_id))).scalar_one_or_none()
    logs_stmt = select(AgentRunLog).where(AgentRunLog.run_id == run_id).order_by(AgentRunLog.timestamp.asc())
    logs = (await db.execute(logs_stmt)).scalars().all()
    return run_detail(run, plan, list(sources), list(logs), report)


@router.get("/{run_id}/chat")
async def get_research_chat(run_id: str):
    return {"run_id": run_id, "messages": await get_chat_history(run_id)}


@router.post("/{run_id}/chat")
async def post_research_chat(run_id: str, payload: ChatMessageRequest):
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        return await process_followup_chat(run_id, payload.message.strip())
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve)) from ve
    except Exception as e:
        logger.exception("Chat processing error for run %s", run_id)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{run_id}/stream")
async def stream_research_events(run_id: str):
    queue = sse_manager.subscribe(run_id)

    async def event_generator():
        try:
            yield {
                "event": "connected",
                "data": json.dumps({"message": "SSE Stream Connected", "run_id": run_id}),
            }
            while True:
                yield {"event": "message", "data": await queue.get()}
        except asyncio.CancelledError:
            sse_manager.unsubscribe(run_id, queue)
            logger.info("SSE connection closed for run: %s", run_id)

    return EventSourceResponse(event_generator())
