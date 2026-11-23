"""FastAPI application for the Visual AI Code Mentor."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from mentor import __version__
from mentor.ast_glossary import GlossarySpan, build_ast_glossary
from mentor.config import PROJECT_ROOT
from mentor.db import get_ai_config, init_db, record_trace_run, save_ai_config
from mentor.llm_client import check_llama_health, explain_trace_step
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


FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
