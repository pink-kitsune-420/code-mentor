# Contributing to Visual AI Code Mentor

Thanks for helping improve Visual AI Code Mentor!

## Local Development

```bash
uv sync --group dev
(cd frontend && npm install)
```

Run backend + frontend dev servers in two terminals:

```bash
uv run uvicorn mentor.app:app --reload --port 8090
```

```bash
cd frontend && npm run dev
```

## Checks Before Opening a PR

1. Lint & test the Python backend:
   ```bash
   uv run ruff check backend tests
   uv run pytest -v
   ```
2. Type-check and build the React frontend:
   ```bash
   cd frontend && npm run build
   ```
3. Keep execution tracing deterministic (`sys.settrace` inside isolated subprocesses). Do not let LLM responses fabricate code structure or runtime variable states.
