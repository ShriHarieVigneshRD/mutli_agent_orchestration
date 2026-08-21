import logging
from langgraph.graph import StateGraph, END
from app.agent.state import ResearchState
from app.agent.nodes import (
    planner_node,
    research_node,
    data_analyst_node,
    news_node,
    verifier_node,
    writer_node,
    critic_node
)

logger = logging.getLogger("LangGraphWorkflow")

def route_after_critic(state: ResearchState) -> str:
    """Conditional routing function based on Critic decision and revision count."""
    decision = state.get("critic_decision", "APPROVE")
    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 2)

    if decision == "REVISE" and revision_count < max_revisions:
        logger.info(f"Routing back to 'writer' node for revision #{revision_count}")
        return "writer"
    
    logger.info("Critic decision approved or max revisions reached. Finalizing report workflow.")
    return END

def create_research_graph():
    """Builds and compiles the custom LangGraph StateGraph for multi-agent research intelligence."""
    workflow = StateGraph(ResearchState)

    # 1. Add agent nodes
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", research_node)
    workflow.add_node("data_analyst", data_analyst_node)
    workflow.add_node("news_agent", news_node)
    workflow.add_node("verifier", verifier_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("critic", critic_node)

    # 2. Set entry point
    workflow.set_entry_point("planner")

    # 3. Add parallel execution fan-out edges from planner
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("planner", "data_analyst")
    workflow.add_edge("planner", "news_agent")

    # 4. Add fan-in aggregation edges to verifier
    workflow.add_edge("researcher", "verifier")
    workflow.add_edge("data_analyst", "verifier")
    workflow.add_edge("news_agent", "verifier")

    # 5. Add pipeline edges
    workflow.add_edge("verifier", "writer")
    workflow.add_edge("writer", "critic")

    # 6. Add conditional edge from critic (reflection loop vs termination)
    workflow.add_conditional_edges(
        "critic",
        route_after_critic,
        {
            "writer": "writer",
            END: END
        }
    )

    app = workflow.compile()
    return app

research_graph = create_research_graph()
