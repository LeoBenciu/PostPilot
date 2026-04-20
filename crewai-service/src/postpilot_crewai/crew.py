import os
from pathlib import Path
from typing import Any

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task
from dotenv import load_dotenv
import yaml


load_dotenv()


LANGUAGE_NAMES = {
    "en": "English",
    "ro": "Romanian",
    "it": "Italian",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "pt": "Portuguese",
}


def _resolve_language_name(code: Any) -> str:
    key = str(code or "en").lower()[:2]
    return LANGUAGE_NAMES.get(key, "English")


def _truncate(value: Any, limit: int) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    return text[:limit] + "..."


def _format_account(context: dict[str, Any]) -> str:
    first_name = context.get("firstName") or ""
    platforms = context.get("connectedPlatforms") or []
    lines = []
    if first_name:
        lines.append(f"First name (use when greeting): {first_name}")
    lines.append(f"Connected platforms: {', '.join(platforms) if platforms else 'none'}")
    return "\n".join(lines)


def _format_stats(context: dict[str, Any]) -> str:
    stats = context.get("stats") or {}
    if not stats or not stats.get("totalPosts"):
        return "No aggregated stats yet (no posts synced)."
    total = stats.get("totalPosts") or 0
    last_30 = stats.get("postsLast30Days") or 0
    last_90 = stats.get("postsLast90Days") or 0
    days_since = stats.get("daysSinceLastPost")
    zero_comments = stats.get("postsWithZeroComments") or 0
    zero_comments_pct = stats.get("postsWithZeroCommentsPct") or 0
    avg_er = stats.get("avgEngagementRate")
    avg_skip = stats.get("avgSkipRateProxy")
    skip_trend = stats.get("skipRateProxyTrend") or []
    skip_direction = stats.get("skipRateProxyTrendDirection") or "flat"
    skip_sample = stats.get("reelsWithSkipRateProxy") or 0
    skip_target = stats.get("skipRateProxyTargetSeconds") or 3
    avg_likes = stats.get("avgLikes") or 0
    avg_comments = stats.get("avgComments") or 0

    lines = [
        f"Total posts synced: {total}",
        f"Posts in last 30 days: {last_30} | last 90 days: {last_90}",
    ]
    if days_since is not None:
        lines.append(f"Days since last post: {days_since}")
    lines.append(
        f"Posts with zero comments: {zero_comments}/{total} ({zero_comments_pct}%)"
    )
    lines.append(f"Average per post: {avg_likes} likes, {avg_comments} comments")
    if avg_er is not None:
        lines.append(f"Average engagement rate: {avg_er}%")
    if avg_skip is not None and skip_sample:
        lines.append(
            f"Reels skip-rate proxy (target {skip_target}s watch): "
            f"{avg_skip}% across {skip_sample} reels"
        )
    if isinstance(skip_trend, list) and len(skip_trend) >= 2:
        trend_text = " -> ".join([f"{v}%" for v in skip_trend])
        lines.append(
            f"Skip-rate trend (oldest -> newest): {trend_text} "
            f"({skip_direction})"
        )

    top_er = stats.get("topPostByEngagementRate")
    if top_er:
        lines.append(
            f"Best post by engagement rate: {top_er.get('engagementRate')}% "
            f"({top_er.get('type')}, {top_er.get('likes')} likes, "
            f"{top_er.get('comments')} comments, {top_er.get('impressions')} views)"
        )
        text = _truncate(top_er.get("text"), 160)
        if text:
            lines.append(f'  Caption: "{text}"')

    top_views = stats.get("topPostByViews")
    if top_views:
        lines.append(
            f"Most-viewed post: {top_views.get('impressions')} views "
            f"({top_views.get('type')}, {top_views.get('likes')} likes, "
            f"{top_views.get('comments')} comments)"
        )
        text = _truncate(top_views.get("text"), 160)
        if text:
            lines.append(f'  Caption: "{text}"')

    return "\n".join(lines)


def _format_integrations(context: dict[str, Any]) -> str:
    integrations = context.get("integrations") or {}
    lines: list[str] = []
    for platform, info in integrations.items():
        if not isinstance(info, dict) or not info.get("connected"):
            continue
        username = info.get("username") or "(unknown)"
        line = f"- {platform}: @{username}"
        display = info.get("displayName")
        if display:
            line += f" ({display})"
        followers = info.get("followersCount")
        if followers is not None:
            line += f" | {followers} followers"
        media = info.get("mediaCount")
        if media is not None:
            line += f" | {media} posts"
        bio = info.get("bio")
        if bio:
            line += f'\n  Bio: "{_truncate(bio, 200)}"'
        lines.append(line)
    return "\n".join(lines) if lines else "No connected accounts."


def _format_posts(context: dict[str, Any], limit: int = 12) -> str:
    posts = context.get("posts") or []
    if not posts:
        return "No posts synced yet."
    items: list[str] = []
    for i, p in enumerate(posts[:limit]):
        ptype = p.get("type") or "Post"
        posted = p.get("postedAt") or "unknown date"
        likes = p.get("likes") or 0
        comments = p.get("comments") or 0
        impressions = p.get("impressions") or 0
        reach = p.get("reach") or 0
        saved = p.get("saved") or 0
        shares = p.get("shares") or 0
        video_views = p.get("videoViews") or 0
        avg_watch = p.get("avgWatchTime") or 0
        skip_rate = p.get("skipRateProxy")
        er = p.get("engagementRate")
        perf_parts = [f"{likes} likes", f"{comments} comments"]
        if impressions:
            perf_parts.append(f"{impressions} views")
        if reach:
            perf_parts.append(f"{reach} reach")
        if saved:
            perf_parts.append(f"{saved} saved")
        if shares:
            perf_parts.append(f"{shares} shares")
        if video_views:
            perf_parts.append(f"{video_views} video views")
        if avg_watch:
            perf_parts.append(f"{avg_watch}s avg watch")
        if skip_rate is not None:
            perf_parts.append(f"skip proxy {skip_rate}%")
        if er is not None:
            perf_parts.append(f"ER {er}%")
        text = _truncate(p.get("text"), 500) or "(no caption)"
        items.append(
            f"[{i + 1}] {ptype} — {posted} — " + ", ".join(perf_parts) + f"\n\"{text}\""
        )
    return "\n\n".join(items)


def _format_account_context(context: dict[str, Any]) -> str:
    return (
        "=== Profile ===\n"
        f"{_format_account(context)}\n\n"
        "=== Connected accounts ===\n"
        f"{_format_integrations(context)}\n\n"
        "=== Account stats (cite these numbers when relevant) ===\n"
        f"{_format_stats(context)}\n\n"
        "=== Top / recent posts (the creator's real voice) ===\n"
        f"{_format_posts(context)}"
    )


def _history_summary(history: list[dict[str, Any]]) -> str:
    items = []
    for msg in history[-20:]:
        role = str(msg.get("role", "user"))
        content = str(msg.get("content", "")).strip()
        if not content:
            continue
        items.append(f"{role}: {content}")
    return "\n".join(items) or "No previous conversation."


@CrewBase
class PostPilotCrew:
    """CrewAI crew definition using YAML-backed agents/tasks configs."""

    def __init__(self) -> None:
        base = Path(__file__).resolve().parent
        config_dir = base / "config"
        with (config_dir / "agents.yaml").open("r", encoding="utf-8") as f:
            self.agents_config = yaml.safe_load(f) or {}
        with (config_dir / "tasks.yaml").open("r", encoding="utf-8") as f:
            self.tasks_config = yaml.safe_load(f) or {}

    def _llm(self) -> LLM:
        model = os.getenv("POSTPILOT_CREW_MODEL", "gpt-4o-mini")
        # LiteLLM (under CrewAI's LLM wrapper) dispatches providers by model prefix.
        # Claude models need an explicit `anthropic/` prefix and the Anthropic key;
        # OpenAI models stay bare with the OpenAI key.
        if model.lower().startswith("claude"):
            api_key = os.getenv("ANTHROPIC_API_KEY", "")
            if not model.lower().startswith("anthropic/"):
                model = f"anthropic/{model}"
        else:
            api_key = os.getenv("OPENAI_API_KEY", "")
        return LLM(model=model, api_key=api_key)

    @agent
    def strategist(self) -> Agent:
        return Agent(config=self.agents_config["strategist"], llm=self._llm())

    @task
    def compose_response(self) -> Task:
        return Task(config=self.tasks_config["compose_response"], agent=self.strategist())

    @crew
    def run(self) -> Crew:
        return Crew(
            agents=[self.strategist()],
            tasks=[self.compose_response()],
            process=Process.sequential,
            verbose=False,
        )

    def kickoff(self, payload: dict[str, Any]) -> str:
        context = payload.get("context", {}) or {}
        account_context_text = _format_account_context(context)
        market_context = str(payload.get("market_context") or "").strip()
        if market_context:
            account_context_text += (
                "\n\n=== Live market context (what's trending in this niche right now) ===\n"
                + market_context
            )
        inputs = {
            "message": str(payload.get("message", "")),
            "account_context": account_context_text,
            "history_summary": _history_summary(payload.get("history", []) or []),
            "language": _resolve_language_name(context.get("language")),
        }
        result = self.run().kickoff(inputs=inputs)
        return str(result).strip()
