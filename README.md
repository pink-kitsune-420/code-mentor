# Visual AI Code Mentor (`v0.1.0-alpha`)

> **Early Alpha Software:** Visual AI Code Mentor is actively evolving. Features, layouts, and APIs may change rapidly between releases.

> **Important — Verify AI Explanations Yourself:**
> AI models are **not** 100% accurate and can hallucinate or miss subtle behavior. Always pair AI explanations with your own understanding, the deterministic execution trace, Visual Memory Boxes, and independent reading/research before treating any AI answer as fact.

An open-source, local-first **Beginner → Expert Visual Code Tutor**. It helps you build real code literacy through a deterministic Python execution stepper, visual memory boxes, an AST plain-English glossary, zero-typing interactive quizzes, and an optional AI mentor (compatible with Ollama, LM Studio, `llama.cpp`, or any OpenAI-compatible API).

## Features

- **Topic-Based Skill Catalog & Zero-Typing Quizzes:** Explore programming topics freely (`Beginner` → `Expert`) across `Foundations`, `Algorithms & Patterns`, `Architecture & Patterns`, `Reliability & Testing`, `Python Deep Dive`, `Real-World Code Review`, and `Cross-Language Bridges`—plus an optional 5-minute Skill Check and a **Daily Review** queue that prioritizes weak spots.
- **Cross-Language Rosetta Bridges & Read Aloud:** Compare `Python <-> TypeScript` and `Python <-> Rust` side-by-side in offline packs (or translate snippets via `To TypeScript` / `To Rust` when local AI is online), and listen to AI replies or lessons via browser Read Aloud.
- **Live Interactive Call-Tree & Trace Inspector:** Step through execution with `[Call Tree | Stack | Loops & Lines]`, inspect return values directly on tree nodes with click-to-jump navigation, and trace variables across stack frames.
- **Step-Count Complexity Lab:** Compare algorithm pairs (`Linear vs. Binary Search`, `Nested Loops vs. Hash Set`, `Recursive vs. Memoized Fibonacci`) across input sizes `N` using real execution step counts.
- **Lesson Creator Studio & Shareable Packs:** Click **+ Create / Import** in Learn & Quiz mode to author custom lessons manually or draft them with AI (with 1-click **Verify in Tracer** and auto-repair), and export/import portable `.json` lesson packs.
- **Deterministic Live Execution Stepper:** Runs Python snippets in an isolated subprocess (`python -I`) with step limits and timeouts—recording exact line-by-line state without AI guessing.
- **Visual Memory Boxes:** Renders numbers as gauges, lists as indexed strips, dicts as tables, custom class instances as Object Cards, shared mutable references with `Shared with:` badges, and 2D arrays as visual grids with emerald/amber diff highlights.
- **Output Terminal & Flow Inspector:** Dedicated terminal window for `print()` output alongside a Call Stack, Loop Iterations, and Line-Jump inspector.
- **Resizable & Draggable IDE Cockpit:** Full-viewport (`100dvh`) split layout with draggable resize splitters (`⋮` / `⋯`), drag-and-drop `⋮⋮` title bar window swapping, maximize/hide/restore controls, and `Reset Layout`.
- **AST Plain-English Glossary:** Inspects Python syntax structures deterministically using `ast.parse()`.
- **Easy In-App AI Model Setup:** Click **Setup AI / AI Ready** in the top bar (or **Setup** in the AI Mentor window) to pick a preset (`llama.cpp`, Ollama, LM Studio, OpenAI-compatible, or Off), test the connection, fetch available models, and save—no restart required.

## Quick Start

### Prerequisites
- Python 3.12+ and [`uv`](https://docs.astral.sh/uv/)
- Node.js 20+ and `npm`

### Build & Run (Single Server)
```bash
uv sync --group dev
(cd frontend && npm install && npm run build)
uv run code-mentor --open
```
*(Or run `uv run uvicorn mentor.app:app --host 127.0.0.1 --port 8090` directly and open `http://127.0.0.1:8090`.)*

### Development Mode (Hot Reload)
Terminal 1:
```bash
uv run code-mentor --reload
```
Terminal 2:
```bash
cd frontend && npm run dev
```
Open `http://127.0.0.1:5173`.

### Configuring an AI Model
You can configure your model directly in the UI (**Setup AI** button in the top bar) or via environment variables (see `.env.example`):
```bash
export MENTOR_LLAMA_URL=http://127.0.0.1:11434/v1
export MENTOR_DEFAULT_MODEL=llama3.2
```
If no AI server is configured or running, the deterministic stepper, memory boxes, terminal, AST glossary, and offline quizzes continue to work 100%.

## Keyboard Shortcuts (Stepper Mode)
- `←` / `→`: Step backward / forward
- `Space`: Play / Pause

## Tests & Lint
```bash
uv run ruff check backend tests
uv run pytest -v
cd frontend && npm run build
```

## Roadmap, Security & Contributing
- Vision and upcoming milestones (including the Lesson Creator Studio): [docs/ROADMAP.md](docs/ROADMAP.md)
- Local-only execution scope and safety notes: [SECURITY.md](SECURITY.md)
- Contribution guidelines: [CONTRIBUTING.md](CONTRIBUTING.md)

## License
[MIT](LICENSE)
