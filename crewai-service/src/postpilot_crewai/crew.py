import json
import os
from pathlib import Path
from typing import Any

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task
from dotenv import load_dotenv
import yaml


load_dotenv()


def _compact_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    except Exception:
        return "{}"


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
            "account_context": _compact_json(context),
            "history_summary": _history_summary(payload.get("history", []) or []),
            "system_prompt": str(payload.get("systemPrompt", "")),
        }
        result = self.run().kickoff(inputs=inputs)
        return str(result).strip()
