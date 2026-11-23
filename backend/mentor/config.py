"""Application configuration settings."""

import os
from pathlib import Path

from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    """Runtime settings for the Code Mentor backend."""

    app_port: int = int(os.getenv("MENTOR_PORT", "8090"))
    llama_router_url: str = os.getenv("MENTOR_LLAMA_URL", "http://127.0.0.1:8080")
    default_model: str = os.getenv("MENTOR_DEFAULT_MODEL", "qwen3.5-4b-fast")
    reasoning_model: str = os.getenv("MENTOR_REASONING_MODEL", "qwen3-coder-30b")
    db_path: Path = Path(os.getenv("MENTOR_DB_PATH", str(PROJECT_ROOT / "data" / "mentor.db")))
    trace_timeout_seconds: float = 3.0
    max_trace_steps: int = 500


settings = Settings()
