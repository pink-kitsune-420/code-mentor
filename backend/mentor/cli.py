"""CLI entrypoint for launching Visual AI Code Mentor."""

from __future__ import annotations

import argparse
import threading
import webbrowser

import uvicorn

from mentor.config import settings


def main(argv: list[str] | None = None) -> None:
    """Parse CLI flags and start the local Code Mentor server."""
    parser = argparse.ArgumentParser(
        prog="code-mentor",
        description="Launch Visual AI Code Mentor locally.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument(
        "--port",
        type=int,
        default=settings.app_port,
        help=f"Bind port (default: {settings.app_port})",
    )
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument(
        "--open",
        action="store_true",
        dest="open_browser",
        help="Open the web UI in your default browser",
    )
    args = parser.parse_args(argv)

    if args.open_browser:
        url = f"http://{args.host}:{args.port}"
        threading.Timer(0.8, webbrowser.open, args=(url,)).start()

    uvicorn.run("mentor.app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
