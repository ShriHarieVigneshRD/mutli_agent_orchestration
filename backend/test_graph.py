import asyncio
import logging
from app.agent.graph import research_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestGraph")

async def test_workflow():
    print("\n=========================================")
    print("Testing LangGraph Multi-Agent Workflow")
    print("=========================================\n")
    
    initial_state = {
        "query": "Analyze how AI coding agents impact software engineering roles in 2026",
        "provider": "groq",
        "run_id": "test-run-123",
        "plan": None,
        "research_findings": [],
        "data_findings": [],
        "news_findings": [],
        "verified_evidence": [],
        "unsupported_claims": [],
        "draft_report": "",
        "critic_decision": "",
        "critic_feedback": "",
        "revision_count": 0,
        "max_revisions": 2,
        "final_report": "",
        "current_node": "initialized",
        "error": None
    }
    
    async for output in research_graph.astream(initial_state):
        for node_name, state_update in output.items():
            print(f"--> [Node Completed]: {node_name}")
            if "plan" in state_update and state_update["plan"]:
                print(f"    Tasks: {state_update['plan']['tasks']}")
            if "critic_decision" in state_update:
                print(f"    Critic Decision: {state_update['critic_decision']}")
                print(f"    Critic Feedback: {state_update['critic_feedback']}")

    print("\n=========================================")
    print("Workflow Execution Finished!")
    print("=========================================\n")

if __name__ == "__main__":
    asyncio.run(test_workflow())
