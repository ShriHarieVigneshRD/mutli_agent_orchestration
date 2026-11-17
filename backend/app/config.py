"""All configuration comes from environment variables or backend/.env (env vars win)."""

import logging
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent
PER_AGENT = "per-agent"  # model setting meaning "each kind of agent uses its own model"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    PROJECT_NAME: str = "ResearchGraph AI"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"

    DATABASE_URL: str = "sqlite+aiosqlite:///./research_system.db"
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,https://mutli-agent-orchestration.vercel.app"
    )

    # --- LLM via OpenRouter -------------------------------------------------------------
    OPENROUTER_API_KEY: str = ""
    # Primary model per kind of agent ("per-agent" mode).
    PLANNER_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    SPECIALIST_MODEL: str = "nvidia/nemotron-3.5-lightning:free"
    REVIEWER_MODEL: str = "google/gemma-4-31b-it:free"
    WRITER_MODEL: str = "nvidia/nemotron-3.5-super-vl:free"
    # Shared fallback tiers 2-4, tried in order after the primary.
    SECONDARY_MODEL: str = "google/gemma-4-31b-it:free"
    THIRD_MODEL: str = "nvidia/nemotron-3.5-super-vl:free"
    FALLBACK_MODEL: str = "openrouter/free"
    # "One model for all agents" mode: the models offered in the UI, and the preselected one.
    DEFAULT_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    MODEL_OPTIONS: str = (
        "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free,"
        "nvidia/nemotron-3.5-super-vl:free,nvidia/nemotron-3.5-lightning:free,"
        "google/gemma-4-26b-a4b-it:free,openrouter/free"
    )
    LLM_TIMEOUT_S: float = 90
    MAX_REVISIONS: int = 1  # how many times the critic may send the draft back to the writer

    # --- Search ---------------------------------------------------------------------------
    TAVILY_API_KEY: str = ""
    SEARCH_PROVIDER: Literal["auto", "off"] = "auto"  # auto = Tavily if key else DuckDuckGo; off = none

    # --- Abuse protection (per client IP) ---------------------------------------------------
    RESEARCH_RATE_LIMIT_PER_HOUR: int = 6
    CHAT_RATE_LIMIT_PER_MIN: int = 10
    MAX_CONCURRENT_RUNS: int = 3
    MAX_QUERY_CHARS: int = 2000
    MAX_CHAT_CHARS: int = 2000

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def model_options(self) -> list[str]:
        return [m.strip() for m in self.MODEL_OPTIONS.split(",") if m.strip()]

    @property
    def default_model(self) -> str:
        """DEFAULT_MODEL when it is one of the offered models, else the first option."""
        return self.DEFAULT_MODEL if self.DEFAULT_MODEL in self.model_options else self.model_options[0]

    @property
    def llm_configured(self) -> bool:
        key = self.OPENROUTER_API_KEY.strip().strip("\"'")
        return len(key) > 10 and not key.startswith("your_")

    @property
    def fallback_models(self) -> list[str]:
        return [m for m in (self.SECONDARY_MODEL, self.THIRD_MODEL, self.FALLBACK_MODEL) if m]


settings = Settings()

if settings.DEFAULT_MODEL not in settings.model_options:
    logger.warning(
        "DEFAULT_MODEL '%s' is not in MODEL_OPTIONS; using '%s'.",
        settings.DEFAULT_MODEL,
        settings.default_model,
    )
