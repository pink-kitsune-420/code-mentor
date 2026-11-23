"""Grounded AI step narrator talking to any OpenAI-compatible AI endpoint."""

from __future__ import annotations

import json
import re
import uuid
from typing import Literal

import httpx

from mentor.curriculum import (
    CurriculumModule,
    DifficultyLevel,
    LessonVerificationResult,
    verify_lesson_module,
)
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


def _slugify_topic(topic: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", topic.lower()).strip("_")
    return slug[:28] or "lesson"


def _parse_module_json(
    raw_content: str,
    *,
    lesson_id: str,
    difficulty: DifficultyLevel,
    track: str,
    prerequisites: list[str],
) -> CurriculumModule | None:
    cleaned = strip_thinking_tags(raw_content)
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        return None
    try:
        raw_obj = json.loads(match.group(0))
        if isinstance(raw_obj, dict) and "module" in raw_obj and isinstance(raw_obj["module"], dict):
            raw_obj = raw_obj["module"]
        if not isinstance(raw_obj, dict):
            return None
        raw_obj["id"] = lesson_id
        raw_obj["source"] = "custom"
        raw_obj["difficulty"] = difficulty
        raw_obj["track"] = track.strip() or "Custom Lessons"
        raw_obj["prerequisites"] = prerequisites
        quizzes = raw_obj.get("quizzes", [])
        if isinstance(quizzes, list):
            for idx, q in enumerate(quizzes, start=1):
                if isinstance(q, dict):
                    q["id"] = f"{lesson_id}_q{idx}"
        return CurriculumModule.model_validate(raw_obj)
    except (json.JSONDecodeError, ValueError):
        return None


async def _request_lesson_json(
    *,
    v1_base: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
) -> str:
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            f"{v1_base}/chat/completions",
            headers=_auth_headers(api_key),
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.25,
                "max_tokens": 1200,
            },
        )
        resp.raise_for_status()
        return str(resp.json()["choices"][0]["message"]["content"])


async def generate_lesson_draft_with_ai(
    *,
    topic: str,
    difficulty: DifficultyLevel = "Beginner",
    track: str = "Custom Lessons",
    prerequisites: list[str] | None = None,
    seed_code: str | None = None,
    model: str | None = None,
) -> dict[str, object]:
    """Generate a CurriculumModule draft with AI and verify/auto-repair it via tracer.py."""
    cfg = get_ai_config()
    if not bool(cfg["enabled"]):
        return {"ok": False, "error": "AI Narrator is turned off in AI Settings."}

    v1_base = normalize_v1_base(str(cfg["provider_url"]))
    if not v1_base:
        return {"ok": False, "error": "No AI provider URL configured."}

    chosen_model = model or str(cfg["default_model"])
    key = str(cfg["api_key"])
    prereqs = prerequisites or []
    lesson_id = f"custom_{_slugify_topic(topic)}_{uuid.uuid4().hex[:4]}"

    system_msg = (
        "You are an expert visual Python educator creating a short, crystal-clear interactive lesson. "
        "Respond ONLY with valid JSON matching this schema:\n"
        '{\n'
        '  "title": "Short Topic Title",\n'
        '  "subtitle": "1-line summary",\n'
        '  "concepts": ["concept1", "concept2"],\n'
        '  "lesson_points": ["point 1", "point 2", "point 3"],\n'
        '  "example_code": "10-16 lines of clean runnable Python using only builtins (no input/open/os)",\n'
        '  "quizzes": [\n'
        '    {"kind": "predict", "title": "...", "prompt": "...", "code": "short runnable Python", '
        '"options": ["a", "b", "c", "d"], "correct_index": 0, "explanation": "..."},\n'
        '    {"kind": "spot_bug", "title": "...", "prompt": "...", "code": "short buggy Python", '
        '"correct_line": 2, "explanation": "..."},\n'
        '    {"kind": "explain", "title": "...", "prompt": "...", "code": "2-4 lines", '
        '"rubric_keywords": ["k1", "k2", "k3"], "sample_explanation": "...", "explanation": "..."}\n'
        "  ]\n"
        "}"
    )
    seed_note = f"\nOPTIONAL_SEED_CODE:\n{seed_code.strip()}" if seed_code and seed_code.strip() else ""
    user_msg = f"TOPIC: {topic}\nDIFFICULTY: {difficulty}{seed_note}"

    try:
        raw_reply = await _request_lesson_json(
            v1_base=v1_base,
            api_key=key,
            model=chosen_model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
        )
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        return {"ok": False, "error": f"AI endpoint ({v1_base}) error: {exc}"}

    draft = _parse_module_json(
        raw_reply,
        lesson_id=lesson_id,
        difficulty=difficulty,
        track=track,
        prerequisites=prereqs,
    )
    if draft is None:
        return {"ok": False, "error": "AI did not return valid lesson JSON. Try again or author manually."}

    verification: LessonVerificationResult = verify_lesson_module(draft)
    repaired = False

    if not verification.valid:
        errors = [*([verification.example_error] if verification.example_error else []), *verification.quiz_errors]
        repair_prompt = (
            "The lesson draft failed deterministic Python verification with these errors:\n"
            + "\n".join(f"- {e}" for e in errors)
            + "\n\nFix the JSON so example_code runs cleanly in <=500 steps without external imports "
            "and all quiz fields are valid. Return ONLY the corrected JSON."
        )
        try:
            repair_reply = await _request_lesson_json(
                v1_base=v1_base,
                api_key=key,
                model=chosen_model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": raw_reply},
                    {"role": "user", "content": repair_prompt},
                ],
            )
            repaired_draft = _parse_module_json(
                repair_reply,
                lesson_id=lesson_id,
                difficulty=difficulty,
                track=track,
                prerequisites=prereqs,
            )
            if repaired_draft is not None:
                draft = repaired_draft
                verification = verify_lesson_module(draft)
                repaired = True
        except (httpx.HTTPError, KeyError, IndexError, ValueError):
            pass

    return {
        "ok": True,
        "module": draft.model_dump(),
        "verification": verification.model_dump(),
        "repaired": repaired,
    }


async def translate_snippet_with_ai(
    *,
    code: str,
    target_lang: Literal["TypeScript", "Rust"],
    model: str | None = None,
) -> dict[str, object]:
    """Translate a Python snippet into TypeScript or Rust with a short conceptual note."""
    cfg = get_ai_config()
    if not bool(cfg["enabled"]):
        return {
            "ok": False,
            "target_lang": target_lang,
            "model": "",
            "translation": "AI Narrator is turned off in AI Settings.",
        }

    v1_base = normalize_v1_base(str(cfg["provider_url"]))
    if not v1_base:
        return {
            "ok": False,
            "target_lang": target_lang,
            "model": "",
            "translation": "No AI provider URL configured.",
        }

    chosen_model = model or str(cfg["default_model"])
    key = str(cfg["api_key"])
    system_msg = (
        f"You are a clear programming mentor translating short Python snippets into clean idiomatic {target_lang}. "
        f"Return: (1) a concise {target_lang} equivalent code block, followed by (2) 2 short bullet points "
        f"highlighting the main syntax/type differences a Python learner should notice."
    )
    user_msg = f"PYTHON_CODE:\n{code}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{v1_base}/chat/completions",
                headers=_auth_headers(key),
                json={
                    "model": chosen_model,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 500,
                },
            )
            resp.raise_for_status()
            raw_text = resp.json()["choices"][0]["message"]["content"]
            text = strip_thinking_tags(raw_text) or raw_text.strip()
            return {
                "ok": True,
                "target_lang": target_lang,
                "model": chosen_model,
                "translation": text,
            }
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        return {
            "ok": False,
            "target_lang": target_lang,
            "model": chosen_model,
            "translation": f"AI endpoint ({v1_base}) could not respond: {exc}",
        }
