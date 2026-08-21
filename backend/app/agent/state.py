import operator
from typing import TypedDict, List, Dict, Any, Optional, Annotated

def reduce_latest(a: Any, b: Any) -> Any:
    return b

class FindingItem(TypedDict):
    title: str
    content: str
    url: Optional[str]
    source_type: str  # web, data, news
    timestamp: Optional[str]

class VerifiedClaim(TypedDict):
    claim: str
    is_verified: bool
    confidence_score: float
    reasoning: str
    supporting_sources: List[str]

class ResearchPlanDict(TypedDict):
    tasks: List[str]
    agents_required: List[str]
    focus_areas: List[str]

class ResearchState(TypedDict):
    query: str
    provider: str
    run_id: str
    
    plan: Optional[ResearchPlanDict]
    research_findings: Annotated[List[FindingItem], operator.add]
    data_findings: Annotated[List[FindingItem], operator.add]
    news_findings: Annotated[List[FindingItem], operator.add]
    
    verified_evidence: List[VerifiedClaim]
    unsupported_claims: List[str]
    
    draft_report: str
    critic_decision: str  # "APPROVE" or "REVISE"
    critic_feedback: str
    revision_count: int
    max_revisions: int
    
    final_report: str
    current_node: Annotated[str, reduce_latest]
    error: Optional[str]
