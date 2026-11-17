import operator
from typing import Annotated, Any, TypedDict


def reduce_latest(a: Any, b: Any) -> Any:
    return b


def reduce_dict_update(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    res = dict(a or {})
    res.update(b or {})
    return res


class FindingItem(TypedDict):
    title: str
    content: str
    url: str | None
    source_type: str  # web, data, news
    timestamp: str | None


class VerifiedClaim(TypedDict):
    claim: str
    is_verified: bool
    confidence_score: float | None  # None when no model checked the claim
    reasoning: str
    supporting_sources: list[int]  # citation numbers [n] of numbered_sources()


class ResearchPlanDict(TypedDict):
    tasks: list[str]
    agents_required: list[str]
    focus_areas: list[str]
    agent_prompts: dict[str, str] | None


class AgentStructuredOutput(TypedDict):
    status: str  # "completed", "completed_with_no_results", "failed"
    summary: str | None
    findings: list[FindingItem]
    sources: list[dict[str, Any]]
    error: str | None


class ResearchState(TypedDict):
    query: str
    provider: str
    run_id: str

    plan: ResearchPlanDict | None
    research_findings: Annotated[list[FindingItem], operator.add]
    data_findings: Annotated[list[FindingItem], operator.add]
    news_findings: Annotated[list[FindingItem], operator.add]

    agent_outputs: Annotated[dict[str, Any], reduce_dict_update]

    verified_evidence: list[VerifiedClaim]
    unsupported_claims: list[str]

    draft_report: str
    critic_decision: str  # "APPROVE" or "REVISE"
    critic_feedback: str
    revision_count: int
    max_revisions: int

    final_report: str
    current_node: Annotated[str, reduce_latest]
    error: str | None
