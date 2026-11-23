# Code Mentor — Project Rules

- Python package lives in `backend/mentor/`, tests in `tests/`, React UI in `frontend/`.
- Always run `uv run ruff check backend tests` and `uv run pytest -v` after backend changes.
- Always run `npm run build` in `frontend/` after frontend changes.
- Keep execution tracing deterministic (`sys.settrace` inside isolated subprocesses); never let the LLM invent variable states or AST structures.
