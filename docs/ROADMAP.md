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

### Milestone 3 — In-App Lesson Creator & Shareable Lesson Packs
- **Create Lesson Studio:** Enter any topic or paste a snippet to generate a structured visual lesson + zero-typing quizzes (or author manually offline) with click-a-line bug selection and tracer-grabbed output.
- **Tracer-Verified Examples & Auto-Repair:** Every AI-generated lesson runs through `tracer.py` (with 1 automatic repair pass on error), and saving/importing requires a clean trace.
- **Shareable JSON Lesson Packs:** Built-in `lessons/` pack loading (`lessons/recursion_basics.json`, `lessons/binary_search.json`), SQLite `custom_lessons` persistence, and 1-click JSON Export/Import.

### Milestone 4 — Intermediate → Expert Curriculum, Object Cards, Step-Count Lab & Daily Review
- **Object & Shared-Reference Cards:** Custom class instances render as structured field cards in Visual Memory Boxes with `Shared with:` badges whenever two variables point to the same mutable object.
- **Step-Count Complexity Lab:** Interactive side-by-side comparison of algorithm pairs (`O(n)` vs `O(log n)`, `O(n^2)` vs `O(n)`, `O(2^n)` vs `O(n)`) across selectable `N` sizes backed by real tracer step counts.
- **Intermediate → Expert Lesson Packs:** Curated JSON packs in `lessons/` covering `Classes & Objects`, `Hash Maps & Stacks`, `Defensive Code & Exceptions`, `Decorators & Generators`, and `Auditing AI-Written Code`.
- **Daily Review / Weak Spots Queue:** Prioritized spaced-repetition queue surfacing missed quizzes first, oldest passed checks second, and fresh topics when caught up.

---

### Milestone 5 — Cross-Language Transfer, Live Call Trees & Read Aloud (Completed)
- **Cross-Language Rosetta Bridges:** Curated offline `Python <-> TypeScript` and `Python <-> Rust` side-by-side comparison packs in Learn & Quiz mode (`lessons/rosetta_typescript.json`, `lessons/rosetta_rust.json`), plus optional AI snippet translation (`To TypeScript` / `To Rust` via `POST /api/translate-snippet`) when online.
- **Live Interactive Call-Tree Diagram:** Deterministic call-tree builder (`buildCallTree`) in Flow & Loops (`[Call Tree | Stack | Loops & Lines]`) highlighting the active frame, green return badges (`-> val`), and click-to-jump stepping.
- **Browser Read Aloud:** Lightweight zero-download `window.speechSynthesis` helper (`Read` / `Read Aloud` / `Stop`) on AI replies and lesson walkthroughs, automatically hidden when unsupported.

## Upcoming Milestones

### Milestone 6 — Deeper Voice & Collaboration
- **Optional Local Voice Tutor:** Hands-free speech input (Whisper STT) and offline neural narration (Kokoro/Piper TTS).
- **Interactive Memory Aliasing & Heap Graph:** Expanded object-reference arrows for nested mutable structures across frames.
