"""Shared fixtures. Forces a fully offline, deterministic environment.

Env overrides run before any `app` import, so the real keys and the Neon URL in
backend/.env are never used by tests (env vars take precedence over .env).
"""

import json
import os
import pathlib
import tempfile

import pytest

_TMP = pathlib.Path(tempfile.mkdtemp(prefix="research-tests-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite+aiosqlite:///{(_TMP / 'test.db').as_posix()}",
        "OPENROUTER_API_KEY": "",
        "TAVILY_API_KEY": "",
        "DEFAULT_MODEL": "openrouter/free",
    }
)

import duckduckgo_search  # noqa: E402
import langchain_openai  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402

from app.agent import nodes  # noqa: E402
from app.main import app  # noqa: E402
from app.services import chat_service  # noqa: E402


def _offline(*_args, **_kwargs):
    raise RuntimeError("network disabled in tests")


# Patched at import time so nothing can reach OpenRouter or DuckDuckGo by accident.
langchain_openai.ChatOpenAI.invoke = _offline
duckduckgo_search.DDGS = _offline

# Which agent a prompt belongs to, recognised from its system prompt.
_AGENT_MARKERS = {
    "Planner": "planner",
    "Verifier": "verifier",
    "Research Writer": "writer",
    "Critic": "critic",
    "Research Assistant": "chat",
}

DEFAULT_REPLIES = {
    "planner": {
        "tasks": ["Find cost data", "Find adoption news"],
        "agents_required": ["researcher", "data_analyst", "news_agent", "hacker"],
        "focus_areas": ["Costs", "Adoption"],
        "agent_prompts": {
            "researcher": "solar panel household savings",
            "news_agent": "solar panel news",
            "data_analyst": "solar panel cost statistics",
        },
    },
    "verifier": {
        "verified_evidence": [
            {
                "claim": "Solar costs fell 40% since 2020",
                "is_verified": True,
                "confidence_score": 0.9,
                "reasoning": "Stated by source 1",
                "supporting_sources": ["https://example.org/solar"],
            }
        ],
        "unsupported_claims": ["Solar is free"],
    },
    "writer": "# Solar Report\n\n## Executive Summary\nSolar costs fell 40% since 2020 [1].\n",
    "critic": {"decision": "APPROVE", "feedback": "Clear and sourced."},
    "chat": {
        "chat_response": "Here is the answer.",
        "is_report_modified": False,
        "updated_report_markdown": None,
    },
}


class FakeLLM:
    """Scripted replies per agent. A list value is consumed in order; the last item repeats."""

    def __init__(self):
        self.replies = dict(DEFAULT_REPLIES)
        self.calls: list[str] = []

    def reply_for(self, agent: str):
        value = self.replies[agent]
        if isinstance(value, list):
            n = sum(1 for c in self.calls if c == agent) - 1
            value = value[min(n, len(value) - 1)]
        if isinstance(value, Exception):
            raise value
        return value if isinstance(value, str) else json.dumps(value)

    def invoke_legacy(self, provider, messages, temperature=0.2):
        system = messages[0].content
        agent = next(name for marker, name in _AGENT_MARKERS.items() if marker in system)
        self.calls.append(agent)
        return AIMessage(content=self.reply_for(agent))


@pytest.fixture
def llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(nodes, "invoke_llm_with_fallback", fake.invoke_legacy)
    monkeypatch.setattr(chat_service, "invoke_llm_with_fallback", fake.invoke_legacy)
    return fake


class FakeDDGS:
    text_results: list[dict] = []
    news_results: list[dict] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def text(self, query, max_results=5):
        return self.text_results[:max_results]

    def news(self, query, max_results=5):
        return self.news_results[:max_results]


DEFAULT_WEB = [
    {"title": "Solar costs", "body": "Solar costs fell 40% since 2020.", "href": "https://example.org/solar"},
    {
        "title": "Home savings",
        "body": "Households save $500 per year.",
        "href": "https://example.org/savings",
    },
]
DEFAULT_NEWS = [
    {
        "title": "Plug-in solar bill",
        "body": "Lawmakers pass bill.",
        "url": "https://news.example/bill",
        "date": "2026-08-01",
    }
]


@pytest.fixture(autouse=True)
def search(monkeypatch):
    """Offline search with two web results and one news item; tests may overwrite the lists."""

    class Search(FakeDDGS):
        text_results = list(DEFAULT_WEB)
        news_results = list(DEFAULT_NEWS)

    monkeypatch.setattr(duckduckgo_search, "DDGS", Search)
    return Search


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_run(client, llm):
    """Create a run; TestClient executes the background graph before returning."""

    def _make(query="Impact of solar panels on household electricity costs", **extra):
        res = client.post("/api/research", json={"query": query, **extra})
        assert res.status_code == 200, res.text
        return res.json()["run_id"]

    return _make
