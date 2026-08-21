import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db.database import get_db
from app.db.models import ResearchRun, Report

logger = logging.getLogger("HistoryRoutes")

router = APIRouter(prefix="/history", tags=["history"])

@router.get("")
async def get_research_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ResearchRun)
        .order_by(desc(ResearchRun.created_at))
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    runs = res.scalars().all()

    result = []
    for r in runs:
        rep_stmt = select(Report).where(Report.run_id == r.id)
        rep_res = await db.execute(rep_stmt)
        rep = rep_res.scalar_one_or_none()

        result.append({
            "id": r.id,
            "query": r.query,
            "provider": r.provider,
            "status": r.status,
            "current_step": r.current_step,
            "revision_count": r.revision_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "has_report": rep is not None,
            "report_id": rep.id if rep else None
        })

    return result

@router.get("/reports/{report_id}")
async def get_report_by_id(report_id: str, db: AsyncSession = Depends(get_db)):
    rep = await db.get(Report, report_id)
    if not rep:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {
        "id": rep.id,
        "run_id": rep.run_id,
        "title": rep.title,
        "executive_summary": rep.executive_summary,
        "full_markdown": rep.full_markdown,
        "critic_feedback": rep.critic_feedback,
        "status": rep.status,
        "created_at": rep.created_at.isoformat() if rep.created_at else None
    }
