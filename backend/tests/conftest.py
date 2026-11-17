"""Shared fixtures. Forces a fully offline, deterministic environment.

Env overrides run before any `app` import, so the real keys and the Neon URL in
backend/.env are never used by tests (env vars take precedence over .env).
"""

import json
import os
import pathlib
import tempfile
import threading

import pytest

_TMP = pathlib.Path(tempfile.mkdtemp(prefix="research-tests-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite+aiosqlite:///{(_TMP / 'test.db').as_posix()}",
        "OPENROUTER_API_KEY": "",
        "TAVILY_API_KEY": "",
        "SEARCH_PROVIDER": "auto",
        "DEFAULT_MODEL": "nvidia/nemotron-3-ultra-550b-a55b:free",
        "MAX_REVISIONS": "1",
        "RESEARCH_RATE_LIMIT_PER_HOUR": "100000",
        "CHAT_RATE_LIMIT_PER_MIN": "100000",
        "MAX_CONCURRENT_RUNS": "100",
        "CORS_ORIGINS": "http://localhost:5173",
    }
)

import langchain_openai  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.agent import llm as llm_module  # noqa: E402
from app.agent import tools  # noqa: E402
from app.api import deps  # noqa: E402
from app.main import app  # noqa: E402
from app.services import research_service  # noqa: E402


def _offline(*_args, **_kwargs):
    raise RuntimeError("network disabled in tests")


# Patched at import time so nothing can reach OpenRouter or DuckDuckGo by accident.
langchain_openai.ChatOpenAI.invoke = _offline
tools.DDGS = _offline

DEFAULT_REPLIES = {
    "planner": {
        "tasks": ["Find cost data", "Find adoption news"],
        "agents_required": ["researcher", "data_analyst", "news_agent", "hacker"],
        "focus_areas": ["Costs", "Adoption"],
        "agent_prompts": {
            "researcher": "solar panel household savings",
            "news_agent": "solar panel news",
            "data_analyst": "solar panel cost",
        },
    },
    "data_analyst": {
        "figures": [
            {"metric": "Solar cost decline", "value": "40%", "source": 1, "context": "Since 2020."},
            {"metric": "Invented", "value": "99%", "source": 1, "context": "Not in the text."},
        ]
    },
    "verifier": {
        "verified_evidence": [
            {
                "claim": "Solar costs fell 40% since 2020",
                "is_verified": True,
                "confidence_score": 0.9,
                "reasoning": "Stated by source 1",
                "supporting_sources": [1],
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
    """Scripted replies per agent. A list value is consumed in order (last item repeats); an
    exception value is raised."""

    def __init__(self):
        self.replies = dict(DEFAULT_REPLIES)
        self.calls: list[str] = []
        self.messages: dict[str, list] = {}
        self.threads: dict[str, str] = {}

    def invoke(self, agent, messages, model_setting=None, temperature=0.2, offline=None):
        self.calls.append(agent)
        self.messages.setdefault(agent, []).append(messages)
        self.threads[agent] = threading.current_thread().name
        value = self.replies[agent]
        if isinstance(value, list):
            value = value[min(self.calls.count(agent) - 1, len(value) - 1)]
        if isinstance(value, Exception):
            raise value
        text = value if isinstance(value, str) else json.dumps(value)
        return llm_module.LLMReply(text, f"fake/{agent}")


@pytest.fixture
def llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(llm_module, "invoke", fake.invoke)
    return fake


class FakeDDGS:
    text_results: list[dict] = []
    news_results: list[dict] = []
    queries: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def text(self, query, max_results=5):
        self.queries.append(query)
        return self.text_results[:max_results]

    def news(self, query, max_results=5):
        self.queries.append(query)
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
        queries: list[str] = []

    monkeypatch.setattr(tools, "DDGS", Search)
    return Search


@pytest.fixture(autouse=True)
def fresh_limits():
    deps.research_limiter.reset()
    deps.chat_limiter.reset()
    research_service.active_runs.clear()


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
