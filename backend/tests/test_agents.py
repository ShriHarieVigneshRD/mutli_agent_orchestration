"""Graph, nodes, tools and SSE manager: characterization of F9-F17 plus regression tests."""

import asyncio

import pytest
from langgraph.graph import END

from app.agent import nodes, tools
from app.agent.graph import route_after_critic
from app.agent.llm import LLMUnavailable, extract_text, parse_json_from_llm
from app.services.sse_manager import SSEManager

STATE = {
    "query": "Impact of solar panels on household electricity costs",
    "provider": "per-agent",
    "run_id": "t",
    "plan": None,
    "research_findings": [],
    "data_findings": [],
    "news_findings": [],
    "agent_outputs": {},
    "verified_evidence": [],
    "unsupported_claims": [],
    "draft_report": "# Draft",
    "critic_decision": "",
    "critic_feedback": "",
    "revision_count": 0,
    "max_revisions": 1,
    "final_report": "",
    "current_node": "initialized",
    "error": None,
}


def state(**overrides):
    return {**STATE, **overrides}


# ---- routing / reflection loop (F9, F16)


@pytest.mark.parametrize(("decision", "expected"), [("APPROVE", END), ("REVISE", "writer")])
def test_route_after_critic_follows_the_critic(decision, expected):
    assert route_after_critic(state(critic_decision=decision)) == expected


def test_critic_revise_loop_respects_max_revisions(client, make_run, llm):
    llm.replies["critic"] = {"decision": "REVISE", "feedback": "Add more numbers."}
    run = client.get(f"/api/research/{make_run()}").json()
    assert llm.calls.count("writer") == 2  # MAX_REVISIONS=1: one draft + one rewrite (same as before)
    assert run["status"] == "completed"
    assert "Revision limit of 1 reached" in run["report"]["critic_feedback"]


def test_max_revisions_means_rewrites_allowed(client, make_run, llm, monkeypatch):
    """B14: max_revisions=2 used to allow only one rewrite."""
    from app.config import settings

    monkeypatch.setattr(settings, "MAX_REVISIONS", 2)
    llm.replies["critic"] = {"decision": "REVISE", "feedback": "More."}
    make_run()
    assert llm.calls.count("writer") == 3


def test_writer_receives_critic_feedback_on_revision(make_run, llm):
    llm.replies["critic"] = [{"decision": "REVISE", "feedback": "Cite the savings."}, {"decision": "APPROVE"}]
    make_run()
    assert "Cite the savings." in llm.messages["writer"][1][1].content


@pytest.mark.parametrize("decision", ["Approved", "approve.", "LGTM", ""])
def test_critic_treats_anything_but_revise_as_approval(llm, decision):
    llm.replies["critic"] = {"decision": decision, "feedback": "ok"}
    out = nodes.critic_node(state())
    assert out["critic_decision"] == "APPROVE" and out["final_report"] == "# Draft"


def test_critic_outage_approves_honestly(llm):
    llm.replies["critic"] = LLMUnavailable("ALL_FAILED")
    out = nodes.critic_node(state())
    assert out["critic_decision"] == "APPROVE"
    assert "Critic unavailable" in out["critic_feedback"]
    assert out["agent_outputs"]["critic"]["status"] == "degraded"


# ---- planner (F10)


def test_planner_falls_back_to_default_plan_on_bad_json(llm):
    llm.replies["planner"] = "not json"
    out = nodes.planner_node(state())
    assert out["plan"]["agents_required"] == ["researcher", "data_analyst", "news_agent"]
    assert len(out["plan"]["tasks"]) == 3
    assert out["agent_outputs"]["planner"]["status"] == "degraded"


def test_planner_passes_agent_prompts(llm):
    plan = nodes.planner_node(state())["plan"]
    assert plan["agent_prompts"]["researcher"] == "solar panel household savings"


# ---- gatherers (F11-F13)


def test_researcher_uses_planner_query_and_maps_findings(search):
    out = nodes.research_node(state(plan={"agent_prompts": {"researcher": "solar savings"}}))
    assert [f["url"] for f in out["research_findings"]] == [
        "https://example.org/solar",
        "https://example.org/savings",
    ]
    assert out["agent_outputs"]["researcher"]["status"] == "completed"
    assert search.queries == ["solar savings"]


def test_researcher_falls_back_to_news_when_web_search_is_empty(search):
    search.text_results = []
    out = nodes.research_node(state())
    assert [(f["url"], f["source_type"]) for f in out["research_findings"]] == [
        ("https://news.example/bill", "news")
    ]


def test_ad_links_are_dropped(search):
    search.text_results = [
        *search.text_results,
        {"title": "Ad", "body": "Buy", "href": "https://www.bing.com/aclick?ld=abc"},
    ]
    assert all("aclick" not in r["url"] for r in tools.execute_web_search("solar"))


def test_researcher_reports_no_results_honestly(search):
    search.text_results = []
    search.news_results = []
    out = nodes.research_node(state())
    assert out["research_findings"] == []
    assert out["agent_outputs"]["researcher"]["status"] == "completed_with_no_results"


def test_news_falls_back_to_web_search_when_no_news(search):
    search.news_results = []
    results = tools.execute_news_search("solar")
    assert results and all(r["source_type"] == "news" for r in results)


def test_empty_web_search_returns_nothing(search):
    """B3: empty results were replaced with fabricated Reuters/Bloomberg items."""
    search.text_results = []
    assert tools.execute_web_search("solar panel costs") == []


def test_search_can_be_switched_off(search, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "SEARCH_PROVIDER", "off")
    assert tools.execute_web_search("solar") == [] and tools.execute_news_search("solar") == []
    assert search.queries == []


def test_data_analyst_keeps_only_figures_found_in_sources(llm, search):
    """B3 + B9: the analyst invented statistics and never saw any real findings."""
    out = nodes.data_analyst_node(state(plan={"agent_prompts": {"data_analyst": "solar cost"}}))
    assert search.queries == ["solar cost statistics"]
    titles = [f["title"] for f in out["data_findings"]]
    assert titles == ["Solar cost decline: 40%"]  # the invented 99% is dropped
    assert out["data_findings"][0]["url"] == "https://example.org/solar"
    assert out["agent_outputs"]["data_analyst"]["model_used"] == "fake/data_analyst"


def test_data_analyst_falls_back_to_plain_extraction(llm, search):
    llm.replies["data_analyst"] = LLMUnavailable("RATE_LIMITED")
    out = nodes.data_analyst_node(state())
    contents = [f["content"] for f in out["data_findings"]]
    assert contents == ["- 40%", "- $500"]
    assert out["agent_outputs"]["data_analyst"]["status"] == "degraded"


def test_data_analyst_never_invents_figures(llm, search):
    search.text_results = [{"title": "Words", "body": "No numbers here.", "href": "https://example.org/w"}]
    llm.replies["data_analyst"] = {"figures": []}
    out = nodes.data_analyst_node(state())
    assert out["data_findings"] == []
    assert out["agent_outputs"]["data_analyst"]["status"] == "completed_with_no_results"


def test_extract_figures():
    text = "Costs fell 40% and saved $500 million; 3 billion people; 12.5 percent; in 2025."
    assert tools.extract_figures(text) == ["40%", "$500 million", "3 billion", "12.5 percent"]


# ---- verifier and writer (F14, F15)

FINDINGS = {
    "research_findings": [
        {"title": "A", "content": "a", "url": "https://a", "source_type": "web", "timestamp": None},
        {"title": "B", "content": "b", "url": "https://b", "source_type": "web", "timestamp": None},
    ],
    "news_findings": [
        {"title": "A again", "content": "a", "url": "https://a", "source_type": "news", "timestamp": None}
    ],
}


def test_numbered_sources_dedupe_by_url():
    assert [(s["n"], s["url"]) for s in nodes.numbered_sources(FINDINGS)] == [
        (1, "https://a"),
        (2, "https://b"),
    ]


def test_verifier_maps_supporting_sources_to_numbers(llm):
    llm.replies["verifier"] = {
        "verified_evidence": [
            {"claim": "x", "confidence_score": "high", "supporting_sources": ["https://b", 1, "[9]"]}
        ]
    }
    claim = nodes.verifier_node(state(**FINDINGS))["verified_evidence"][0]
    assert claim["supporting_sources"] == [2, 1]
    assert claim["confidence_score"] is None


def test_verifier_outage_marks_claims_unverified(llm):
    llm.replies["verifier"] = LLMUnavailable("ALL_FAILED")
    out = nodes.verifier_node(state(**FINDINGS))
    assert all(not c["is_verified"] and c["confidence_score"] is None for c in out["verified_evidence"])
    assert out["agent_outputs"]["verifier"]["status"] == "degraded"


def test_verifier_skips_the_model_without_sources(llm):
    out = nodes.verifier_node(state())
    assert out["verified_evidence"] == [] and "verifier" not in llm.calls


def test_writer_gets_numbered_sources_with_urls(llm):
    """B21: the writer had no URLs, so its references were invented."""
    nodes.writer_node(state(**FINDINGS))
    prompt = llm.messages["writer"][0][1].content
    assert "[1] A, https://a" in prompt and "[2] B, https://b" in prompt


# ---- keyword extraction / JSON parsing


def test_short_queries_are_unchanged():
    assert tools.extract_search_keywords("solar panel costs") == "solar panel costs"


def test_long_queries_are_shortened():
    long_q = (
        "Why are households adopting rooftop solar so quickly. " + "Explain the economics in detail " * 10
    )
    assert tools.extract_search_keywords(long_q) == "Why are households adopting rooftop solar so quickly"
    assert len(tools.extract_search_keywords("word " * 60)) <= 90


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('{"a": 1}', {"a": 1}),
        ('```json\n{"a": 1}\n```', {"a": 1}),
        ('```\n{"a": 1}\n```', {"a": 1}),
        ([{"type": "text", "text": '{"a": 1}'}], {"a": 1}),
        ('Sure! Here it is: {"a": 1} Hope that helps.', {"a": 1}),
        ("[1, 2]", {}),
        ("nonsense", {}),
    ],
)
def test_parse_json_from_llm(raw, expected):
    assert parse_json_from_llm(raw) == expected


def test_extract_text_handles_content_blocks():
    assert extract_text(["a", {"text": "b"}, {"image": "x"}]) == "a\nb"


# ---- SSE manager (F3)


def test_sse_broadcast_reaches_subscribers():
    async def scenario():
        mgr = SSEManager()
        q = mgr.subscribe("r1")
        await mgr.broadcast("r1", "planner_completed", {"x": 1})
        return await q.get()

    assert '"event": "planner_completed"' in asyncio.run(scenario())


def test_sse_replays_events_to_late_subscribers():
    """B5"""

    async def scenario():
        mgr = SSEManager()
        await mgr.broadcast("r1", "research_started", {})
        return mgr.subscribe("r1").qsize()

    assert asyncio.run(scenario()) == 1


def test_sse_history_is_bounded():
    from app.services import sse_manager as module

    async def scenario():
        mgr = SSEManager()
        for i in range(module.MAX_RUNS_KEPT + 5):
            await mgr.broadcast(f"r{i}", "research_started", {})
        return mgr.has_history("r0"), mgr.has_history(f"r{module.MAX_RUNS_KEPT + 4}")

    assert asyncio.run(scenario()) == (False, True)
