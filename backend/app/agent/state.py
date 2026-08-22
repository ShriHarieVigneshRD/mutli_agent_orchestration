import operator
from typing import TypedDict, List, Dict, Any, Optional, Annotated

def reduce_latest(a: Any, b: Any) -> Any:
    return b

def reduce_dict_update(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    res = dict(a or {})
    res.update(b or {})
    return res

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

class AgentStructuredOutput(TypedDict):
    status: str  # "completed", "completed_with_no_results", "failed"
    summary: Optional[str]
    findings: List[FindingItem]
    sources: List[Dict[str, Any]]
    error: Optional[str]

class ResearchState(TypedDict):
    query: str
    provider: str
    run_id: str
    
    plan: Optional[ResearchPlanDict]
    research_findings: Annotated[List[FindingItem], operator.add]
    data_findings: Annotated[List[FindingItem], operator.add]
    news_findings: Annotated[List[FindingItem], operator.add]
    
    agent_outputs: Annotated[Dict[str, Any], reduce_dict_update]
    
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
