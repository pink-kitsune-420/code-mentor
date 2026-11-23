"""Tests for Milestone 3 Lesson Creator Studio, Verifier, and Shareable Packs."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from mentor import config, db
from mentor.app import app
from mentor.curriculum import (
    CurriculumModule,
    QuizQuestion,
    load_pack_modules,
    verify_lesson_module,
)


def _make_client(tmp_path: Path, monkeypatch) -> TestClient:
    db_file = tmp_path / "studio_test.db"
    monkeypatch.setattr(config.settings, "db_path", db_file)
    db.init_db(db_file)
    return TestClient(app)


def test_shipped_lesson_packs_load_and_pass_verification() -> None:
    packs = load_pack_modules()
    pack_ids = {p.id for p in packs}
    assert {"pack_recursion_basics", "pack_binary_search"}.issubset(pack_ids)

    for pack in packs:
        res = verify_lesson_module(pack)
        assert res.valid is True, f"{pack.id} failed: {res.example_error} {res.quiz_errors}"
        assert res.example_ok is True
        assert res.example_steps > 0


def test_verifier_catches_syntax_error_and_invalid_quiz_contracts() -> None:
    bad_mod = CurriculumModule(
        id="bad_demo",
        track="Custom",
        difficulty="Beginner",
        title="Broken Demo",
        subtitle="Broken",
        lesson_points=["Point 1"],
        example_code="if x == 1\n    print(x)\n",
        quizzes=[
            QuizQuestion(
                id="q_bug",
                kind="spot_bug",
                title="Bad Line",
                prompt="Click line",
                code="a = 1\n",
                correct_line=9,
                explanation="Out of bounds",
            ),
            QuizQuestion(
                id="q_order",
                kind="reorder",
                title="Bad Order",
                prompt="Order",
                blocks=["a = 1", "b = 2"],
                correct_order=[0, 0],
                explanation="Invalid permutation",
            ),
        ],
    )
    res = verify_lesson_module(bad_mod)
    assert res.valid is False
    assert res.example_ok is False
    assert res.example_error is not None and "SyntaxError" in res.example_error
    assert len(res.quiz_errors) == 2


def test_custom_lesson_crud_export_and_import_roundtrip(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    new_lesson = {
        "id": "custom_sets_demo",
        "track": "Custom Lessons",
        "difficulty": "Intermediate",
        "title": "Python Sets & Uniqueness",
        "subtitle": "Automatic deduplication with set()",
        "prerequisites": ["mod_1_state"],
        "concepts": ["set", "deduplication"],
        "lesson_points": ["Sets store unique items with fast membership checks."],
        "example_code": "tags = set(['a', 'b', 'a'])\nprint(len(tags))\n",
        "quizzes": [
            {
                "id": "q1",
                "kind": "predict",
                "title": "Set Length",
                "prompt": "What prints?",
                "code": "items = set([1, 2, 2, 3])\nprint(len(items))\n",
                "options": ["4", "3", "2", "Error"],
                "correct_index": 1,
                "explanation": "Duplicate 2 is collapsed.",
            }
        ],
    }

    save_resp = client.post("/api/lessons", json=new_lesson)
    assert save_resp.status_code == 200
    saved = save_resp.json()
    assert saved["verification"]["valid"] is True
    assert any(m["id"] == "custom_sets_demo" for m in saved["modules"])

    # Export pack
    export_resp = client.get("/api/lessons/custom_sets_demo/export")
    assert export_resp.status_code == 200
    pack = export_resp.json()
    assert pack["schema_version"] == 1
    assert pack["module"]["title"] == "Python Sets & Uniqueness"

    # Import pack again -> collides gracefully with a unique ID
    import_resp = client.post("/api/lessons/import", json={"payload": json.dumps(pack)})
    assert import_resp.status_code == 200
    imported_id = import_resp.json()["module"]["id"]
    assert imported_id != "custom_sets_demo"

    # Delete custom lesson
    del_resp = client.delete(f"/api/lessons/{imported_id}")
    assert del_resp.status_code == 200
    assert all(m["id"] != imported_id for m in del_resp.json()["modules"])


def test_ai_generate_performs_one_repair_pass_when_initial_code_fails(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)
    db.save_ai_config(
        enabled=True,
        provider_url="http://127.0.0.1:8080",
        default_model="demo-model",
        db_path=tmp_path / "studio_test.db",
    )

    broken_json = json.dumps(
        {
            "title": "Demo Loops",
            "subtitle": "Looping cleanly",
            "concepts": ["for"],
            "lesson_points": ["Loops repeat code."],
            "example_code": "for i in range(3)\n    print(i)\n",
            "quizzes": [],
        }
    )
    fixed_json = json.dumps(
        {
            "title": "Demo Loops",
            "subtitle": "Looping cleanly",
            "concepts": ["for"],
            "lesson_points": ["Loops repeat code."],
            "example_code": "for i in range(3):\n    print(i)\n",
            "quizzes": [],
        }
    )

    calls: list[int] = []

    async def fake_request(**_kwargs) -> str:
        calls.append(1)
        return broken_json if len(calls) == 1 else fixed_json

    monkeypatch.setattr("mentor.llm_client._request_lesson_json", fake_request)

    resp = client.post(
        "/api/lessons/generate",
        json={"topic": "loops", "difficulty": "Beginner", "track": "Custom Lessons"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["repaired"] is True
    assert data["verification"]["valid"] is True
    assert len(calls) == 2
