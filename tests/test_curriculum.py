"""Tests for Tier 0 placement, Tier 1 syllabus, and zero-typing quiz grading."""

from pathlib import Path

from fastapi.testclient import TestClient

from mentor import config, db
from mentor.app import app
from mentor.curriculum import PLACEMENT_QUESTIONS, get_all_modules
from mentor.tracer import trace_python_code


def _make_client(tmp_path: Path, monkeypatch) -> TestClient:
    db_file = tmp_path / "curriculum_test.db"
    monkeypatch.setattr(config.settings, "db_path", db_file)
    db.init_db(db_file)
    return TestClient(app)


def test_all_tier1_example_code_executes_cleanly() -> None:
    modules = get_all_modules()
    valid_ids = {m.id for m in modules}
    for mod in modules:
        for pre in mod.prerequisites:
            assert pre in valid_ids, f"{mod.id} references unknown prerequisite {pre}"
        res = trace_python_code(mod.example_code)
        assert res.error is None, f"{mod.id} failed to trace: {res.error}"
        assert res.total_steps > 0


def test_curriculum_endpoint_and_quiz_mastery_flow(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    resp = client.get("/api/curriculum")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["placement"]) == len(PLACEMENT_QUESTIONS)
    assert len(data["modules"]) >= 7
    assert {"builtin", "pack"}.issubset({m["source"] for m in data["modules"]})

    # Disable AI so 'explain' exercises deterministic rubric fallback cleanly.
    async def no_ai(**_kwargs):
        return None

    monkeypatch.setattr("mentor.app.grade_plain_english_with_ai", no_ai)

    # Answer all 3 quizzes of Module 1 accurately
    r1 = client.post("/api/curriculum/answer", json={"quiz_id": "m1_predict", "selected_index": 1})
    assert r1.status_code == 200
    assert r1.json()["correct"] is True

    r2 = client.post(
        "/api/curriculum/answer",
        json={"quiz_id": "m1_reorder", "ordered_indices": [2, 1, 0]},
    )
    assert r2.json()["correct"] is True

    r3 = client.post(
        "/api/curriculum/answer",
        json={
            "quiz_id": "m1_explain",
            "explanation_text": "It groups related ship data fields under named keys together.",
        },
    )
    assert r3.json()["correct"] is True
    assert r3.json()["ai_graded"] is False
    mastery = r3.json()["progress"]["mastery"]
    assert mastery["mod_1_state"]["status"] == "mastered"

    # Reset clears progress
    reset_resp = client.post("/api/curriculum/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["progress"]["mastery"] == {}


def test_spot_bug_grading_checks_exact_line(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    wrong = client.post("/api/curriculum/answer", json={"quiz_id": "m2_spot_bug", "selected_line": 1})
    assert wrong.json()["correct"] is False

    right = client.post("/api/curriculum/answer", json={"quiz_id": "m2_spot_bug", "selected_line": 3})
    assert right.json()["correct"] is True
