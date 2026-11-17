"""Offline demo replies, used when OPENROUTER_API_KEY is not set.

They are built from the run's real inputs (the question and the search results), never from invented
facts, and every one says plainly that no language model was involved.
"""

import json
from collections.abc import Mapping, Sequence
from typing import Any

from app.agent.tools import extract_search_keywords

NOTICE = "Offline demo: no language model is configured, so this was assembled without AI."


def plan(query: str) -> str:
    topic = extract_search_keywords(query)[:60]
    return json.dumps(
        {
            "tasks": [
                f"Find background sources on: {topic}",
                f"Collect figures and statistics on: {topic}",
                f"Find recent news on: {topic}",
            ],
            "agents_required": ["researcher", "data_analyst", "news_agent"],
            "focus_areas": ["Background", "Figures", "Recent news"],
            "agent_prompts": {"researcher": topic, "data_analyst": topic, "news_agent": topic},
        }
    )


def verification(sources: Sequence[Mapping[str, Any]]) -> str:
    return json.dumps(
        {
            "verified_evidence": [
                {
                    "claim": s["title"],
                    "is_verified": False,
                    "confidence_score": None,
                    "reasoning": "Not checked: offline demo mode.",
                    "supporting_sources": [s["n"]],
                }
                for s in sources
            ],
            "unsupported_claims": [],
        }
    )


def report(query: str, sources: Sequence[Mapping[str, Any]], figures: Sequence[Mapping[str, Any]]) -> str:
    cite = {src["url"]: src["n"] for src in sources}
    lines = [f"# {query.strip()[:120]}", "", f"> {NOTICE}", "", "## Executive Summary", ""]
    if sources:
        lines.append(
            f"The agents gathered {len(sources)} sources. Read them below; nothing here is analysed."
        )
    else:
        lines.append("Search returned no sources for this question, so there is nothing to summarise.")
    if figures:
        lines += ["", "## Figures Found", ""]
        for f in figures:
            values = ", ".join(
                line.lstrip("- ").strip() for line in f["content"].splitlines() if line.strip()
            )
            ref = f" [{cite[f['url']]}]" if f.get("url") in cite else ""
            lines.append(f"- {values}{ref}")
    if sources:
        lines += ["", "## Source Excerpts", ""]
        lines += [f"- **{src['title']}**. {src['content'][:240]} [{src['n']}]" for src in sources]
        lines += ["", "## References & Sources", ""]
        lines += [f"{src['n']}. {src['title']}, <{src['url']}>" for src in sources]
    return "\n".join(lines) + "\n"


def critic() -> str:
    return json.dumps({"decision": "APPROVE", "feedback": "Not reviewed: offline demo mode."})


def chat() -> str:
    return json.dumps(
        {
            "chat_response": (
                "Offline demo mode: no language model is configured, so I can't answer questions or edit "
                "the report. Set `OPENROUTER_API_KEY` in `backend/.env` to enable chat."
            ),
            "is_report_modified": False,
            "updated_report_markdown": None,
        }
    )
