"""Model routing: per-kind chains, single-model mode and the 4-tier fallback (B6, B24, feature 1)."""

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from app.agent import llm
from app.config import PER_AGENT, settings


class StatusError(Exception):
    def __init__(self, status_code, message="error"):
        super().__init__(message)
        self.status_code = status_code


@pytest.fixture
def key(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "sk-or-v1-test-key-not-real")


def fake_models(monkeypatch, behaviour):
    """behaviour: model id -> reply text, or an exception to raise. Records the call order."""
    tried = []

    class Model:
        def __init__(self, model):
            self.model = model

        def invoke(self, _messages):
            tried.append(self.model)
            outcome = behaviour.get(self.model, StatusError(500))
            if isinstance(outcome, Exception):
                raise outcome
            return AIMessage(content=outcome)

    monkeypatch.setattr(llm, "_chat_model", lambda model, _t: Model(model))
    return tried


MSGS = [HumanMessage(content="hi")]


def test_per_agent_chain_uses_the_kind_model_then_shared_fallbacks():
    assert llm.model_chain("planner", PER_AGENT) == [
        settings.PLANNER_MODEL,
        settings.SECONDARY_MODEL,
        settings.THIRD_MODEL,
        settings.FALLBACK_MODEL,
    ]


def test_agents_of_the_same_kind_share_a_primary():
    assert llm.model_chain("verifier", PER_AGENT)[0] == llm.model_chain("critic", PER_AGENT)[0]
    assert llm.model_chain("writer", PER_AGENT)[0] == llm.model_chain("chat", PER_AGENT)[0]


def test_single_mode_puts_the_chosen_model_first_without_duplicates():
    chain = llm.model_chain("planner", settings.SECONDARY_MODEL)
    assert chain[0] == settings.SECONDARY_MODEL
    assert len(chain) == len(set(chain))


def test_first_model_answering_wins(key, monkeypatch):
    tried = fake_models(monkeypatch, {settings.PLANNER_MODEL: "plan"})
    reply = llm.invoke("planner", MSGS, PER_AGENT)
    assert (reply.text, reply.model) == ("plan", settings.PLANNER_MODEL)
    assert tried == [settings.PLANNER_MODEL]


def test_errors_and_empty_replies_fall_through_the_chain(key, monkeypatch):
    tried = fake_models(
        monkeypatch,
        {
            settings.PLANNER_MODEL: StatusError(404),
            settings.SECONDARY_MODEL: "  ",
            settings.THIRD_MODEL: "ok",
        },
    )
    assert llm.invoke("planner", MSGS, PER_AGENT).model == settings.THIRD_MODEL
    assert tried == [settings.PLANNER_MODEL, settings.SECONDARY_MODEL, settings.THIRD_MODEL]


@pytest.mark.parametrize(
    ("error", "reason"),
    [
        (StatusError(429, "Rate limit exceeded: free-models-per-day"), "DAILY_LIMIT"),
        (StatusError(429, "Rate limit exceeded"), "RATE_LIMITED"),
        (StatusError(500), "ALL_FAILED"),
    ],
)
def test_exhausted_chain_explains_why(key, monkeypatch, error, reason):
    fake_models(monkeypatch, dict.fromkeys(llm.model_chain("writer", PER_AGENT), error))
    with pytest.raises(llm.LLMUnavailable) as exc:
        llm.invoke("writer", MSGS, PER_AGENT)
    assert exc.value.reason == reason


def test_without_key_the_offline_reply_is_used(monkeypatch):
    tried = fake_models(monkeypatch, {})
    reply = llm.invoke("planner", MSGS, PER_AGENT, offline=lambda: "demo")
    assert (reply.text, reply.model) == ("demo", llm.OFFLINE_MODEL)
    assert tried == []


@pytest.mark.parametrize(
    ("mode", "model", "provider", "expected"),
    [
        (None, None, None, PER_AGENT),
        ("per_agent", None, None, PER_AGENT),
        ("single", None, None, settings.default_model),
        ("single", "openrouter/free", None, "openrouter/free"),
        (None, None, "openrouter/free", "openrouter/free"),  # legacy clients
        (None, None, PER_AGENT, PER_AGENT),
    ],
)
def test_resolve_model_setting(mode, model, provider, expected):
    assert llm.resolve_model_setting(mode, model, provider) == expected


@pytest.mark.parametrize(
    ("mode", "model", "provider"),
    [("single", "openai/gpt-5", None), (None, None, "groq"), ("weird", None, None)],
)
def test_unknown_models_are_rejected(mode, model, provider):
    """B24: any string used to be accepted, including paid models billed to the key."""
    with pytest.raises(ValueError):
        llm.resolve_model_setting(mode, model, provider)


def test_api_rejects_unknown_model(client):
    res = client.post(
        "/api/research", json={"query": "Solar costs", "model_mode": "single", "model": "x/paid"}
    )
    assert res.status_code == 422 and "Unknown model" in res.json()["detail"]


def test_api_stores_the_model_setting(client, make_run):
    single = make_run(model_mode="single", model="openrouter/free")
    assert client.get(f"/api/research/{single}").json()["provider"] == "openrouter/free"
    assert client.get(f"/api/research/{make_run()}").json()["provider"] == PER_AGENT


def test_default_model_falls_back_to_first_option(monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
    assert settings.default_model == settings.model_options[0]
