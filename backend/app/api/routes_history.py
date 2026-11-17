from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import report_to_dict, run_summary
from app.db.database import get_db
from app.db.models import Report, ResearchRun

router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
async def get_research_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ResearchRun, Report)
        .outerjoin(Report, Report.run_id == ResearchRun.id)
        .order_by(desc(ResearchRun.created_at))
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    total = (await db.execute(select(func.count()).select_from(ResearchRun))).scalar_one()
    return {
        "runs": [run_summary(run, report) for run, report in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/reports/{report_id}")
async def get_report_by_id(report_id: str, db: AsyncSession = Depends(get_db)):
    rep = await db.get(Report, report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")
    return report_to_dict(rep)
