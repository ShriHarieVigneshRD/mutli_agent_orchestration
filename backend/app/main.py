import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_history import router as history_router
from app.api.routes_meta import router as meta_router
from app.api.routes_research import router as research_router
from app.config import settings
from app.db.database import init_db
from app.services.research_service import recover_interrupted_runs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await init_db()
        recovered = await recover_interrupted_runs()
        if recovered:
            logger.warning("Marked %d interrupted run(s) as failed.", recovered)
    except Exception:
        logger.exception("Database initialisation failed")
    if not settings.llm_configured:
        logger.warning("OPENROUTER_API_KEY is not set: running in offline demo mode.")
    yield


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(meta_router)
app.include_router(research_router, prefix=settings.API_V1_STR)
app.include_router(history_router, prefix=settings.API_V1_STR)
