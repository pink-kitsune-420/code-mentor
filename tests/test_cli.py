"""Unit tests for the code-mentor CLI launcher."""

from mentor import cli


def test_cli_invokes_uvicorn_with_defaults(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(app_str: str, *, host: str, port: int, reload: bool) -> None:
        captured["app"] = app_str
        captured["host"] = host
        captured["port"] = port
        captured["reload"] = reload

    monkeypatch.setattr(cli.uvicorn, "run", fake_run)
    cli.main([])

    assert captured == {
        "app": "mentor.app:app",
        "host": "127.0.0.1",
        "port": 8090,
        "reload": False,
    }


def test_cli_accepts_custom_host_port_and_reload(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(app_str: str, *, host: str, port: int, reload: bool) -> None:
        captured["app"] = app_str
        captured["host"] = host
        captured["port"] = port
        captured["reload"] = reload

    monkeypatch.setattr(cli.uvicorn, "run", fake_run)
    cli.main(["--host", "0.0.0.0", "--port", "9001", "--reload"])

    assert captured == {
        "app": "mentor.app:app",
        "host": "0.0.0.0",
        "port": 9001,
        "reload": True,
    }
