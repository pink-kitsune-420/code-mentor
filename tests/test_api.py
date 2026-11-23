"""API endpoint tests using FastAPI TestClient and isolated temp SQLite DB."""

from pathlib import Path

from fastapi.testclient import TestClient

from mentor import config, db
from mentor.app import app
from mentor.llm_client import normalize_v1_base, strip_thinking_tags


def _make_client(tmp_path: Path, monkeypatch) -> TestClient:
    db_file = tmp_path / "test_mentor.db"
    monkeypatch.setattr(config.settings, "db_path", db_file)
    db.init_db(db_file)
    return TestClient(app)


def test_presets_and_trace_endpoints(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    presets_resp = client.get("/api/presets")
    assert presets_resp.status_code == 200
    presets = presets_resp.json()
    assert len(presets) == 3

    trace_resp = client.post(
        "/api/trace",
        json={"code": presets[0]["code"], "preset_id": presets[0]["id"]},
    )
    assert trace_resp.status_code == 200
    body = trace_resp.json()
    assert body["trace"]["error"] is None
    assert body["trace"]["total_steps"] > 0
    assert len(body["glossary"]) > 0


def test_explain_step_handles_llama_success_and_offline(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)
    trace_resp = client.post("/api/trace", json={"code": "fuel = 10\nfuel -= 3\n"})
    frame = trace_resp.json()["trace"]["frames"][1]

    async def fake_explain_ok(**_kwargs):
        return {"ok": True, "model": "demo-model", "explanation": "fuel was created at 10."}

    monkeypatch.setattr("mentor.app.explain_trace_step", fake_explain_ok)
    resp = client.post(
        "/api/explain-step",
        json={"code": "fuel = 10\nfuel -= 3\n", "frame": frame},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert "fuel" in resp.json()["explanation"]


def test_ai_config_persistence_and_key_masking(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    async def fake_health(**_kwargs):
        return {"online": True, "models": ["llama3.2", "qwen2.5-coder"]}

    monkeypatch.setattr("mentor.app.check_llama_health", fake_health)

    save_resp = client.post(
        "/api/ai-config",
        json={
            "enabled": True,
            "provider_url": "http://127.0.0.1:11434/v1",
            "default_model": "llama3.2",
            "api_key": "sk-secret-test-key",
        },
    )
    assert save_resp.status_code == 200
    payload = save_resp.json()
    assert payload["ai_config"]["provider_url"] == "http://127.0.0.1:11434/v1"
    assert payload["ai_config"]["default_model"] == "llama3.2"
    assert payload["ai_config"]["has_api_key"] is True
    assert "sk-secret-test-key" not in save_resp.text

    get_resp = client.get("/api/ai-config")
    assert get_resp.status_code == 200
    assert get_resp.json()["has_api_key"] is True
    assert "sk-secret-test-key" not in get_resp.text


def test_normalize_v1_base_handles_with_and_without_suffix() -> None:
    assert normalize_v1_base("http://127.0.0.1:8080") == "http://127.0.0.1:8080/v1"
    assert normalize_v1_base("http://127.0.0.1:11434/v1/") == "http://127.0.0.1:11434/v1"
    assert normalize_v1_base("https://api.openai.com/v1") == "https://api.openai.com/v1"


def test_strip_thinking_tags_removes_reasoning_blocks() -> None:
    raw = "<think>\nlet me reason step by step\n</think>\nLine 2 updates fuel."
    assert strip_thinking_tags(raw) == "Line 2 updates fuel."
