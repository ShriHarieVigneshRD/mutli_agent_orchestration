"""LLM access: OpenRouter chat models, the offline mock, and helpers for reading model output."""

import json
import logging
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from app.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Curated list of high-performing free OpenRouter models
FREE_OPENROUTER_MODELS = [
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
]

FALLBACK_MODELS = [
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-chat:free",
]


class MockFallbackLLM(BaseChatModel):
    """Fallback LLM model for dev mode when OPENROUTER_API_KEY is not configured."""

    model_name: str = "mock-fallback"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        last_msg = messages[-1].content if messages else "No query"
        mock_response = (
            "# Mock Research Synthesis\n\n"
            "## Executive Summary\n"
            "This is a dev fallback report because `OPENROUTER_API_KEY` was not detected in `backend/.env`.\n\n"
            "Please paste your OpenRouter API key into `backend/.env`:\n"
            "```env\n"
            "OPENROUTER_API_KEY=sk-or-v1-...\n"
            "```\n\n"
            f"Query processed: {str(last_msg)[:150]}"
        )
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=mock_response))])

    @property
    def _llm_type(self) -> str:
        return "mock-fallback"


class LLMFactory:
    @staticmethod
    def get_model(provider: str | None = None, temperature: float = 0.2) -> BaseChatModel:
        """ChatOpenAI pointed at OpenRouter; `provider` is the model id. Mock model when no key is set."""
        model_name = provider or settings.DEFAULT_MODEL or FREE_OPENROUTER_MODELS[0]
        openrouter_key = settings.OPENROUTER_API_KEY.strip().strip('"').strip("'")

        if openrouter_key and len(openrouter_key) > 10 and not openrouter_key.startswith("your_"):
            try:
                return ChatOpenAI(
                    model=model_name,
                    api_key=SecretStr(openrouter_key),
                    base_url=OPENROUTER_BASE_URL,
                    temperature=temperature,
                    default_headers={
                        "HTTP-Referer": "https://researchgraph.ai",
                        "X-Title": "Autonomous Multi-Agent Research Intelligence System",
                    },
                )
            except Exception as e:
                logger.warning("Failed to initialize ChatOpenAI for model '%s': %s", model_name, e)

        logger.warning("OPENROUTER_API_KEY is not configured; using the offline mock model.")
        return MockFallbackLLM()


def invoke_llm_with_fallback(provider: str, messages: list, temperature: float = 0.2):
    """Invoke the selected model; on failure try the fallback models in order."""
    primary_model = provider or "meta-llama/llama-3.3-70b-instruct:free"
    try:
        return LLMFactory.get_model(provider=primary_model, temperature=temperature).invoke(messages)
    except Exception as e:
        logger.warning("Model '%s' failed with error: %s. Trying fallback models.", primary_model, e)
        for fb_model in FALLBACK_MODELS:
            if fb_model == primary_model:
                continue
            try:
                logger.info("Retrying with fallback model: %s", fb_model)
                return LLMFactory.get_model(provider=fb_model, temperature=temperature).invoke(messages)
            except Exception as err2:
                logger.warning("Fallback model '%s' also failed: %s", fb_model, err2)
        raise


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
    """JSON object from a model reply, tolerating ``` fences; {} when it is not valid JSON."""
    text = extract_text(content).strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except Exception:
        return {}
