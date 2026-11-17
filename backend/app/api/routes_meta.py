from fastapi import APIRouter

from app.agent.llm import AGENT_KINDS, kind_model
from app.config import settings

router = APIRouter(tags=["meta"])


@router.get("/health")
@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "llm_configured": settings.llm_configured,
    }


@router.get("/api/models")
async def get_models():
    """What the model picker offers, and which model each kind of agent uses in per-agent mode."""
    return {
        "llm_configured": settings.llm_configured,
        "default_mode": "per_agent",
        "default_model": settings.default_model,
        "options": settings.model_options,
        "kinds": [
            {"kind": kind, "label": info["label"], "agents": info["agents"], "model": kind_model(kind)}
            for kind, info in AGENT_KINDS.items()
        ],
        "fallbacks": settings.fallback_models,
    }
