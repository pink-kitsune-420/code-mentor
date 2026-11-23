# Changelog

All notable changes to **Visual AI Code Mentor** are documented in this file.

## `v0.1.0-alpha` — Public Alpha Baseline

### Added
- **CLI Launcher (`code-mentor`):** Run `uv run code-mentor` (supports `--host`, `--port`, `--reload`, `--open`).
- **Deterministic Python Execution Stepper:** Isolated `python -I` `sys.settrace` runner with step caps (`500`), timeouts (`3.0s`), numeric diff deltas, branch/loop insights, and `stdout` truncation (`4000` chars).
- **Visual Memory Boxes:** Numbers as gauges, lists as indexed strips, dicts as tables, and 2D arrays as visual grids with live `(row, col)` cursor highlights and emerald/amber diff glows.
- **Resizable & Draggable IDE Cockpit:** Full-viewport (`100dvh`) 5-window layout (`Visual State`, `Flow, Loops & Stack`, `Code Spotlight`, `Output Terminal`, `AI Mentor & Glossary`) with draggable splitters (`⋮` / `⋯`), drag-to-swap title bars, Maximize/Hide/Restore, and `Reset Layout`.
- **AST Plain-English Glossary:** Deterministic `ast.parse()` breakdown of keywords, loops, branches, calls, and subscripts.
- **In-App AI Model Provider Setup:** Supports `llama.cpp`, Ollama, LM Studio, and OpenAI-compatible endpoints with `/v1` normalization, **Test & Fetch**, local SQLite persistence, and `<think>` tag stripping.
- **Learn & Quiz Mode:** Optional 5-question Skill Check, difficulty-tagged Foundations Topic Catalog with `Builds on` / `Leads to` links, all 4 zero-typing quiz types (`predict`, `spot_bug`, `reorder`, `explain` with AI + offline rubric fallback), and **Open in Stepper** integration.
- **Open-Source Foundation:** MIT `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/ROADMAP.md`, and GitHub Actions CI.
