"""Characterization tests for the graph, nodes, tools and SSE manager (F9–F17)."""

import asyncio

import pytest
from langgraph.graph import END

from app.agent import nodes, tools
from app.agent.graph import route_after_critic
from app.services.sse_manager import SSEManager

STATE = {
    "query": "Impact of solar panels on household electricity costs",
    "provider": "openrouter/free",
    "run_id": "t",
    "plan": None,
    "research_findings": [],
    "data_findings": [],
    "news_findings": [],
    "agent_outputs": {},
    "verified_evidence": [],
    "unsupported_claims": [],
    "draft_report": "",
    "critic_decision": "",
    "critic_feedback": "",
    "revision_count": 0,
    "max_revisions": 2,
    "final_report": "",
    "current_node": "initialized",
    "error": None,
}


# ---- routing / reflection loop (F9, F16)

@pytest.mark.parametrize(
    ("decision", "count", "expected"),
    [("APPROVE", 0, END), ("REVISE", 0, "writer"), ("REVISE", 1, "writer"), ("REVISE", 2, END)],
)
def test_route_after_critic(decision, count, expected):
    assert route_after_critic({"critic_decision": decision, "revision_count": count, "max_revisions": 2}) == expected


def test_critic_revise_loop_runs_writer_twice_then_forces_approve(client, make_run, llm):
    llm.replies["critic"] = {"decision": "REVISE", "feedback": "Add more numbers."}
    run = client.get(f"/api/research/{make_run()}").json()
    assert llm.calls.count("writer") == 2
    assert llm.calls.count("critic") == 2
    assert run["status"] == "completed"
    assert "Maximum revision threshold" in run["report"]["critic_feedback"]


def test_writer_receives_critic_feedback_on_revision(client, make_run, llm, monkeypatch):
    seen = []
    original = llm.invoke_legacy

    def spy(provider, messages, temperature=0.2):
        if "Research Writer" in messages[0].content:
            seen.append(messages[1].content)
        return original(provider, messages, temperature)

    monkeypatch.setattr(nodes, "invoke_llm_with_fallback", spy)
    llm.replies["critic"] = [{"decision": "REVISE", "feedback": "Cite the savings."}, {"decision": "APPROVE"}]
    make_run()
    assert "Cite the savings." in seen[1]


# ---- planner (F10)

def test_planner_falls_back_to_default_plan_on_bad_json(llm):
    llm.replies["planner"] = "not json"
    plan = nodes.planner_node(dict(STATE))["plan"]
    assert plan["agents_required"] == ["researcher", "data_analyst", "news_agent"]
    assert len(plan["tasks"]) == 3


def test_planner_passes_agent_prompts(llm):
    plan = nodes.planner_node(dict(STATE))["plan"]
    assert plan["agent_prompts"]["researcher"] == "solar panel household savings"


# ---- gatherers (F11–F13)

def test_researcher_uses_planner_query_and_maps_findings(search):
    state = dict(STATE, plan={"agent_prompts": {"researcher": "solar savings"}})
    out = nodes.research_node(state)
    assert [f["url"] for f in out["research_findings"]] == ["https://example.org/solar", "https://example.org/savings"]
    assert out["agent_outputs"]["researcher"]["status"] == "completed"


def test_news_falls_back_to_web_search_when_no_news(search):
    search.news_results = []
    results = tools.execute_news_search("solar")
    assert results and all(r["source_type"] == "news" for r in results)


def test_data_analysis_extracts_figures_from_text():
    res = tools.execute_data_analysis("solar", "Costs fell 40% and saved $500 million by 2025.")
    assert "40%" in res["content"]
    assert res["source_type"] == "data"


@pytest.mark.xfail(strict=True, reason="B3: empty search results are replaced with fabricated Reuters/Bloomberg items")
def test_empty_web_search_returns_nothing(search):
    search.text_results = []
    assert tools.execute_web_search("solar panel costs") == []


@pytest.mark.xfail(strict=True, reason="B3: data analyst invents statistics when the text has none")
def test_data_analysis_never_invents_figures():
    res = tools.execute_data_analysis("solar", "No numbers here.")
    assert "30% AI task automation" not in res["content"]


# ---- keyword extraction / JSON parsing / LLM factory

def test_short_queries_are_unchanged():
    assert tools.extract_search_keywords("solar panel costs") == "solar panel costs"


def test_long_queries_are_shortened():
    long_q = "Why are households adopting rooftop solar so quickly. " + "Explain the economics in detail " * 10
    assert tools.extract_search_keywords(long_q) == "Why are households adopting rooftop solar so quickly"
    assert len(tools.extract_search_keywords("word " * 60)) <= 90


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('{"a": 1}', {"a": 1}),
        ('```json\n{"a": 1}\n```', {"a": 1}),
        ('```\n{"a": 1}\n```', {"a": 1}),
        ([{"type": "text", "text": '{"a": 1}'}], {"a": 1}),
        ("nonsense", {}),
    ],
)
def test_parse_json_from_llm(raw, expected):
    assert nodes.parse_json_from_llm(raw) == expected


def test_extract_text_handles_content_blocks():
    assert nodes.extract_text(["a", {"text": "b"}, {"image": "x"}]) == "a\nb"


def test_mock_llm_used_without_api_key():
    from app.agent.llm import LLMFactory, MockFallbackLLM

    assert isinstance(LLMFactory.get_model("openrouter/free"), MockFallbackLLM)


# ---- SSE manager (F3)

def test_sse_broadcast_reaches_subscribers():
    async def scenario():
        mgr = SSEManager()
        q = mgr.subscribe("r1")
        await mgr.broadcast("r1", "planner_completed", {"x": 1})
        msg = await q.get()
        mgr.unsubscribe("r1", q)
        return msg

    assert '"event": "planner_completed"' in asyncio.run(scenario())


@pytest.mark.xfail(strict=True, reason="B5: events sent before a client subscribes are lost (no replay)")
def test_sse_replays_events_to_late_subscribers():
    async def scenario():
        mgr = SSEManager()
        await mgr.broadcast("r1", "research_started", {})
        q = mgr.subscribe("r1")
        return q.qsize()

    assert asyncio.run(scenario()) == 1
