# Visual AI Code Mentor — Roadmap

> **Mission:** A local-first, open-source **Beginner → Expert Visual Code Tutor & Lesson Studio**. It helps learners build genuine code literacy from their very first variable up to complex algorithms, architecture, and reviewing AI-written code—without blank-editor typing paralysis.

---

## Core Design Principles

1. **Topic-Based Skill Catalog (No Rigid Ladder):** Explore any concept out of curiosity—tagged clearly as `Beginner`, `Intermediate`, `Advanced`, or `Expert`—or take an optional 5-minute Skill Check for tailored suggestions.
2. **Zero-Typing-Friction Learning:** Learn through visual execution, *Predict the Output*, *Spot the Bug*, *Reorder Logic Blocks*, and *Explain in Plain English* instead of fighting syntax errors from scratch.
3. **Deterministic Grounding First:** Structure comes from Python's AST (`ast.parse`) and runtime state comes from real isolated subprocess execution (`sys.settrace`). AI explanations are grounded strictly in recorded trace frames and paired with clear accuracy disclaimers.
4. **AI-Optional by Design:** Works 100% offline with built-in lessons, deterministic quizzes, AST glossaries, and visual tracing—and connects seamlessly to `llama.cpp`, Ollama, LM Studio, or OpenAI-compatible APIs when desired.

---

## Completed Milestones (`v0.1.0-alpha`)

### Milestone 1 — Dockable Live Execution Stepper & AST Glossary
- Isolated `python -I` subprocess tracer with step caps (`500`), timeouts (`3.0s`), `stdout` capping, and numerical diff deltas.
- Visual Memory Boxes (gauges, indexed list strips, dict cards, and 2D grids with live cursor tracking).
- Resizable, drag-to-swap 5-window IDE cockpit (`Visual State`, `Flow, Loops & Stack`, `Code Spotlight`, `Output Terminal`, `AI Mentor & Glossary`).
- Deterministic AST plain-English line breakdown + In-App AI Model Provider setup modal.

### Milestone 2 — Skill Check, Foundations Catalog & Zero-Typing Quizzes
- Topbar `[Stepper | Learn & Quiz]` workspace mode switcher.
- Optional 5-question Skill Check + **Foundations** topic track (`State & Data Shapes`, `Decisions & Loops`, `Functions & Contracts`, `Connecting Parts`, `Reading Failures & Tests`).
- All 4 zero-typing quiz mechanics (`predict`, `spot_bug`, `reorder`, `explain`) with SQLite progress tracking and **Open in Stepper** integration.

---

## Upcoming Milestones

### Milestone 3 — In-App Lesson Creator & Shareable Lesson Packs
- **Create Lesson Studio:** Enter any topic (e.g., *"recursion"*, *"binary search"*, *"decorators"*) or paste a snippet to generate a structured visual lesson + zero-typing quizzes.
- **Tracer-Verified Examples:** Every AI-generated lesson example is automatically executed through `tracer.py` to guarantee it runs cleanly before saving.
- **Shareable JSON Lesson Packs:** Load and export portable `.json` lesson packs in `lessons/` so educators and learners can share custom tracks.

### Milestone 4 — Intermediate → Expert Topic Catalog
- **Data Structures & Algorithms Visually:** Recursion call-stack animations, Hash Maps, Stacks/Queues, Trees/Graphs, Binary Search, and Step-Count complexity comparisons.
- **Architecture, Patterns & Async:** Classes & State Machines, Decorators/Closures, Generators, Error Handling, and Unit Testing contracts.
- **Reviewing AI-Written Code Track:** Dedicated advanced practice track focused on spotting silent assumptions, missing edge-case tests, and contract mismatches in AI-generated snippets/diffs.

### Milestone 5 — Voice Walkthroughs & Multi-Language Transfer
- **Optional Voice Tutor:** Hands-free speech input (Whisper STT) and diagram/step narration (Kokoro/Piper TTS).
- **Cross-Language Rosetta Bridges:** Side-by-side Python → TypeScript and Python → Rust conceptual views (translating familiar mental models into typed and compiled languages).
