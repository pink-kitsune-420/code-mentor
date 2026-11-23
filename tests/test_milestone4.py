"""Tests for Milestone 4: Object/Ref cards, Complexity Lab, Packs, and Daily Review."""

from pathlib import Path

from fastapi.testclient import TestClient

from mentor import config, db
from mentor.app import app
from mentor.complexity_lab import get_complexity_pairs, run_complexity_comparison
from mentor.curriculum import build_review_queue, load_pack_modules, verify_lesson_module
from mentor.tracer import trace_python_code


def _make_client(tmp_path: Path, monkeypatch) -> TestClient:
    db_file = tmp_path / "m4_test.db"
    monkeypatch.setattr(config.settings, "db_path", db_file)
    db.init_db(db_file)
    return TestClient(app)


def test_object_serialization_and_shared_ref_obj_id() -> None:
    code = """class Ship:
    def __init__(self, fuel):
        self.fuel = fuel

a = Ship(50)
b = a
c = Ship(50)
b.fuel -= 10
"""
    res = trace_python_code(code)
    assert res.error is None
    final_vars = res.frames[-1].variables
    assert final_vars["a"].shape == "object"
    assert final_vars["a"].value["class_name"] == "Ship"
    assert final_vars["a"].value["fields"]["fuel"] == 40
    assert final_vars["a"].obj_id is not None
    assert final_vars["a"].obj_id == final_vars["b"].obj_id
    assert final_vars["c"].obj_id != final_vars["a"].obj_id


def test_all_milestone4_packs_verify_cleanly() -> None:
    packs = load_pack_modules()
    ids = {p.id for p in packs}
    expected = {
        "pack_recursion_basics",
        "pack_binary_search",
        "pack_classes_and_objects",
        "pack_hashmaps_and_stacks",
        "pack_defensive_exceptions",
        "pack_decorators_and_generators",
        "pack_auditing_ai_code",
    }
    assert expected.issubset(ids)
    for pack in packs:
        ver = verify_lesson_module(pack)
        assert ver.valid is True, f"{pack.id} failed: {ver.example_error} {ver.quiz_errors}"


def test_complexity_lab_runs_all_pairs_and_shows_speedup() -> None:
    pairs = get_complexity_pairs()
    assert len(pairs) == 3

    for pair in pairs:
        res = run_complexity_comparison(pair.id, pair.max_n)
        assert res["left"]["error"] is None
        assert res["right"]["error"] is None
        assert res["right"]["steps"] < res["left"]["steps"]


def test_daily_review_queue_prioritizes_missed_then_stale_then_new(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    # Record 1 passed quiz and 1 missed quiz
    db.save_quiz_result(quiz_id="m1_predict", module_id="mod_1_state", correct=True, score=1.0)
    db.save_quiz_result(quiz_id="m2_predict", module_id="mod_2_loops", correct=False, score=0.0)

    queue = build_review_queue(limit=5)
    assert queue["due_count"] == 1
    items = queue["items"]
    assert len(items) == 5
    # Missed quiz must be first!
    assert items[0]["quiz"]["id"] == "m2_predict"
    assert items[0]["reason"] == "missed"

    # Also verify HTTP endpoints respond cleanly
    rev_resp = client.get("/api/curriculum/review")
    assert rev_resp.status_code == 200
    assert rev_resp.json()["due_count"] == 1

    lab_resp = client.post("/api/complexity-lab/run", json={"pair_id": "linear_vs_binary", "n": 32})
    assert lab_resp.status_code == 200
    assert lab_resp.json()["right"]["steps"] < lab_resp.json()["left"]["steps"]
