# Security Policy

## Execution Model & Scope

Visual AI Code Mentor (`v0.1.0-alpha`) is designed as a **local, single-user learning tool** running on your own workstation (`127.0.0.1`).

- User-edited Python snippets execute inside an isolated subprocess (`python3 -I`) with blocked dangerous modules (`os`, `subprocess`, `socket`, `sys`, etc.), removed file/eval builtins (`open`, `exec`, `eval`, `compile`, `input`), a step limit (`500` steps), and a `3.0s` wall-clock timeout.
- **Important:** Python's built-in sandbox restrictions are educational guardrails only and are **not** hardened against adversarial untrusted code in multi-tenant public deployments. Do not expose this server directly to the public internet or untrusted users.

## Local AI Keys

- Optional API keys configured through the UI are stored locally in `data/mentor.db` (which is gitignored) and are never returned in API responses (`GET /api/ai-config` only returns `has_api_key: true/false`).

## Reporting Vulnerabilities

If you find a security issue, please open a private security advisory on the repository host or avoid posting working exploit payloads publicly until a fix is released.
