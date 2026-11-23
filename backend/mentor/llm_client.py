"""Grounded AI step narrator talking to any OpenAI-compatible AI endpoint."""

from __future__ import annotations

import json
import re

import httpx

from mentor.db import get_ai_config
from mentor.tracer import TraceFrame


def strip_thinking_tags(text: str) -> str:
    """Remove <think>...</think> reasoning blocks emitted by thinking models."""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if cleaned.startswith("<think>"):
        return ""
    return cleaned


def normalize_v1_base(url: str) -> str:
    """Normalize a provider base URL so it cleanly ends with '/v1'."""
    cleaned = url.strip().rstrip("/")
    if not cleaned:
        return ""
    if cleaned.endswith("/v1"):
        return cleaned
    return f"{cleaned}/v1"


def _auth_headers(api_key: str) -> dict[str, str]:
    if api_key.strip():
        return {"Authorization": f"Bearer {api_key.strip()}"}
    return {}


async def check_llama_health(
    base_url: str | None = None,
    api_key: str | None = None,
    enabled: bool | None = None,
) -> dict[str, object]:
    """Check whether the configured AI endpoint is enabled and reachable."""
    cfg = get_ai_config()
    is_enabled = bool(cfg["enabled"]) if enabled is None else enabled
    if not is_enabled:
        return {"online": False, "disabled": True, "models": [], "error": "AI disabled by user"}

    raw_url = base_url if base_url is not None else str(cfg["provider_url"])
    key = api_key if api_key is not None else str(cfg["api_key"])
    v1_base = normalize_v1_base(raw_url)
    if not v1_base:
        return {"online": False, "models": [], "error": "No provider URL configured"}

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{v1_base}/models", headers=_auth_headers(key))
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("id") for m in data.get("data", []) if isinstance(m, dict) and m.get("id")]
                return {"online": True, "models": models[:24]}
            return {"online": False, "models": [], "error": f"HTTP {resp.status_code}"}
    except httpx.HTTPError as exc:
        return {"online": False, "models": [], "error": str(exc)}


def build_grounded_prompt(code: str, frame: TraceFrame, question: str | None = None) -> list[dict[str, str]]:
    """Build a strict zero-hallucination prompt anchored to the recorded TraceFrame."""
    numbered_code = "\n".join(f"{idx}: {line}" for idx, line in enumerate(code.splitlines(), start=1))
    frame_context = {
        "step": frame.step,
        "event": frame.event,
        "line": frame.line,
        "function": frame.function,
        "variables": {k: {"type": v.type, "repr": v.repr} for k, v in frame.variables.items()},
        "changes": frame.changes.model_dump(),
        "branch_info": frame.branch_info,
        "return_value": frame.return_value,
        "exception": frame.exception,
        "stdout": frame.stdout,
    }
    default_ask = "Explain what is happening at this exact step and why."
    user_ask = question.strip() if question and question.strip() else default_ask

    system_msg = (
        "You are a patient, visual programming mentor for a beginner building code literacy. "
        "STRICT GROUNDING RULE: Explain ONLY using the exact line number, variable values, changes, "
        "and branch info provided in the TRACE_FRAME JSON. Never invent variable values or speculate "
        "about unexecuted lines. Keep explanations concise (3-5 sentences, plain English)."
    )
    user_msg = (
        f"CODE:\n{numbered_code}\n\n"
        f"TRACE_FRAME:\n{json.dumps(frame_context, indent=2)}\n\n"
        f"STUDENT_QUESTION: {user_ask}"
    )
    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]


async def explain_trace_step(
    *,
    code: str,
    frame: TraceFrame,
    question: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> dict[str, str | bool]:
    """Request a grounded plain-English explanation of a single TraceFrame."""
    cfg = get_ai_config()
    if not bool(cfg["enabled"]):
        return {
            "ok": False,
            "model": "",
            "explanation": "AI Narrator is currently turned off in AI Settings.",
        }

    raw_url = base_url if base_url is not None else str(cfg["provider_url"])
    v1_base = normalize_v1_base(raw_url)
    chosen_model = model or str(cfg["default_model"])
    key = str(cfg["api_key"])
    messages = build_grounded_prompt(code, frame, question)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{v1_base}/chat/completions",
                headers=_auth_headers(key),
                json={
                    "model": chosen_model,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 350,
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            raw_text = payload["choices"][0]["message"]["content"]
            text = strip_thinking_tags(raw_text) or raw_text.strip()
            return {"ok": True, "model": chosen_model, "explanation": text}
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        return {
            "ok": False,
            "model": chosen_model,
            "explanation": f"AI endpoint ({v1_base}) could not respond: {exc}",
        }


async def grade_plain_english_with_ai(
    *,
    prompt_question: str,
    code: str,
    sample_explanation: str,
    user_answer: str,
) -> dict[str, object] | None:
    """Grade a learner's plain-English explanation using the configured AI, or None if unavailable."""
    cfg = get_ai_config()
    if not bool(cfg["enabled"]):
        return None

    v1_base = normalize_v1_base(str(cfg["provider_url"]))
    if not v1_base:
        return None

    chosen_model = str(cfg["default_model"])
    key = str(cfg["api_key"])
    system_msg = (
        "You are grading a beginner programmer's plain-English mental model. "
        "Be encouraging and accurate. Respond ONLY with valid JSON: "
        '{"correct": true|false, "feedback": "1-2 concise sentences comparing their answer to the key concept."}'
    )
    user_msg = (
        f"QUESTION: {prompt_question}\n"
        f"CODE:\n{code}\n"
        f"REFERENCE_CONCEPT: {sample_explanation}\n"
        f"STUDENT_ANSWER: {user_answer}"
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{v1_base}/chat/completions",
                headers=_auth_headers(key),
                json={
                    "model": chosen_model,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 200,
                },
            )
            resp.raise_for_status()
            raw_content = strip_thinking_tags(resp.json()["choices"][0]["message"]["content"])
            match = re.search(r"\{.*\}", raw_content, flags=re.DOTALL)
            if not match:
                return None
            parsed = json.loads(match.group(0))
            correct = bool(parsed.get("correct", False))
            feedback = str(parsed.get("feedback", "")).strip()
            if not feedback:
                return None
            return {
                "correct": correct,
                "score": 1.0 if correct else 0.5,
                "feedback": feedback,
                "expected": sample_explanation,
                "ai_graded": True,
            }
    except (httpx.HTTPError, KeyError, IndexError, ValueError, json.JSONDecodeError):
        return None
