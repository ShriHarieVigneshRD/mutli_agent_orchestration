import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.db.database import get_db
from app.db.models import ResearchRun, ResearchPlan, AgentRunLog, Source, Report
from app.services.research_service import execute_research_run
from app.services.sse_manager import sse_manager

logger = logging.getLogger("ResearchRoutes")

router = APIRouter(prefix="/research", tags=["research"])

class CreateResearchRequest(BaseModel):
    query: str
    provider: Optional[str] = "groq"

class CreateResearchResponse(BaseModel):
    run_id: str
    status: str
    message: str

@router.post("", response_model=CreateResearchResponse)
async def create_research_run(
    payload: CreateResearchRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    new_run = ResearchRun(
        query=payload.query.strip(),
        provider=payload.provider or "groq",
        status="pending",
        current_step="initialized"
    )
    db.add(new_run)
    await db.commit()
    await db.refresh(new_run)

    # Launch LangGraph execution asynchronously in background task
    background_tasks.add_task(
        execute_research_run,
        run_id=new_run.id,
        query=new_run.query,
        provider=new_run.provider
    )

    return CreateResearchResponse(
        run_id=new_run.id,
        status="pending",
        message="Research run initiated asynchronously."
    )

@router.get("/{run_id}")
async def get_research_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run_rec = await db.get(ResearchRun, run_id)
    if not run_rec:
        raise HTTPException(status_code=404, detail="Research run not found")

    # Fetch associated plan, logs, sources, report
    plan_stmt = select(ResearchPlan).where(ResearchPlan.run_id == run_id)
    plan_res = await db.execute(plan_stmt)
    plan = plan_res.scalar_one_or_none()

    sources_stmt = select(Source).where(Source.run_id == run_id)
    sources_res = await db.execute(sources_stmt)
    sources = sources_res.scalars().all()

    report_stmt = select(Report).where(Report.run_id == run_id)
    report_res = await db.execute(report_stmt)
    report = report_res.scalar_one_or_none()

    logs_stmt = select(AgentRunLog).where(AgentRunLog.run_id == run_id).order_by(AgentRunLog.timestamp.asc())
    logs_res = await db.execute(logs_stmt)
    logs = logs_res.scalars().all()

    return {
        "id": run_rec.id,
        "query": run_rec.query,
        "provider": run_rec.provider,
        "status": run_rec.status,
        "current_step": run_rec.current_step,
        "revision_count": run_rec.revision_count,
        "error_message": run_rec.error_message,
        "created_at": run_rec.created_at.isoformat() if run_rec.created_at else None,
        "plan": {
            "tasks": plan.tasks if plan else [],
            "agents_required": plan.agents_required if plan else []
        } if plan else None,
        "sources": [
            {
                "id": s.id,
                "title": s.title,
                "url": s.url,
                "snippet": s.snippet,
                "source_type": s.source_type,
                "confidence_score": s.confidence_score
            }
            for s in sources
        ],
        "logs": [
            {
                "agent_name": l.agent_name,
                "status": l.status,
                "details": l.details,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None
            }
            for l in logs
        ],
        "report": {
            "id": report.id,
            "title": report.title,
            "executive_summary": report.executive_summary,
            "full_markdown": report.full_markdown,
            "critic_feedback": report.critic_feedback,
            "status": report.status
        } if report else None
    }

class ChatMessageRequest(BaseModel):
    message: str

@router.get("/{run_id}/chat")
async def get_research_chat(run_id: str):
    from app.services.chat_service import get_chat_history
    messages = await get_chat_history(run_id)
    return {"run_id": run_id, "messages": messages}

@router.post("/{run_id}/chat")
async def post_research_chat(run_id: str, payload: ChatMessageRequest):
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    from app.services.chat_service import process_followup_chat
    try:
        res = await process_followup_chat(run_id, payload.message.strip())
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception(f"Chat processing error for run {run_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{run_id}/stream")
async def stream_research_events(run_id: str):
    queue = sse_manager.subscribe(run_id)

    async def event_generator():
        try:
            # Yield initial connection confirmation event
            yield {
                "event": "connected",
                "data": '{"message": "SSE Stream Connected", "run_id": "' + run_id + '"}'
            }

            while True:
                data = await queue.get()
                yield {
                    "event": "message",
                    "data": data
                }
        except asyncio.CancelledError:
            sse_manager.unsubscribe(run_id, queue)
            logger.info(f"SSE connection closed for run: {run_id}")

    return EventSourceResponse(event_generator())
