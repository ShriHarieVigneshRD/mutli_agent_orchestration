"""Search tools. They only ever return what a search engine returned: no results means []."""

import logging
import re
from typing import Any

from ddgs import DDGS

from app.config import settings

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "why", "are", "many", "and", "the", "while", "to", "in", "of", "for", "from", "both", "a", "this",
    "trend", "examine", "recent", "use", "also", "evaluate", "whether", "is", "actually", "or", "primarily",
    "what", "could", "mean", "over", "next", "years", "despite", "rapid", "growth", "adoption", "consider",
    "major",
}  # fmt: skip

# Sponsored-result redirects some engines mix into organic results.
AD_URL_RE = re.compile(r"bing\.com/aclick|/aclk\?|doubleclick\.net|duckduckgo\.com/y\.js")

# Percentages, currency amounts and counts with a scale word ("40%", "$1.2 billion", "3 million").
FIGURE_RE = re.compile(
    r"[$€£₹]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:thousand|million|billion|trillion|[kKmMbB]n?)\b)?"
    r"|\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|per cent\b)"
    r"|\b\d[\d,]*(?:\.\d+)?\s(?:thousand|million|billion|trillion)\b"
)


def extract_search_keywords(query: str) -> str:
    """Short search terms (≤ 90 chars) from a long prompt; search engines return nothing for paragraphs."""
    cleaned = query.strip()
    if len(cleaned) <= 90:
        return cleaned

    first_sentence = re.split(r"[.!?\n]", cleaned)[0].strip()
    if 10 <= len(first_sentence) <= 90:
        return first_sentence

    words = re.findall(r"\b[A-Za-z0-9\-\+]+\b", cleaned)
    keywords = [w for w in words if w.lower() not in STOP_WORDS and len(w) > 2]
    return " ".join(keywords[:10])[:90] if keywords else cleaned[:90]


def extract_figures(text: str) -> list[str]:
    """Distinct numeric figures in a text, in order of appearance."""
    return list(dict.fromkeys(m.group(0).strip() for m in FIGURE_RE.finditer(text)))


def _tavily_search(term: str, max_results: int) -> list[dict[str, Any]]:
    from tavily import TavilyClient  # optional provider, only imported when a key is configured

    response = TavilyClient(api_key=settings.TAVILY_API_KEY).search(query=term, max_results=max_results)
    return [
        {
            "title": item.get("title") or "Web source",
            "content": item.get("content", ""),
            "url": item.get("url", ""),
            "source_type": "web",
            "timestamp": None,
        }
        for item in response.get("results", [])
    ]


def execute_web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Web results from Tavily (when a key is set) or DuckDuckGo. [] when search finds nothing."""
    if settings.SEARCH_PROVIDER == "off":
        return []
    term = extract_search_keywords(query)
    logger.info("[Search] '%s'", term)

    if settings.TAVILY_API_KEY.strip():
        try:
            results = _tavily_search(term, max_results)
            if results:
                return results
        except Exception as e:
            logger.warning("Tavily search failed: %s. Falling back to DuckDuckGo.", e)

    try:
        with DDGS() as ddgs:
            hits = ddgs.text(term, max_results=max_results)
    except Exception as e:
        logger.warning("DuckDuckGo search failed for '%s': %s", term, e)
        return []
    return [
        {
            "title": item.get("title") or "Web result",
            "content": item.get("body", ""),
            "url": item.get("href", ""),
            "source_type": "web",
            "timestamp": None,
        }
        for item in hits
        if not AD_URL_RE.search(item.get("href", ""))
    ]


def search_with_news_fallback(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Web results, or news articles when web search finds nothing (some networks block text search)."""
    return execute_web_search(query, max_results) or execute_news_search(query, max_results)


def execute_news_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Recent news from DuckDuckGo; falls back to a web search when the news index has nothing."""
    if settings.SEARCH_PROVIDER == "off":
        return []
    term = extract_search_keywords(query)
    logger.info("[News] '%s'", term)

    results: list[dict[str, Any]] = []
    try:
        with DDGS() as ddgs:
            hits = ddgs.news(term, max_results=max_results)
        results = [
            {
                "title": item.get("title") or "News article",
                "content": item.get("body", ""),
                "url": item.get("url") or item.get("href", ""),
                "source_type": "news",
                "timestamp": item.get("date"),
            }
            for item in hits
        ]
    except Exception as e:
        logger.warning("News search failed for '%s': %s. Falling back to web search.", term, e)

    if not results:
        results = execute_web_search(f"{term} news", max_results=max_results)
        for r in results:
            r["source_type"] = "news"
    return results
