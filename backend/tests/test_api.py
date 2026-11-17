"""Characterization tests for the HTTP API (feature checklist F1–F8)."""

import pytest


def test_create_run_executes_whole_pipeline(client, make_run, llm):
    run_id = make_run()
    run = client.get(f"/api/research/{run_id}").json()

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
    assert run["report"]["critic_feedback"] == "Clear and sourced."
    assert llm.calls.count("writer") == 1


def test_create_run_response_shape(client, llm):
    res = client.post("/api/research", json={"query": "Heat pumps in cold climates"})
    body = res.json()
    assert res.status_code == 200
    assert body["status"] == "pending"
    assert set(body) == {"run_id", "status", "message"}


@pytest.mark.parametrize("query", ["", "   "])
def test_blank_query_is_rejected(client, query):
    res = client.post("/api/research", json={"query": query})
    assert res.status_code in (400, 422)


def test_unknown_run_is_404(client):
    assert client.get("/api/research/does-not-exist").status_code == 404


def test_history_lists_runs_newest_first(client, make_run):
    first = make_run("First history question about solar")
    second = make_run("Second history question about wind")
    history = client.get("/api/history").json()
    runs = history["runs"] if isinstance(history, dict) else history
    ids = [r["id"] for r in runs]
    assert ids.index(second) < ids.index(first)
    entry = next(r for r in runs if r["id"] == second)
    assert entry["has_report"] is True and entry["report_id"]
    assert entry["status"] == "completed"


def test_history_limit_is_validated(client):
    assert client.get("/api/history?limit=0").status_code == 422
    assert client.get("/api/history?limit=101").status_code == 422


def test_report_by_id(client, make_run):
    run_id = make_run()
    report_id = client.get(f"/api/research/{run_id}").json()["report"]["id"]
    report = client.get(f"/api/history/reports/{report_id}").json()
    assert report["run_id"] == run_id
    assert client.get("/api/history/reports/nope").status_code == 404


def test_chat_answers_and_persists_history(client, make_run, llm):
    run_id = make_run()
    res = client.post(f"/api/research/{run_id}/chat", json={"message": "Summarise it"})
    assert res.status_code == 200
    assert res.json() == {
        "chat_response": "Here is the answer.",
        "is_report_modified": False,
        "updated_report_markdown": None,
    }
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
    assert client.get(f"/api/research/{run_id}").json()["report"]["full_markdown"] == new_md


def test_chat_ignores_tiny_report_edits(client, make_run, llm):
    run_id = make_run()
    llm.replies["chat"] = {
        "chat_response": "Done.",
        "is_report_modified": True,
        "updated_report_markdown": "tiny",
    }
    client.post(f"/api/research/{run_id}/chat", json={"message": "Shorten"})
    assert (
        client.get(f"/api/research/{run_id}").json()["report"]["full_markdown"].startswith("# Solar Report")
    )


def test_chat_validation(client, make_run):
    run_id = make_run()
    assert client.post(f"/api/research/{run_id}/chat", json={"message": "  "}).status_code in (400, 422)
    assert client.post("/api/research/nope/chat", json={"message": "hi"}).status_code == 404


def test_failed_llm_still_produces_a_run_record(client, make_run, llm):
    llm.replies["writer"] = RuntimeError("all models down")
    run_id = make_run()
    run = client.get(f"/api/research/{run_id}").json()
    assert run["status"] in ("completed", "failed")


# ---- Known bugs (ANALYSIS.md §7). strict xfail: fixing the bug turns these into regression tests.


@pytest.mark.xfail(strict=True, reason="B1: /health reads settings.LLM_PROVIDER which does not exist")
def test_health(client):
    assert client.get("/health").status_code == 200
    assert client.get("/api/health").status_code == 200


@pytest.mark.xfail(strict=True, reason="B2: sources are read from the verifier update, which has no findings")
def test_sources_are_saved(client, make_run):
    run_id = make_run()
    urls = {s["url"] for s in client.get(f"/api/research/{run_id}").json()["sources"]}
    assert {"https://example.org/solar", "https://news.example/bill"} <= urls


@pytest.mark.xfail(strict=True, reason="B7: critic 'Approved' ends the graph without a final report")
def test_non_exact_critic_approval_completes_run(client, make_run, llm):
    llm.replies["critic"] = {"decision": "Approved", "feedback": "Fine."}
    run = client.get(f"/api/research/{make_run()}").json()
    assert run["status"] == "completed" and run["report"] is not None


@pytest.mark.xfail(strict=True, reason="B12: timestamps are naive UTC without an offset")
def test_timestamps_are_utc_aware(client, make_run):
    created = client.get(f"/api/research/{make_run()}").json()["created_at"]
    assert created.endswith("Z") or created.endswith("+00:00")


@pytest.mark.xfail(strict=True, reason="B19: chat history of an unknown run returns 200")
def test_chat_history_unknown_run_is_404(client):
    assert client.get("/api/research/nope/chat").status_code == 404
