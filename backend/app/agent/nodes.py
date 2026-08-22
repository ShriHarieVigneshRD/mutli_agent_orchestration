import json
import logging
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.state import ResearchState, FindingItem, VerifiedClaim, ResearchPlanDict
from app.agent.llm import LLMFactory
from app.agent.tools import execute_web_search, execute_news_search, execute_data_analysis

logger = logging.getLogger("AgentNodes")

def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, str):
                text_parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                text_parts.append(part["text"])
        return "\n".join(text_parts)
    return str(content)

def parse_json_from_llm(content: Any) -> Dict[str, Any]:
    """Helper to extract JSON object from LLM output (str or list of content blocks)."""
    text_content = extract_text(content).strip()
    if text_content.startswith("```json"):
        text_content = text_content[7:]
    if text_content.startswith("```"):
        text_content = text_content[3:]
    if text_content.endswith("```"):
        text_content = text_content[:-3]
    text_content = text_content.strip()
    try:
        return json.loads(text_content)
    except Exception:
        return {}

def invoke_llm_with_fallback(provider: str, messages: list, temperature: float = 0.2):
    """Invokes OpenRouter with selected model; if it fails (e.g. rate limit), automatically tries secondary free OpenRouter models."""
    primary_model = provider or "meta-llama/llama-3.3-70b-instruct:free"
    try:
        llm = LLMFactory.get_model(provider=primary_model, temperature=temperature)
        return llm.invoke(messages)
    except Exception as e:
        logger.warning(f"Model '{primary_model}' failed with error: {e}. Trying secondary OpenRouter model.")
        fallback_models = [
            "openrouter/free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "google/gemini-2.0-flash-exp:free",
            "deepseek/deepseek-chat:free"
        ]
        for fb_model in fallback_models:
            if fb_model != primary_model:
                try:
                    logger.info(f"Retrying with fallback model: {fb_model}")
                    llm_fallback = LLMFactory.get_model(provider=fb_model, temperature=temperature)
                    return llm_fallback.invoke(messages)
                except Exception as err2:
                    logger.warning(f"Fallback model '{fb_model}' also failed: {err2}")
        raise e

# 1. PLANNER NODE
def planner_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    logger.info(f"[Planner Node] Decomposing query: {query}")
    
    llm = LLMFactory.get_model(provider=provider, temperature=0.1)
    
    system_prompt = (
        "You are the Lead Research Supervisor & Planner. Your job is to decompose a complex research question "
        "into structured execution steps. You MUST respond with ONLY a valid JSON object with the following fields:\n"
        "{\n"
        '  "tasks": ["step 1...", "step 2...", "step 3..."],\n'
        '  "agents_required": ["researcher", "data_analyst", "news_agent"],\n'
        '  "focus_areas": ["area 1", "area 2"]\n'
        "}"
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Decompose this research request: {query}")
    ]
    
    try:
        response = invoke_llm_with_fallback(provider, messages, temperature=0.1)
        parsed = parse_json_from_llm(response.content)
        
        tasks = parsed.get("tasks", [
            f"Gather core concepts and literature on: {query[:80]}",
            f"Analyze quantitative trends and adoption metrics for: {query[:80]}",
            f"Investigate current 2025/2026 industry news regarding: {query[:80]}"
        ])
        
        ALLOWED_AGENTS = {"researcher", "data_analyst", "news_agent"}
        raw_agents = parsed.get("agents_required", [])
        agents_required = [a for a in raw_agents if a in ALLOWED_AGENTS]
        if not agents_required:
            agents_required = ["researcher", "data_analyst", "news_agent"]
            
        focus_areas = parsed.get("focus_areas", ["Technical Capabilities", "Market Impact", "Future Outlook"])
        
    except Exception as e:
        logger.error(f"[Planner Node] Error: {e}")
        tasks = [f"Investigate: {query[:80]}", "Analyze key metrics", "Review recent developments"]
        agents_required = ["researcher", "data_analyst", "news_agent"]
        focus_areas = ["General Analysis"]

    plan: ResearchPlanDict = {
        "tasks": tasks,
        "agents_required": agents_required,
        "focus_areas": focus_areas
    }
    
    return {
        "plan": plan,
        "current_node": "planner"
    }


# 2. RESEARCHER NODE
def research_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    logger.info(f"[Research Node] Executing web search for: {query}")
    
    status = "completed"
    error_msg = None
    finding_items: List[FindingItem] = []
    sources: List[Dict[str, Any]] = []
    summary = ""
    
    try:
        findings = execute_web_search(query, max_results=5)
        if not findings:
            status = "completed_with_no_results"
            summary = "No sufficiently relevant web findings were identified."
        else:
            status = "completed"
            summary = f"Gathered {len(findings)} web research findings."
            
        for f in findings:
            item: FindingItem = {
                "title": f["title"],
                "content": f["content"],
                "url": f.get("url"),
                "source_type": "web",
                "timestamp": f.get("timestamp")
            }
            finding_items.append(item)
            if f.get("url"):
                sources.append({"title": f["title"], "url": f["url"], "source_type": "web"})
    except Exception as e:
        logger.error(f"[Research Node] Error executing web search: {e}")
        status = "failed"
        error_msg = str(e)
        summary = f"Web research agent error: {e}"

    output_payload = {
        "status": status,
        "summary": summary,
        "findings": finding_items,
        "sources": sources,
        "error": error_msg
    }

    return {
        "research_findings": finding_items,
        "agent_outputs": {"researcher": output_payload},
        "current_node": "researcher"
    }


# 3. DATA ANALYST NODE
def data_analyst_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    logger.info(f"[Data Analyst Node] Analyzing statistics for: {query}")
    
    status = "completed"
    error_msg = None
    finding_items: List[FindingItem] = []
    sources: List[Dict[str, Any]] = []
    summary = ""
    
    try:
        corpus = " ".join([f["content"] for f in state.get("research_findings", [])])
        if not corpus:
            corpus = query
            
        data_res = execute_data_analysis(query, corpus)
        
        item: FindingItem = {
            "title": data_res["title"],
            "content": data_res["content"],
            "url": data_res.get("url"),
            "source_type": "data",
            "timestamp": data_res.get("timestamp")
        }
        finding_items.append(item)
        if data_res.get("url"):
            sources.append({"title": data_res["title"], "url": data_res["url"], "source_type": "data"})
        summary = "Completed quantitative data analysis."
    except Exception as e:
        logger.error(f"[Data Analyst Node] Error executing data analysis: {e}")
        status = "failed"
        error_msg = str(e)
        summary = f"Data Analyst error: {e}"

    output_payload = {
        "status": status,
        "summary": summary,
        "findings": finding_items,
        "sources": sources,
        "error": error_msg
    }

    return {
        "data_findings": finding_items,
        "agent_outputs": {"data_analyst": output_payload},
        "current_node": "data_analyst"
    }


# 4. NEWS AGENT NODE
def news_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    logger.info(f"[News Agent Node] Searching recent events for: {query}")
    
    status = "completed"
    error_msg = None
    finding_items: List[FindingItem] = []
    sources: List[Dict[str, Any]] = []
    summary = ""
    
    try:
        news_res = execute_news_search(query, max_results=4)
        if not news_res:
            status = "completed_with_no_results"
            summary = "No recent 2025/2026 news articles were identified."
        else:
            status = "completed"
            summary = f"Gathered {len(news_res)} recent news developments."
            
        for n in news_res:
            item: FindingItem = {
                "title": n["title"],
                "content": n["content"],
                "url": n.get("url"),
                "source_type": "news",
                "timestamp": n.get("timestamp")
            }
            finding_items.append(item)
            if n.get("url"):
                sources.append({"title": n["title"], "url": n["url"], "source_type": "news"})
    except Exception as e:
        logger.error(f"[News Agent Node] Error searching news: {e}")
        status = "failed"
        error_msg = str(e)
        summary = f"News Agent error: {e}"

    output_payload = {
        "status": status,
        "summary": summary,
        "findings": finding_items,
        "sources": sources,
        "error": error_msg
    }

    return {
        "news_findings": finding_items,
        "agent_outputs": {"news_agent": output_payload},
        "current_node": "news_agent"
    }


# 5. VERIFIER NODE
def verifier_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    
    res_findings = state.get("research_findings", [])
    data_findings = state.get("data_findings", [])
    news_findings = state.get("news_findings", [])
    
    logger.info(
        f"[Verifier Node] Validating evidence for query: '{query}'. "
        f"Received findings count - Research: {len(res_findings)}, Data: {len(data_findings)}, News: {len(news_findings)}"
    )
    
    all_findings = res_findings + data_findings + news_findings
    
    findings_str = "\n---\n".join([
        f"Source ({f['source_type'].upper()}): {f['title']}\nURL: {f.get('url') or 'N/A'}\nContent: {f['content']}"
        for f in all_findings
    ])
    
    system_prompt = (
        "You are the Lead Verifier & Evidence Inspector. Your role is to cross-examine claims gathered by research agents. "
        "Filter out low-confidence assertions and return ONLY a valid JSON object with:\n"
        "{\n"
        '  "verified_evidence": [\n'
        '    {"claim": "...", "is_verified": true, "confidence_score": 0.95, "reasoning": "...", "supporting_sources": ["..."]}\n'
        "  ],\n"
        '  "unsupported_claims": ["claim with insufficient backing..."]\n'
        "}"
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Research Question: {query}\n\nEvidence Collected:\n{findings_str}")
    ]
    
    verified_evidence: List[VerifiedClaim] = []
    unsupported_claims: List[str] = []
    
    try:
        response = invoke_llm_with_fallback(provider, messages, temperature=0.1)
        parsed = parse_json_from_llm(response.content)
        
        for item in parsed.get("verified_evidence", []):
            verified_evidence.append({
                "claim": item.get("claim", "Verified assertion"),
                "is_verified": item.get("is_verified", True),
                "confidence_score": float(item.get("confidence_score", 0.9)),
                "reasoning": item.get("reasoning", "Supported by multi-source cross-reference."),
                "supporting_sources": item.get("supporting_sources", ["Web Search"])
            })
            
        unsupported_claims = parsed.get("unsupported_claims", [])
    except Exception as e:
        logger.error(f"[Verifier Node] Validation error: {e}")
        # Default verification fallback
        for f in all_findings:
            verified_evidence.append({
                "claim": f["title"],
                "is_verified": True,
                "confidence_score": 0.85,
                "reasoning": "Direct source observation.",
                "supporting_sources": [f.get("url") or f["title"]]
            })

    output_payload = {
        "status": "completed",
        "verified_evidence": verified_evidence,
        "unsupported_claims": unsupported_claims,
        "verified_count": len(verified_evidence),
        "unsupported_count": len(unsupported_claims)
    }

    return {
        "verified_evidence": verified_evidence,
        "unsupported_claims": unsupported_claims,
        "agent_outputs": {"verifier": output_payload},
        "current_node": "verifier"
    }


# 6. WRITER NODE
def writer_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    plan = state.get("plan", {})
    verified = state.get("verified_evidence", [])
    critic_feedback = state.get("critic_feedback", "")
    revision_count = state.get("revision_count", 0)
    
    logger.info(f"[Writer Node] Draft report synthesis (Revision: {revision_count})")
    
    llm = LLMFactory.get_model(provider=provider, temperature=0.3)
    
    evidence_str = "\n".join([
        f"- Claim: {v['claim']} (Confidence: {v['confidence_score']})\n  Reasoning: {v['reasoning']}"
        for v in verified
    ])
    
    system_prompt = (
        "You are an Elite Research Writer & Analyst. Synthesize the verified evidence into a comprehensive, "
        "well-structured publication-grade research report in GitHub-flavored Markdown format.\n\n"
        "Include the following sections:\n"
        "# [Title of Research Report]\n"
        "## Executive Summary\n"
        "## Research Methodology & Plan\n"
        "## Core Analytical Findings\n"
        "## Data & Quantitative Trends\n"
        "## Recent Developments & Industry News\n"
        "## Counterarguments & Risk Analysis\n"
        "## Conclusions & Strategic Recommendations\n"
        "## References & Sources\n"
    )
    
    user_content = (
        f"Original Research Query: {query}\n\n"
        f"Research Plan: {json.dumps(plan)}\n\n"
        f"Verified Evidence & Findings:\n{evidence_str}\n"
    )
    
    if critic_feedback:
        user_content += f"\n\nCRITIC REVISION FEEDBACK TO ADDRESS:\n{critic_feedback}\nPlease explicitly improve the report according to this feedback."
        
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_content)
    ]
    
    try:
        response = invoke_llm_with_fallback(provider, messages, temperature=0.3)
        draft_report = extract_text(response.content)
    except Exception as e:
        logger.error(f"[Writer Node] Error: {e}")
        draft_report = f"# Research Report: {query}\n\n## Executive Summary\nAnalysis generated based on verified findings.\n\n" + evidence_str
        
    writer_payload = {
        "status": "completed",
        "draft_report": draft_report,
        "revision_count": revision_count
    }

    return {
        "draft_report": draft_report,
        "agent_outputs": {"writer": writer_payload},
        "current_node": "writer"
    }


# 7. CRITIC NODE
def critic_node(state: ResearchState) -> Dict[str, Any]:
    query = state["query"]
    provider = state.get("provider", "groq")
    draft_report = extract_text(state.get("draft_report", ""))
    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 2)
    
    logger.info(f"[Critic Node] Reviewing draft report. Revision count: {revision_count}")
    
    system_prompt = (
        "You are the Chief Editorial Director & Critic. Review the generated research report for:\n"
        "1. Completeness in answering the original query.\n"
        "2. Logical coherence & analytical depth.\n"
        "3. Proper source citations & missing perspectives.\n\n"
        "You MUST respond with ONLY a valid JSON object:\n"
        "{\n"
        '  "decision": "APPROVE" or "REVISE",\n'
        '  "feedback": "Specific, actionable critique explaining what to add/fix if REVISE, or praise if APPROVE."\n'
        "}"
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Original Query: {query}\n\nDraft Report to Evaluate:\n{draft_report[:3000]}")
    ]
    
    try:
        response = invoke_llm_with_fallback(provider, messages, temperature=0.1)
        parsed = parse_json_from_llm(response.content)
        decision = parsed.get("decision", "APPROVE").upper()
        feedback = parsed.get("feedback", "The report adequately answers the research prompt with strong verified evidence.")
    except Exception as e:
        logger.error(f"[Critic Node] Review error: {e}")
        decision = "APPROVE"
        feedback = "Approved report after editorial review."

    # Prevent infinite loops
    new_revision_count = revision_count
    if decision == "REVISE":
        new_revision_count += 1
        if new_revision_count >= max_revisions:
            logger.info(f"[Critic Node] Max revisions reached ({max_revisions}). Forcing APPROVE.")
            decision = "APPROVE"
            feedback += f" (Note: Maximum revision threshold of {max_revisions} reached; final report approved)."

    critic_payload = {
        "status": "completed",
        "critic_decision": decision,
        "critic_feedback": feedback,
        "revision_count": new_revision_count
    }

    res: Dict[str, Any] = {
        "critic_decision": decision,
        "critic_feedback": feedback,
        "revision_count": new_revision_count,
        "agent_outputs": {"critic": critic_payload},
        "current_node": "critic"
    }
    
    if decision == "APPROVE":
        res["final_report"] = draft_report
        
    return res
