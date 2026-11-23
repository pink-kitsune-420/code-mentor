"""Subprocess orchestrator for deterministic Python execution tracing."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel

from mentor.config import settings

WORKER_PATH = Path(__file__).resolve().with_name("_trace_worker.py")


class VariableSnapshot(BaseModel):
    """Serialized runtime variable state."""

    type: str
    shape: Literal["number", "string", "bool", "list", "dict", "grid2d", "object", "none", "other"]
    value: Any
    repr: str
    obj_id: int | None = None


class VariableUpdate(BaseModel):
    """Before/after diff for a modified variable."""

    before: str
    after: str
    delta: int | float | None = None


class VariableChanges(BaseModel):
    """Per-step changes relative to the previous frame in the same scope."""

    created: list[str]
    updated: dict[str, VariableUpdate]
    deleted: list[str]


class StackEntry(BaseModel):
    """Single active frame in the call stack."""

    function: str
    line: int


class TraceFrame(BaseModel):
    """A single recorded execution frame."""

    step: int
    event: Literal["line", "call", "return", "exception"]
    line: int
    function: str
    call_stack: list[StackEntry]
    variables: dict[str, VariableSnapshot]
    changes: VariableChanges
    return_value: str | None = None
    exception: str | None = None
    stdout: str = ""
    branch_info: str | None = None


class TraceResult(BaseModel):
    """Complete execution trace response."""

    frames: list[TraceFrame]
    total_steps: int
    truncated: bool = False
    error: str | None = None


def trace_python_code(
    code: str,
    *,
    max_steps: int | None = None,
    timeout_seconds: float | None = None,
) -> TraceResult:
    """Execute Python code in an isolated subprocess and return TraceResult."""
    effective_steps = max_steps or settings.max_trace_steps
    effective_timeout = timeout_seconds or settings.trace_timeout_seconds
    payload = json.dumps({"code": code, "max_steps": effective_steps})

    try:
        completed = subprocess.run(
            [sys.executable, "-I", str(WORKER_PATH)],
            input=payload,
            text=True,
            capture_output=True,
            timeout=effective_timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return TraceResult(
            frames=[],
            total_steps=0,
            truncated=True,
            error=f"Execution timed out after {effective_timeout:.1f}s.",
        )

    if completed.returncode != 0 or not completed.stdout.strip():
        err = completed.stderr.strip() or f"Tracer exited with code {completed.returncode}."
        return TraceResult(frames=[], total_steps=0, truncated=False, error=err)

    data = json.loads(completed.stdout)
    frames = [TraceFrame.model_validate(item) for item in data.get("frames", [])]
    return TraceResult(
        frames=frames,
        total_steps=len(frames),
        truncated=bool(data.get("truncated", False)),
        error=data.get("error"),
    )
