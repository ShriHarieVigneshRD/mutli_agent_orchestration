"""HTTP API: characterization of features F1-F8 plus regression tests for fixed bugs."""

import json

import pytest

from app.agent.llm import LLMUnavailable
from app.db.database import AsyncSessionLocal
from app.db.models import ResearchRun


def run_of(client, run_id):
    return client.get(f"/api/research/{run_id}").json()


def test_create_run_executes_whole_pipeline(client, make_run, llm):
    run = run_of(client, make_run())

    assert run["status"] == "completed"
    assert run["current_step"] == "completed"
    assert run["plan"]["tasks"] == ["Find cost data", "Find adoption news"]
    # The planner's unknown agent ("hacker") is filtered out.
    assert run["plan"]["agents_required"] == ["researcher", "data_analyst", "news_agent"]
    assert {log["agent_name"] for log in run["logs"]} == {
        "planner",
        "researcher",
        "data_analyst",
        "news_agent",
        "verifier",
        "writer",
        "critic",
    }
    assert run["report"]["full_markdown"].startswith("# Solar Report")
    assert run["report"]["title"] == "Solar Report"
    assert run["report"]["critic_feedback"] == "Clear and sourced."
    assert llm.calls.count("writer") == 1


def test_create_run_response_shape(client, llm):
    res = client.post("/api/research", json={"query": "Heat pumps in cold climates"})
    assert res.status_code == 200
    assert res.json()["status"] == "pending"
    assert set(res.json()) == {"run_id", "status", "message"}


@pytest.mark.parametrize("query", ["", "   "])
def test_blank_query_is_rejected(client, query):
    assert client.post("/api/research", json={"query": query}).status_code == 400


def test_unknown_run_is_404(client):
    assert client.get("/api/research/does-not-exist").status_code == 404


def test_history_lists_runs_newest_first(client, make_run):
    first = make_run("First history question about solar")
    second = make_run("Second history question about wind")
    history = client.get("/api/history").json()
    ids = [r["id"] for r in history["runs"]]
    assert ids.index(second) < ids.index(first)
    entry = next(r for r in history["runs"] if r["id"] == second)
    assert entry["has_report"] is True and entry["report_id"]
    assert entry["status"] == "completed"


def test_history_paging_reports_total(client, make_run):
    """B25: history used to stop at 20 runs with no way to see older ones."""
    make_run("Paging question one")
    make_run("Paging question two")
    page = client.get("/api/history?limit=1&offset=1").json()
    assert page["total"] >= 2 and page["limit"] == 1 and page["offset"] == 1
    assert len(page["runs"]) == 1


def test_history_limit_is_validated(client):
    assert client.get("/api/history?limit=0").status_code == 422
    assert client.get("/api/history?limit=101").status_code == 422


def test_report_by_id(client, make_run):
    run_id = make_run()
    report_id = run_of(client, run_id)["report"]["id"]
    assert client.get(f"/api/history/reports/{report_id}").json()["run_id"] == run_id
    assert client.get("/api/history/reports/nope").status_code == 404


# ---- chat (F4, F5)


def test_chat_answers_and_persists_history(client, make_run, llm):
    run_id = make_run()
    res = client.post(f"/api/research/{run_id}/chat", json={"message": "Summarise it"}).json()
    assert res["chat_response"] == "Here is the answer."
    assert res["is_report_modified"] is False
    assert res["model_used"] == "fake/chat"
    messages = client.get(f"/api/research/{run_id}/chat").json()["messages"]
    assert [(m["role"], m["content"]) for m in messages] == [
        ("user", "Summarise it"),
        ("assistant", "Here is the answer."),
    ]


def test_chat_can_edit_the_report(client, make_run, llm):
    run_id = make_run()
    new_md = "# Solar Report v2\n\n" + "Updated executive summary with more risk detail. " * 5
    llm.replies["chat"] = {
        "chat_response": "Done.",
        "is_report_modified": True,
        "updated_report_markdown": new_md,
    }
    res = client.post(f"/api/research/{run_id}/chat", json={"message": "Add risks"}).json()
    assert res["is_report_modified"] is True
    assert run_of(client, run_id)["report"]["full_markdown"] == new_md


def test_chat_ignores_tiny_report_edits(client, make_run, llm):
    run_id = make_run()
    llm.replies["chat"] = {
        "chat_response": "Done.",
        "is_report_modified": True,
        "updated_report_markdown": "tiny",
    }
    client.post(f"/api/research/{run_id}/chat", json={"message": "Shorten"})
    assert run_of(client, run_id)["report"]["full_markdown"].startswith("# Solar Report")


def test_chat_validation(client, make_run):
    run_id = make_run()
    assert client.post(f"/api/research/{run_id}/chat", json={"message": "  "}).status_code == 400
    assert client.post("/api/research/nope/chat", json={"message": "hi"}).status_code == 404


def test_chat_history_unknown_run_is_404(client):
    """B19"""
    assert client.get("/api/research/nope/chat").status_code == 404


def test_chat_model_runs_off_the_event_loop(client, make_run, llm):
    """B8: the blocking model call used to freeze every other request and stream."""
    run_id = make_run()
    client.post(f"/api/research/{run_id}/chat", json={"message": "Hi"})
    assert llm.threads["chat"].startswith("asyncio")


def test_chat_reports_model_outage_and_saves_nothing(client, make_run, llm):
    run_id = make_run()
    llm.replies["chat"] = LLMUnavailable("DAILY_LIMIT")
    res = client.post(f"/api/research/{run_id}/chat", json={"message": "Hi"})
    assert res.status_code == 503
    assert "daily limit" in res.json()["detail"]
    assert client.get(f"/api/research/{run_id}/chat").json()["messages"] == []


# ---- health / models (F8)


def test_health(client):
    """B1: /health used to 500 on a missing setting."""
    for path in ("/health", "/api/health"):
        body = client.get(path).json()
        assert body["status"] == "healthy" and body["llm_configured"] is False


def test_models_endpoint(client):
    body = client.get("/api/models").json()
    assert body["default_mode"] == "per_agent"
    assert body["default_model"] in body["options"]
    assert [k["kind"] for k in body["kinds"]] == ["supervisor", "specialist", "reviewer", "writer"]
    assert body["fallbacks"][-1] == "openrouter/free"


# ---- regression tests for fixed bugs


def test_sources_are_saved_in_citation_order(client, make_run):
    """B2: sources were read from the verifier's update, which never contains findings."""
    sources = run_of(client, make_run())["sources"]
    assert [s["url"] for s in sources] == [
        "https://example.org/solar",
        "https://example.org/savings",
        "https://news.example/bill",
    ]


def test_non_exact_critic_approval_completes_run(client, make_run, llm):
    """B7: 'Approved' used to end the graph without a report, leaving the run 'running' forever."""
    llm.replies["critic"] = {"decision": "Approved", "feedback": "Fine."}
    run = run_of(client, make_run())
    assert run["status"] == "completed" and run["report"] is not None


def test_timestamps_are_utc_aware(client, make_run):
    """B12: naive timestamps were shown 5 h 30 m off in India."""
    assert run_of(client, make_run())["created_at"].endswith("Z")


def test_agent_logs_carry_status_and_model(client, make_run):
    """B10: status/error never reached the UI, so failure badges could not render."""
    logs = {log["agent_name"]: log for log in run_of(client, make_run())["logs"]}
    assert logs["planner"]["details"]["model_used"] == "fake/planner"
    assert logs["researcher"]["details"]["status"] == "completed"
    assert logs["writer"]["details"]["model_used"] == "fake/writer"


def test_writer_failure_fails_the_run_with_reason(client, make_run, llm):
    llm.replies["writer"] = LLMUnavailable("RATE_LIMITED")
    run = run_of(client, make_run())
    assert run["status"] == "failed"
    assert "rate-limited" in run["error_message"]
    assert run["sources"], "gathered sources stay viewable"
    assert any(log["agent_name"] == "writer" and log["status"] == "failed" for log in run["logs"])


def test_offline_demo_mode_produces_a_labelled_report(client):
    """Without an API key the pipeline still runs, from real search results, clearly labelled."""
    res = client.post("/api/research", json={"query": "Solar panel adoption in India"})
    run = run_of(client, res.json()["run_id"])
    assert run["status"] == "completed"
    md = run["report"]["full_markdown"]
    assert "Offline demo" in md and "https://example.org/solar" in md
    assert {log["details"].get("model_used") for log in run["logs"] if log["agent_name"] == "writer"} == {
        "offline-demo"
    }


def test_stream_replays_and_closes_for_finished_run(client, make_run):
    """B5 + B20: late subscribers missed early events, and the stream never ended."""
    run_id = make_run()
    with client.stream("GET", f"/api/research/{run_id}/stream") as res:
        body = "".join(res.iter_text())
    payloads = [json.loads(line[5:]) for line in body.splitlines() if line.startswith("data:")]
    events = [p["event"] for p in payloads if "event" in p]
    assert events[0] == "research_started"
    assert "planner_started" in events and "planner_completed" in events
    assert events[-1] == "research_completed"


def test_stream_of_unknown_run_is_404(client):
    assert client.get("/api/research/nope/stream").status_code == 404


def test_interrupted_runs_are_marked_failed_on_startup(client):
    """B22: runs cut off by a restart stayed 'running' forever."""
    from app.services.research_service import INTERRUPTED, recover_interrupted_runs

    async def add_stuck_run():
        async with AsyncSessionLocal() as session:
            session.add(ResearchRun(id="stuck-run", query="Stuck", provider="per-agent", status="running"))
            await session.commit()

    client.portal.call(add_stuck_run)
    assert client.portal.call(recover_interrupted_runs) >= 1
    run = run_of(client, "stuck-run")
    assert run["status"] == "failed" and run["error_message"] == INTERRUPTED
