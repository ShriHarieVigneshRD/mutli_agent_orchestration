"""Feature 6 (delete runs) and feature 7 (undo chat edits of the report)."""

from app.db.database import AsyncSessionLocal
from app.db.models import ResearchRun
from app.services import research_service

EDIT_1 = "# Solar Report v2\n\n" + "First rewrite with more on risks. " * 6
EDIT_2 = "# Solar Report v3\n\n" + "Second rewrite with more on costs. " * 6


def edit(client, llm, run_id, markdown):
    llm.replies["chat"] = {
        "chat_response": "Done.",
        "is_report_modified": True,
        "updated_report_markdown": markdown,
    }
    return client.post(f"/api/research/{run_id}/chat", json={"message": "Rewrite it"}).json()


def report_of(client, run_id):
    return client.get(f"/api/research/{run_id}").json()["report"]


def test_chat_edits_can_be_undone_one_by_one(client, make_run, llm):
    run_id = make_run()
    original = report_of(client, run_id)["full_markdown"]
    assert report_of(client, run_id)["version_count"] == 0

    assert edit(client, llm, run_id, EDIT_1)["version_count"] == 1
    assert edit(client, llm, run_id, EDIT_2)["version_count"] == 2
    assert report_of(client, run_id)["full_markdown"] == EDIT_2

    first = client.post(f"/api/research/{run_id}/report/revert").json()
    assert first == {"full_markdown": EDIT_1, "version_count": 1}
    second = client.post(f"/api/research/{run_id}/report/revert").json()
    assert second == {"full_markdown": original, "version_count": 0}
    assert report_of(client, run_id)["full_markdown"] == original

    nothing_left = client.post(f"/api/research/{run_id}/report/revert")
    assert nothing_left.status_code == 409


def test_answers_without_edits_create_no_versions(client, make_run, llm):
    run_id = make_run()
    client.post(f"/api/research/{run_id}/chat", json={"message": "Question"})
    assert report_of(client, run_id)["version_count"] == 0


def test_revert_unknown_run_is_404(client):
    assert client.post("/api/research/nope/report/revert").status_code == 404


def test_delete_run_removes_everything(client, make_run, llm):
    run_id = make_run()
    edit(client, llm, run_id, EDIT_1)
    report_id = report_of(client, run_id)["id"]

    assert client.delete(f"/api/research/{run_id}").status_code == 204
    assert client.get(f"/api/research/{run_id}").status_code == 404
    assert client.get(f"/api/history/reports/{report_id}").status_code == 404
    assert run_id not in [r["id"] for r in client.get("/api/history?limit=100").json()["runs"]]


def test_delete_unknown_run_is_404(client):
    assert client.delete("/api/research/nope").status_code == 404


def test_running_runs_cannot_be_deleted(client):
    async def add_running_run():
        async with AsyncSessionLocal() as session:
            session.add(ResearchRun(id="busy-run", query="Busy", provider="per-agent", status="running"))
            await session.commit()

    client.portal.call(add_running_run)
    research_service.active_runs.add("busy-run")
    res = client.delete("/api/research/busy-run")
    assert res.status_code == 409 and "in progress" in res.json()["detail"]
