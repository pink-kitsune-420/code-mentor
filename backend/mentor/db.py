"""SQLite persistence for trace runs, AI configuration, and syllabus progress."""

from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path

from mentor.config import settings


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """Open a SQLite connection with row access by column name."""
    target = db_path or settings.db_path
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(target, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path | None = None) -> None:
    """Create core tables if they do not already exist."""
    with get_connection(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS trace_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                preset_id TEXT,
                code_hash TEXT NOT NULL,
                total_steps INTEGER NOT NULL,
                truncated INTEGER NOT NULL DEFAULT 0,
                had_error INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mastery_progress (
                concept_id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'not_started',
                score REAL NOT NULL DEFAULT 0.0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quiz_results (
                quiz_id TEXT PRIMARY KEY,
                module_id TEXT,
                correct INTEGER NOT NULL,
                score REAL NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS custom_lessons (
                id TEXT PRIMARY KEY,
                module_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


def record_trace_run(
    *,
    preset_id: str | None,
    code: str,
    total_steps: int,
    truncated: bool,
    had_error: bool,
    db_path: Path | None = None,
) -> None:
    """Persist a summary record of a completed trace run."""
    code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()[:16]
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO trace_runs (preset_id, code_hash, total_steps, truncated, had_error)
            VALUES (?, ?, ?, ?, ?)
            """,
            (preset_id, code_hash, total_steps, int(truncated), int(had_error)),
        )


def get_ai_config(db_path: Path | None = None) -> dict[str, object]:
    """Load persisted AI provider configuration with env-var defaults."""
    init_db(db_path)
    stored: dict[str, str] = {}
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
        for row in rows:
            stored[row["key"]] = row["value"]

    return {
        "enabled": stored.get("ai_enabled", "1") == "1",
        "provider_url": stored.get("ai_provider_url", settings.llama_router_url),
        "default_model": stored.get("ai_default_model", settings.default_model),
        "api_key": stored.get("ai_api_key", ""),
    }


def save_ai_config(
    *,
    enabled: bool,
    provider_url: str,
    default_model: str,
    api_key: str | None = None,
    clear_api_key: bool = False,
    db_path: Path | None = None,
) -> dict[str, object]:
    """Persist AI provider configuration into SQLite."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        items: list[tuple[str, str]] = [
            ("ai_enabled", "1" if enabled else "0"),
            ("ai_provider_url", provider_url.strip()),
            ("ai_default_model", default_model.strip()),
        ]
        if clear_api_key:
            items.append(("ai_api_key", ""))
        elif api_key is not None and api_key.strip() != "":
            items.append(("ai_api_key", api_key.strip()))

        conn.executemany(
            """
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
            """,
            items,
        )
    return get_ai_config(db_path)


def save_quiz_result(
    *,
    quiz_id: str,
    module_id: str | None,
    correct: bool,
    score: float,
    db_path: Path | None = None,
) -> None:
    """Persist an individual quiz result."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO quiz_results (quiz_id, module_id, correct, score, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(quiz_id) DO UPDATE SET
                module_id = excluded.module_id,
                correct = excluded.correct,
                score = excluded.score,
                updated_at = CURRENT_TIMESTAMP
            """,
            (quiz_id, module_id, int(correct), float(score)),
        )


def save_module_mastery(
    *,
    concept_id: str,
    status: str,
    score: float,
    db_path: Path | None = None,
) -> None:
    """Persist module mastery status and score."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO mastery_progress (concept_id, status, score, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(concept_id) DO UPDATE SET
                status = excluded.status,
                score = excluded.score,
                updated_at = CURRENT_TIMESTAMP
            """,
            (concept_id, status, float(score)),
        )


def get_curriculum_progress(db_path: Path | None = None) -> dict[str, object]:
    """Return all saved module mastery statuses and individual quiz outcomes."""
    init_db(db_path)
    mastery: dict[str, dict[str, object]] = {}
    quizzes: dict[str, dict[str, object]] = {}
    with get_connection(db_path) as conn:
        for row in conn.execute("SELECT concept_id, status, score FROM mastery_progress").fetchall():
            mastery[row["concept_id"]] = {"status": row["status"], "score": row["score"]}
        for row in conn.execute("SELECT quiz_id, module_id, correct, score FROM quiz_results").fetchall():
            quizzes[row["quiz_id"]] = {
                "module_id": row["module_id"],
                "correct": bool(row["correct"]),
                "score": row["score"],
            }
    return {"mastery": mastery, "quizzes": quizzes}


def reset_curriculum_progress(db_path: Path | None = None) -> None:
    """Clear saved quiz results and module mastery."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute("DELETE FROM quiz_results")
        conn.execute("DELETE FROM mastery_progress")


def list_custom_lessons(db_path: Path | None = None) -> list[str]:
    """Return raw JSON strings of saved custom lessons ordered by creation time."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT module_json FROM custom_lessons ORDER BY created_at ASC, id ASC"
        ).fetchall()
    return [str(row["module_json"]) for row in rows]


def save_custom_lesson(*, lesson_id: str, module_json: str, db_path: Path | None = None) -> None:
    """Insert or update a custom lesson JSON payload."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO custom_lessons (id, module_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                module_json = excluded.module_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (lesson_id, module_json),
        )


def delete_custom_lesson(lesson_id: str, db_path: Path | None = None) -> bool:
    """Delete a custom lesson and its associated quiz/mastery rows."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        cur = conn.execute("DELETE FROM custom_lessons WHERE id = ?", (lesson_id,))
        conn.execute("DELETE FROM quiz_results WHERE module_id = ?", (lesson_id,))
        conn.execute("DELETE FROM mastery_progress WHERE concept_id = ?", (lesson_id,))
        return cur.rowcount > 0
