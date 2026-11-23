"""Tests for Milestone 5: Rosetta packs and snippet translation endpoint."""

from pathlib import Path

from fastapi.testclient import TestClient

from mentor import config, db
from mentor.app import app
from mentor.curriculum import load_pack_modules, verify_lesson_module


def _make_client(tmp_path: Path, monkeypatch) -> TestClient:
    db_file = tmp_path / "m5_test.db"
    monkeypatch.setattr(config.settings, "db_path", db_file)
    db.init_db(db_file)
    return TestClient(app)


def test_rosetta_packs_load_with_pairs_and_pass_verification() -> None:
    packs = load_pack_modules()
    rosetta = [p for p in packs if p.id in ("pack_rosetta_typescript", "pack_rosetta_rust")]
    assert len(rosetta) == 2

    for pack in rosetta:
        assert len(pack.rosetta_pairs) >= 3
        ver = verify_lesson_module(pack)
        assert ver.valid is True, f"{pack.id} failed: {ver.example_error} {ver.quiz_errors}"


def test_translate_snippet_endpoint_strips_thinking_and_handles_disabled(tmp_path: Path, monkeypatch) -> None:
    client = _make_client(tmp_path, monkeypatch)

    # Disabled AI returns clean offline notice
    db.save_ai_config(
        enabled=False,
        provider_url="http://127.0.0.1:8080",
        default_model="demo",
        db_path=tmp_path / "m5_test.db",
    )
    off_resp = client.post(
        "/api/translate-snippet",
        json={"code": "x = 5\n", "target_lang": "TypeScript"},
    )
    assert off_resp.status_code == 200
    assert off_resp.json()["ok"] is False

    # Mocked AI translation strips <think> blocks
    db.save_ai_config(
        enabled=True,
        provider_url="http://127.0.0.1:8080",
        default_model="demo",
        db_path=tmp_path / "m5_test.db",
    )

    class FakeResp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": "<think>translating</think>\nconst x: number = 5;\n- Uses const."
                        }
                    }
                ]
            }

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, *_args, **_kwargs):
            return FakeResp()

    monkeypatch.setattr("mentor.llm_client.httpx.AsyncClient", lambda **_kw: FakeClient())
    ok_resp = client.post(
        "/api/translate-snippet",
        json={"code": "x = 5\n", "target_lang": "TypeScript"},
    )
    assert ok_resp.status_code == 200
    body = ok_resp.json()
    assert body["ok"] is True
    assert "<think>" not in body["translation"]
    assert "const x: number = 5;" in body["translation"]
