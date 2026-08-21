import logging
from typing import Optional, List, Any
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_openai import ChatOpenAI
from app.config import settings

logger = logging.getLogger("LLMFactory")

class MockFallbackLLM(BaseChatModel):
    """Fallback LLM model for dev mode when OPENROUTER_API_KEY is not configured."""
    model_name: str = "mock-fallback"
    
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs
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
            f"Query processed: {last_msg[:150]}"
        )
        generation = ChatGeneration(message=AIMessage(content=mock_response))
        return ChatResult(generations=[generation])
    
    @property
    def _llm_type(self) -> str:
        return "mock-fallback"

# Curated list of high-performing free OpenRouter models
FREE_OPENROUTER_MODELS = [
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free"
]

class LLMFactory:
    @staticmethod
    def get_model(provider: Optional[str] = None, temperature: float = 0.2) -> BaseChatModel:
        """
        Builds a ChatOpenAI model instance targeting OpenRouter's API endpoint.
        The `provider` parameter can contain any model ID selected by the user.
        """
        model_name = provider or settings.DEFAULT_MODEL or FREE_OPENROUTER_MODELS[0]
        openrouter_key = settings.OPENROUTER_API_KEY.strip().strip('"').strip("'")
        
        # Verify valid key format before making HTTP call
        if openrouter_key and len(openrouter_key) > 10 and not openrouter_key.startswith("your_"):
            try:
                return ChatOpenAI(
                    model=model_name,
                    openai_api_key=openrouter_key,
                    openai_api_base="https://openrouter.ai/api/v1",
                    temperature=temperature,
                    default_headers={
                        "HTTP-Referer": "https://researchgraph.ai",
                        "X-Title": "Autonomous Multi-Agent Research Intelligence System"
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to initialize ChatOpenAI for model '{model_name}': {e}")

        logger.warning(
            f"OPENROUTER_API_KEY is not configured in backend/.env. "
            "Please paste your OPENROUTER_API_KEY into backend/.env"
        )
        return MockFallbackLLM()
