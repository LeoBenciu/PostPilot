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
    account = context.get("account") or {}
    niche = account.get("niche") or "(not set)"
    objective = account.get("objective") or "(not set)"
    platforms = context.get("connectedPlatforms") or []
    return (
        f"Niche: {niche}\n"
        f"Primary objective: {objective}\n"
        f"Connected platforms: {', '.join(platforms) if platforms else 'none'}"
    )


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
        inputs = {
            "message": str(payload.get("message", "")),
            "account_context": _format_account_context(context),
            "history_summary": _history_summary(payload.get("history", []) or []),
            "language": _resolve_language_name(context.get("language")),
        }
        result = self.run().kickoff(inputs=inputs)
        return str(result).strip()
