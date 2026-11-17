"""Model gateway: per-kind model chains with a 4-tier fallback over OpenRouter.

Every LLM call goes through `invoke(agent, ...)`. Agents of the same kind share a primary model
("per-agent" mode), or one model serves every agent ("single" mode). Either way the chain continues
with SECONDARY → THIRD → FALLBACK. Without an API key, each caller's `offline` reply is returned
instead, so the app still runs end to end as a clearly labelled demo.
"""

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from app.config import PER_AGENT, settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OFFLINE_MODEL = "offline-demo"

# The agent hierarchy, grouped by kind. Researcher and news agent are search tools (no model calls).
AGENT_KINDS: dict[str, dict[str, Any]] = {
    "supervisor": {"label": "Supervisor", "agents": ["planner"], "setting": "PLANNER_MODEL"},
    "specialist": {"label": "Specialists", "agents": ["data_analyst"], "setting": "SPECIALIST_MODEL"},
    "reviewer": {"label": "Reviewers", "agents": ["verifier", "critic"], "setting": "REVIEWER_MODEL"},
    "writer": {"label": "Writers", "agents": ["writer", "chat"], "setting": "WRITER_MODEL"},
}
AGENT_KIND = {agent: kind for kind, info in AGENT_KINDS.items() for agent in info["agents"]}

FAILURE_MESSAGES = {
    "DAILY_LIMIT": "The free OpenRouter daily limit is used up. It resets at 00:00 UTC.",
    "RATE_LIMITED": "Every model in the fallback chain is rate-limited right now. Try again in a minute.",
    "ALL_FAILED": "No model in the fallback chain returned an answer.",
}


class LLMUnavailable(Exception):
    """Every model in the chain failed. `reason` is DAILY_LIMIT, RATE_LIMITED or ALL_FAILED."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(FAILURE_MESSAGES[reason])


@dataclass
class LLMReply:
    text: str
    model: str


def kind_model(kind: str) -> str:
    return getattr(settings, AGENT_KINDS[kind]["setting"])


def resolve_model_setting(model_mode: str | None, model: str | None, legacy_provider: str | None) -> str:
    """The run's model setting: PER_AGENT or one allowed model id. Raises ValueError otherwise."""
    if model_mode == "single" or (model_mode is None and legacy_provider and legacy_provider != PER_AGENT):
        chosen = model or legacy_provider or settings.default_model
        if chosen not in settings.model_options:
            raise ValueError(f"Unknown model '{chosen}'. Choose one of: {', '.join(settings.model_options)}")
        return chosen
    if model_mode in (None, "per_agent"):
        return PER_AGENT
    raise ValueError("model_mode must be 'per_agent' or 'single'")


def model_chain(agent: str, model_setting: str | None) -> list[str]:
    """Primary model for this agent, then the shared fallback tiers, without duplicates."""
    primary = model_setting if model_setting and model_setting != PER_AGENT else kind_model(AGENT_KIND[agent])
    return list(dict.fromkeys([primary, *settings.fallback_models]))


def _chat_model(model: str, temperature: float) -> BaseChatModel:
    return ChatOpenAI(
        model=model,
        api_key=SecretStr(settings.OPENROUTER_API_KEY.strip().strip("\"'")),
        base_url=OPENROUTER_BASE_URL,
        temperature=temperature,
        max_retries=0,  # the chain is the retry strategy; a dead model should cost seconds
        timeout=settings.LLM_TIMEOUT_S,
        default_headers={"X-Title": settings.PROJECT_NAME},
    )


def invoke(
    agent: str,
    messages: list,
    model_setting: str | None = None,
    temperature: float = 0.2,
    offline: Callable[[], str] | None = None,
) -> LLMReply:
    """First non-empty reply along the agent's chain. Raises LLMUnavailable when all models fail."""
    if not settings.llm_configured:
        return LLMReply(offline() if offline else "", OFFLINE_MODEL)

    rate_limited = daily_limit = False
    for model in model_chain(agent, model_setting):
        try:
            response = _chat_model(model, temperature).invoke(messages)
        except Exception as e:
            if getattr(e, "status_code", None) == 429:
                rate_limited = True
                daily_limit = daily_limit or "per-day" in str(e).lower()
            logger.warning("[%s] model %s failed: %s. Trying next in chain.", agent, model, e)
            continue
        text = extract_text(response.content).strip()
        if text:
            return LLMReply(text, model)
        logger.warning("[%s] model %s returned an empty reply. Trying next in chain.", agent, model)

    raise LLMUnavailable("DAILY_LIMIT" if daily_limit else "RATE_LIMITED" if rate_limited else "ALL_FAILED")


def extract_text(content: Any) -> str:
    """Plain text from a model reply that may be a string or a list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                parts.append(part["text"])
        return "\n".join(parts)
    return str(content)


def parse_json_from_llm(content: Any) -> dict[str, Any]:
    """JSON object from a model reply, tolerating ``` fences and prose around it; {} if none."""
    text = extract_text(content).strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = json.loads(text)
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        try:
            parsed = json.loads(text[start : end + 1]) if 0 <= start < end else {}
        except ValueError:
            parsed = {}
    return parsed if isinstance(parsed, dict) else {}
