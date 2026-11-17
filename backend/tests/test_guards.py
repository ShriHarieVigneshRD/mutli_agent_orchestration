"""Abuse protection: rate limits, concurrency cap, length caps and CORS (feature 3)."""

from app.config import settings
from app.services import research_service


def test_research_rate_limit(client, llm, monkeypatch):
    monkeypatch.setattr(settings, "RESEARCH_RATE_LIMIT_PER_HOUR", 2)
    for _ in range(2):
        assert client.post("/api/research", json={"query": "Solar costs"}).status_code == 200
    res = client.post("/api/research", json={"query": "Solar costs"})
    assert res.status_code == 429
    assert int(res.headers["Retry-After"]) > 0


def test_chat_rate_limit(client, make_run, monkeypatch):
    run_id = make_run()
    monkeypatch.setattr(settings, "CHAT_RATE_LIMIT_PER_MIN", 1)
    assert client.post(f"/api/research/{run_id}/chat", json={"message": "a"}).status_code == 200
    assert client.post(f"/api/research/{run_id}/chat", json={"message": "b"}).status_code == 429


def test_concurrent_run_cap(client, llm, monkeypatch):
    monkeypatch.setattr(settings, "MAX_CONCURRENT_RUNS", 2)
    research_service.active_runs.update({"busy-1", "busy-2"})
    res = client.post("/api/research", json={"query": "Solar costs"})
    assert res.status_code == 429 and "busy" in res.json()["detail"]


def test_finished_runs_free_their_slot(client, make_run):
    make_run()
    assert research_service.active_runs == set()


def test_query_length_limits(client, llm):
    assert client.post("/api/research", json={"query": "abc"}).status_code == 422
    too_long = "x" * (settings.MAX_QUERY_CHARS + 1)
    res = client.post("/api/research", json={"query": too_long})
    assert res.status_code == 422 and "too long" in res.json()["detail"]


def test_chat_length_limit(client, make_run):
    run_id = make_run()
    res = client.post(f"/api/research/{run_id}/chat", json={"message": "x" * (settings.MAX_CHAT_CHARS + 1)})
    assert res.status_code == 422


def test_cors_allows_only_configured_origins(client):
    ok = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    other = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers
