"""Live market/niche context fetched from Tavily.

Gives the agent a fresh view of what's trending in the creator's niche so its
advice is grounded in the current landscape instead of pretraining memory.

We gate the actual API call behind a cheap keyword heuristic so we only spend
Tavily credits when market context is genuinely useful. Simple greetings,
metrics questions about the creator's own posts, and off-topic requests skip
the call entirely.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("postpilot.market_search")

# Keywords across the languages PostPilot supports that suggest the creator is
# asking about *trends / ideas / comparisons* rather than their own numbers.
# Deliberately broad — false positives waste 1–2s of latency + a Tavily call,
# false negatives leave the agent without context it would have benefited from.
_MARKET_TRIGGERS = (
    # English
    "trend", "viral", "what works", "whats working", "what's working",
    "top creator", "best performing", "perform well", "popular", "benchmark",
    "industry", "competit", "market", "inspiration", "inspire", "hook",
    "idea", "ideas", "format", "caption", "hashtag", "reel", "script",
    "growth strategy", "go viral", "compared to", "how do i grow",
    # Romanian
    "tend", "tendin", "vira", "ce func", "ce merge", "idee", "idei", "idei de",
    "inspir", "scenariu", "scenari", "hook", "format", "popular", "compar",
    "strategi", "cresc", "crestere", "cre\u0219tere",
    # Italian
    "tendenz", "virali", "idee", "ispira", "cresc", "popolare", "format",
    "copione", "didascali", "strategi",
    # German
    "trend", "viral", "idee", "ideen", "wachstum", "beliebt", "strateg",
    "format", "untertitel",
    # French
    "tendance", "vira", "id\u00e9e", "id\u00e9es", "inspir", "croissance",
    "populaire", "strat\u00e9gi", "format", "l\u00e9gende",
    # Spanish
    "tendenc", "viral", "idea", "ideas", "inspir", "crecimiento", "popular",
    "estrategi", "formato", "subt\u00edtulo",
    # Portuguese
    "tend\u00eanc", "vira", "ideia", "inspira", "crescimento", "popular",
    "estrat\u00e9gi", "formato", "legenda",
)

_MAX_QUERY_WORDS = 8
_TAVILY_TIMEOUT_SECONDS = 6


def should_search_market(message: str, niche: Optional[str]) -> bool:
    """Return True when the user's intent clearly benefits from market context."""
    if not message or not niche:
        return False
    clean_niche = niche.strip()
    if not clean_niche or clean_niche == "(not set)":
        return False
    lower = message.lower()
    return any(trigger in lower for trigger in _MARKET_TRIGGERS)


def _build_query(niche: str, language: str, user_message: str) -> str:
    """Compose a single query that mixes the creator's niche, the current
    year, and a few content words from the user's message for extra focus."""
    clean_niche = niche.strip()
    year = datetime.now(timezone.utc).year
    # Pull 5–8 meaningful words from the user's message; skip tiny connectives.
    words = re.findall(r"[\w\u00c0-\u017f']{4,}", user_message or "")
    extra = " ".join(words[:_MAX_QUERY_WORDS])
    lang_hint = f" in {language}" if language and language.lower() != "english" else ""
    base = (
        f"What is currently trending on Instagram for {clean_niche} creators{lang_hint} in {year}? "
        f"Focus on viral hooks, popular content formats, trending hashtags, and specific "
        f"creators performing well right now."
    )
    if extra:
        base += f" Context from the user: {extra}"
    return base


def _format_results(query: str, payload: dict) -> Optional[str]:
    if not payload:
        return None
    lines: list[str] = [f"Query: {query}"]
    answer = (payload.get("answer") or "").strip()
    if answer:
        lines.append(f"Summary: {answer}")
    results = payload.get("results") or []
    if results:
        lines.append("Sources:")
        for r in results[:6]:
            title = str(r.get("title", "")).strip()
            content = str(r.get("content", "")).strip().replace("\n", " ")
            if len(content) > 320:
                content = content[:320] + "..."
            url = str(r.get("url", "")).strip()
            if title:
                lines.append(f"- {title}")
            if content:
                lines.append(f"  {content}")
            if url:
                lines.append(f"  {url}")
    if len(lines) <= 1:
        return None
    return "\n".join(lines)


def _call_tavily_sync(query: str) -> Optional[dict]:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return None
    try:
        from tavily import TavilyClient
    except ImportError:
        log.warning("tavily-python not installed; skipping market search")
        return None
    try:
        client = TavilyClient(api_key=api_key)
        return client.search(
            query=query,
            search_depth="basic",
            include_answer=True,
            max_results=5,
            topic="general",
        )
    except Exception as exc:
        log.warning("Tavily search failed: %s", exc)
        return None


def fetch_market_context_sync(
    niche: str, language: str, user_message: str
) -> Optional[str]:
    """Blocking variant — used by the sync /chat endpoint."""
    query = _build_query(niche, language, user_message)
    payload = _call_tavily_sync(query)
    return _format_results(query, payload) if payload else None


async def fetch_market_context(
    niche: str, language: str, user_message: str
) -> Optional[str]:
    """Async variant — runs the blocking SDK call in a thread and bounds it
    with a timeout so a slow Tavily response never stalls a stream."""
    query = _build_query(niche, language, user_message)
    try:
        payload = await asyncio.wait_for(
            asyncio.to_thread(_call_tavily_sync, query),
            timeout=_TAVILY_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        log.warning("Tavily search timed out after %ss", _TAVILY_TIMEOUT_SECONDS)
        return None
    return _format_results(query, payload) if payload else None
