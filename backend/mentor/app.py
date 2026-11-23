"""FastAPI application for the Visual AI Code Mentor."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

from mentor import __version__
from mentor.ast_glossary import GlossarySpan, build_ast_glossary
from mentor.config import PROJECT_ROOT
from mentor.curriculum import (
    PLACEMENT_QUESTIONS,
    CurriculumModule,
    DifficultyLevel,
    LessonPack,
    LessonVerificationResult,
    get_all_modules,
    get_quiz_by_id,
    grade_deterministic_answer,
    verify_lesson_module,
)
from mentor.db import (
    delete_custom_lesson,
    get_ai_config,
    get_curriculum_progress,
    init_db,
    record_trace_run,
    reset_curriculum_progress,
    save_ai_config,
    save_custom_lesson,
    save_module_mastery,
    save_quiz_result,
)
from mentor.llm_client import (
    check_llama_health,
    explain_trace_step,
    generate_lesson_draft_with_ai,
    grade_plain_english_with_ai,
)
from mentor.presets import PresetLesson, get_presets
from mentor.tracer import TraceFrame, TraceResult, trace_python_code


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Visual AI Code Mentor", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TraceRequest(BaseModel):
    code: str
    preset_id: str | None = None


class TraceResponse(BaseModel):
    trace: TraceResult
    glossary: list[GlossarySpan]


class ExplainStepRequest(BaseModel):
    code: str
    frame: TraceFrame
    question: str | None = None
    model: str | None = None


class AiConfigPublic(BaseModel):
    enabled: bool
    provider_url: str
    default_model: str
    has_api_key: bool


class AiConfigUpdateRequest(BaseModel):
    enabled: bool = True
    provider_url: str
    default_model: str
    api_key: str | None = None
    clear_api_key: bool = False


class AiConfigTestRequest(BaseModel):
    provider_url: str
    api_key: str | None = None


class QuizAnswerRequest(BaseModel):
    quiz_id: str
    selected_index: int | None = None
    selected_line: int | None = None
    ordered_indices: list[int] | None = None
    explanation_text: str | None = None


class GenerateLessonRequest(BaseModel):
    topic: str
    difficulty: DifficultyLevel = "Beginner"
    track: str = "Custom Lessons"
    prerequisites: list[str] = []
    seed_code: str | None = None
    model: str | None = None


class ImportLessonRequest(BaseModel):
    payload: str | dict[str, object]


def _public_ai_config(cfg: dict[str, object]) -> AiConfigPublic:
    return AiConfigPublic(
        enabled=bool(cfg["enabled"]),
        provider_url=str(cfg["provider_url"]),
        default_model=str(cfg["default_model"]),
        has_api_key=bool(str(cfg.get("api_key", "")).strip()),
    )


@app.get("/api/health")
async def health() -> dict[str, object]:
    """Return service health, AI config summary, and endpoint reachability."""
    cfg = get_ai_config()
    llama = await check_llama_health()
    return {
        "status": "ok",
        "version": __version__,
        "ai_config": _public_ai_config(cfg).model_dump(),
        "llama_router": llama,
    }


@app.get("/api/ai-config", response_model=AiConfigPublic)
def read_ai_config() -> AiConfigPublic:
    """Return current AI provider configuration (without exposing API keys)."""
    return _public_ai_config(get_ai_config())


@app.post("/api/ai-config")
async def update_ai_config(req: AiConfigUpdateRequest) -> dict[str, object]:
    """Save AI provider configuration and check endpoint health."""
    saved = save_ai_config(
        enabled=req.enabled,
        provider_url=req.provider_url,
        default_model=req.default_model,
        api_key=req.api_key,
        clear_api_key=req.clear_api_key,
    )
    status = await check_llama_health()
    return {
        "ai_config": _public_ai_config(saved).model_dump(),
        "llama_router": status,
    }


@app.post("/api/ai-config/test")
async def test_ai_config(req: AiConfigTestRequest) -> dict[str, object]:
    """Test a candidate AI endpoint without saving it first."""
    cfg = get_ai_config()
    key = req.api_key if (req.api_key is not None and req.api_key.strip() != "") else str(cfg["api_key"])
    return await check_llama_health(base_url=req.provider_url, api_key=key, enabled=True)


@app.get("/api/presets", response_model=list[PresetLesson])
def list_presets() -> list[PresetLesson]:
    """Return built-in beginner starter presets."""
    return get_presets()


@app.post("/api/trace", response_model=TraceResponse)
def run_trace_endpoint(req: TraceRequest) -> TraceResponse:
    """Execute Python code deterministically and return trace frames + AST glossary."""
    trace = trace_python_code(req.code)
    glossary = build_ast_glossary(req.code)
    record_trace_run(
        preset_id=req.preset_id,
        code=req.code,
        total_steps=trace.total_steps,
        truncated=trace.truncated,
        had_error=trace.error is not None,
    )
    return TraceResponse(trace=trace, glossary=glossary)


@app.post("/api/explain-step")
async def explain_step_endpoint(req: ExplainStepRequest) -> dict[str, str | bool]:
    """Explain a single recorded TraceFrame using the configured AI endpoint."""
    return await explain_trace_step(
        code=req.code,
        frame=req.frame,
        question=req.question,
        model=req.model,
    )


@app.get("/api/curriculum")
def read_curriculum() -> dict[str, object]:
    """Return Tier 0 placement questions, Tier 1 modules, and saved progress."""
    return {
        "placement": [q.model_dump() for q in PLACEMENT_QUESTIONS],
        "modules": [m.model_dump() for m in get_all_modules()],
        "progress": get_curriculum_progress(),
    }


@app.post("/api/curriculum/answer")
async def submit_quiz_answer(req: QuizAnswerRequest) -> dict[str, object]:
    """Grade a placement or Tier 1 quiz answer and update SQLite mastery progress."""
    module_id, question = get_quiz_by_id(req.quiz_id)
    if question is None:
        raise HTTPException(status_code=404, detail=f"Unknown quiz_id '{req.quiz_id}'")

    result: dict[str, object] | None = None
    if question.kind == "explain" and len((req.explanation_text or "").strip()) >= 8:
        result = await grade_plain_english_with_ai(
            prompt_question=question.prompt,
            code=question.code,
            sample_explanation=question.sample_explanation,
            user_answer=req.explanation_text or "",
        )

    if result is None:
        result = grade_deterministic_answer(
            question,
            selected_index=req.selected_index,
            selected_line=req.selected_line,
            ordered_indices=req.ordered_indices,
            explanation_text=req.explanation_text,
        )

    save_quiz_result(
        quiz_id=question.id,
        module_id=module_id,
        correct=bool(result["correct"]),
        score=float(result["score"]),
    )

    progress = get_curriculum_progress()
    if module_id is not None:
        mod = next((m for m in get_all_modules() if m.id == module_id), None)
        if mod is not None:
            quiz_map = progress["quizzes"]
            assert isinstance(quiz_map, dict)
            total = len(mod.quizzes)
            earned = sum(
                float(quiz_map[q.id]["score"])
                for q in mod.quizzes
                if q.id in quiz_map
            )
            avg = earned / max(1, total)
            completed_all = all(q.id in quiz_map and bool(quiz_map[q.id]["correct"]) for q in mod.quizzes)
            status = "mastered" if completed_all else "in_progress"
            save_module_mastery(concept_id=module_id, status=status, score=round(avg, 2))
            progress = get_curriculum_progress()

    return {
        **result,
        "module_id": module_id,
        "progress": progress,
    }


@app.post("/api/curriculum/reset")
def reset_curriculum() -> dict[str, object]:
    """Reset all curriculum progress."""
    reset_curriculum_progress()
    return {"progress": get_curriculum_progress()}


@app.post("/api/lessons/generate")
async def generate_lesson_endpoint(req: GenerateLessonRequest) -> dict[str, object]:
    """Generate and tracer-verify a lesson draft using the configured AI provider."""
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")
    return await generate_lesson_draft_with_ai(
        topic=req.topic.strip(),
        difficulty=req.difficulty,
        track=req.track,
        prerequisites=req.prerequisites,
        seed_code=req.seed_code,
        model=req.model,
    )


@app.post("/api/lessons/verify", response_model=LessonVerificationResult)
def verify_lesson_endpoint(module: CurriculumModule) -> LessonVerificationResult:
    """Deterministically verify a lesson's example code and quiz contracts."""
    return verify_lesson_module(module)


def _save_verified_lesson(module: CurriculumModule, *, ensure_unique_id: bool = False) -> dict[str, object]:
    existing_ids = {m.id for m in get_all_modules()}
    if not module.id.strip() or (ensure_unique_id and module.id in existing_ids):
        base = module.id.strip() or f"custom_{uuid.uuid4().hex[:6]}"
        module.id = f"{base}_{uuid.uuid4().hex[:4]}" if base in existing_ids else base

    # Ensure built-in/pack lessons aren't overwritten silently via save.
    builtin_or_pack_ids = {m.id for m in get_all_modules() if m.source in ("builtin", "pack")}
    if module.id in builtin_or_pack_ids:
        module.id = f"{module.id}_{uuid.uuid4().hex[:4]}"

    module.source = "custom"
    for idx, q in enumerate(module.quizzes, start=1):
        if not q.id.strip() or not q.id.startswith(module.id):
            q.id = f"{module.id}_q{idx}"

    verification = verify_lesson_module(module)
    if not verification.valid:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Lesson verification failed.",
                "verification": verification.model_dump(),
            },
        )

    save_custom_lesson(lesson_id=module.id, module_json=module.model_dump_json())
    return {
        "module": module.model_dump(),
        "verification": verification.model_dump(),
        "modules": [m.model_dump() for m in get_all_modules()],
        "progress": get_curriculum_progress(),
    }


@app.post("/api/lessons")
def save_lesson_endpoint(module: CurriculumModule) -> dict[str, object]:
    """Verify and save a custom lesson into SQLite."""
    return _save_verified_lesson(module, ensure_unique_id=False)


@app.post("/api/lessons/import")
def import_lesson_endpoint(req: ImportLessonRequest) -> dict[str, object]:
    """Validate, verify, and save an imported JSON LessonPack or CurriculumModule."""
    try:
        raw_obj = json.loads(req.payload) if isinstance(req.payload, str) else req.payload
        if isinstance(raw_obj, dict) and "module" in raw_obj:
            module = LessonPack.model_validate(raw_obj).module
        else:
            module = CurriculumModule.model_validate(raw_obj)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid Lesson Pack JSON: {exc}") from exc

    return _save_verified_lesson(module, ensure_unique_id=True)


@app.delete("/api/lessons/{lesson_id}")
def delete_lesson_endpoint(lesson_id: str) -> dict[str, object]:
    """Delete a custom SQLite lesson and return updated catalog state."""
    deleted = delete_custom_lesson(lesson_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Custom lesson '{lesson_id}' not found.")
    return {
        "deleted": lesson_id,
        "modules": [m.model_dump() for m in get_all_modules()],
        "progress": get_curriculum_progress(),
    }


@app.get("/api/lessons/{lesson_id}/export", response_model=LessonPack)
def export_lesson_endpoint(lesson_id: str) -> LessonPack:
    """Export any lesson (built-in, pack, or custom) as a portable LessonPack JSON."""
    mod = next((m for m in get_all_modules() if m.id == lesson_id), None)
    if mod is None:
        raise HTTPException(status_code=404, detail=f"Lesson '{lesson_id}' not found.")
    return LessonPack(schema_version=1, module=mod)


FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
