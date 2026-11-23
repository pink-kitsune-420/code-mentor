"""Skill Check and Topic-Based Educational Curriculum."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

QuizKind = Literal["predict", "spot_bug", "reorder", "explain"]
DifficultyLevel = Literal["Beginner", "Intermediate", "Advanced", "Expert"]


class QuizQuestion(BaseModel):
    """A zero-typing interactive comprehension question."""

    id: str
    kind: QuizKind
    title: str
    prompt: str
    code: str = ""
    options: list[str] = []
    blocks: list[str] = []
    correct_index: int | None = None
    correct_line: int | None = None
    correct_order: list[int] = []
    rubric_keywords: list[str] = []
    sample_explanation: str = ""
    explanation: str


class CurriculumModule(BaseModel):
    """An educational topic lesson anchored to interactive Stepper code."""

    id: str
    track: str
    difficulty: DifficultyLevel
    tier: int
    order: int
    title: str
    subtitle: str
    prerequisites: list[str] = []
    concepts: list[str]
    lesson_points: list[str]
    example_code: str
    quizzes: list[QuizQuestion]


PLACEMENT_QUESTIONS: list[QuizQuestion] = [
    QuizQuestion(
        id="place_dict",
        kind="predict",
        title="Reading a Dictionary",
        prompt="What does this snippet print?",
        code='''ship = {"fuel": 40, "shields": 25}
ship["fuel"] -= 15
print(ship["fuel"])
''',
        options=["40", "25", "15", "Error"],
        correct_index=1,
        explanation="ship['fuel'] starts at 40, and '-= 15' subtracts 15 from it, leaving 25.",
    ),
    QuizQuestion(
        id="place_branch",
        kind="predict",
        title="If / Else Branching",
        prompt="Which message gets printed?",
        code='''energy = 8
if energy >= 10:
    print("Boost")
else:
    print("Recharge")
''',
        options=["Boost", "Recharge", "Both Boost and Recharge", "Nothing prints"],
        correct_index=1,
        explanation="Since 8 >= 10 is False, Python skips the 'if' block and runs the 'else' block.",
    ),
    QuizQuestion(
        id="place_loop",
        kind="predict",
        title="Counting in a Loop",
        prompt="What is the final value of total?",
        code='''total = 0
for n in [2, 4, 6]:
    total += n
print(total)
''',
        options=["6", "10", "12", "3"],
        correct_index=2,
        explanation="The loop adds 2, then 4, then 6 to total (0 + 2 + 4 + 6 = 12).",
    ),
    QuizQuestion(
        id="place_func",
        kind="predict",
        title="Function Return Values",
        prompt="What does result equal after line 4?",
        code='''def double(x):
    return x * 2

result = double(7)
''',
        options=["7", "14", "None", "x * 2"],
        correct_index=1,
        explanation="Calling double(7) runs the function with x=7 and sends 14 back via 'return'.",
    ),
    QuizQuestion(
        id="place_edge",
        kind="spot_bug",
        title="Spotting a Subtle Bug",
        prompt="Click the line that causes an error when 'items' is an empty list [].",
        code='''def first_item(items):
    first = items[0]
    return first

print(first_item([]))
''',
        correct_line=2,
        explanation="Line 2 tries to grab index 0 from an empty list, causing an IndexError.",
    ),
]


TIER1_MODULES: list[CurriculumModule] = [
    CurriculumModule(
        id="mod_1_state",
        track="Foundations",
        difficulty="Beginner",
        tier=1,
        order=1,
        title="State & Data Shapes",
        subtitle="Variables, numbers, lists, and dictionaries",
        concepts=["variable", "dict {key: val}", "list [a, b]", "in-place update"],
        lesson_points=[
            "Variables are named labels pointing to values in memory (numbers, text, lists, or dicts).",
            "A list [12, 25] stores ordered items by position starting at index 0.",
            'A dictionary {"fuel": 50} stores named fields so you read ship["fuel"] instead of guessing positions.',
            "When you write x -= 10, Python reads x, subtracts 10, and saves the new value back.",
        ],
        example_code='''ship = {"name": "Scout", "fuel": 40, "cargo": ["ore", "cells"]}
ship["fuel"] -= 15
ship["cargo"].append("water")
print(ship["fuel"], len(ship["cargo"]))
''',
        quizzes=[
            QuizQuestion(
                id="m1_predict",
                kind="predict",
                title="Predict the Output",
                prompt="What will this snippet print?",
                code='''ship = {"fuel": 30, "cargo": ["ore"]}
ship["fuel"] += 20
ship["cargo"].append("cells")
print(ship["fuel"], len(ship["cargo"]))
''',
                options=["30 1", "50 2", "20 2", "50 1"],
                correct_index=1,
                explanation=(
                    "fuel increases from 30 to 50, and appending 'cells' grows the cargo list to 2 items."
                ),
            ),
            QuizQuestion(
                id="m1_reorder",
                kind="reorder",
                title="Order the Logic",
                prompt="Arrange these blocks so the ship is created first, refueled, and then printed.",
                blocks=[
                    'print("Fuel ready:", ship["fuel"])',
                    'ship["fuel"] += 25',
                    'ship = {"fuel": 10, "shields": 50}',
                ],
                correct_order=[2, 1, 0],
                explanation=(
                    "Python executes top-to-bottom: you must create 'ship' before updating or printing it."
                ),
            ),
            QuizQuestion(
                id="m1_explain",
                kind="explain",
                title="Explain Intent in Plain English",
                prompt=(
                    "In 1-2 plain sentences, what does using a dictionary solve here "
                    "compared to separate variables?"
                ),
                code='ship = {"name": "Scout", "fuel": 40, "shields": 100}\n',
                rubric_keywords=[
                    "group",
                    "related",
                    "name",
                    "field",
                    "key",
                    "together",
                    "data",
                    "ship",
                ],
                sample_explanation=(
                    "It groups all related fields for one ship together under clear named keys "
                    "(like 'fuel' and 'shields') instead of juggling scattered variables."
                ),
                explanation=(
                    "Dictionaries bundle related fields under readable key names, "
                    "making code easier for humans and agents to pass around."
                ),
            ),
        ],
    ),
    CurriculumModule(
        id="mod_2_loops",
        track="Foundations",
        difficulty="Beginner",
        tier=1,
        order=2,
        title="Decisions & Loops",
        subtitle="if / elif / else gates and for-loop iteration",
        prerequisites=["mod_1_state"],
        concepts=["if / else", "for loop", "accumulator", "nested grid"],
        lesson_points=[
            "An 'if' statement is a gate: its indented block only runs when the condition evaluates to True.",
            "A 'for' loop repeats the indented block once per item, updating the loop variable every pass.",
            "Nested loops (a loop inside a loop) walk 2D grids row-by-row and column-by-column.",
        ],
        example_code='''grid = [
    [1, 0, 1],
    [0, 1, 0],
]
solid = 0
for row in grid:
    for cell in row:
        if cell == 1:
            solid += 1
print("Solid:", solid)
''',
        quizzes=[
            QuizQuestion(
                id="m2_predict",
                kind="predict",
                title="Trace the Loop Counter",
                prompt="What does this loop print at the end?",
                code='''alerts = 0
for temp in [70, 95, 80, 105]:
    if temp >= 90:
        alerts += 1
print(alerts)
''',
                options=["1", "2", "4", "105"],
                correct_index=1,
                explanation="Only 95 and 105 are >= 90, so 'alerts' increments twice to 2.",
            ),
            QuizQuestion(
                id="m2_spot_bug",
                kind="spot_bug",
                title="Spot the Agent Bug",
                prompt=(
                    "An AI agent tried to count positive scores, but the counter resets every iteration. "
                    "Click the buggy line."
                ),
                code='''scores = [5, -1, 8]
for s in scores:
    count = 0
    if s > 0:
        count += 1
print(count)
''',
                correct_line=3,
                explanation=(
                    "Line 3 resets 'count = 0' inside the loop on every pass "
                    "instead of initializing it once before the loop!"
                ),
            ),
            QuizQuestion(
                id="m2_reorder",
                kind="reorder",
                title="Build a Safe Loop",
                prompt="Arrange these blocks to count how many items are 'ok'.",
                blocks=[
                    '    if item == "ok":',
                    "        good += 1",
                    "good = 0",
                    'for item in ["ok", "err", "ok"]:',
                    "print(good)",
                ],
                correct_order=[2, 3, 0, 1, 4],
                explanation=(
                    "Initialize 'good = 0' before the loop, check each item inside, "
                    "and print after the loop finishes."
                ),
            ),
        ],
    ),
    CurriculumModule(
        id="mod_3_functions",
        track="Foundations",
        difficulty="Beginner",
        tier=1,
        order=3,
        title="Functions & Contracts",
        subtitle="def, parameters, return values, and the call stack",
        prerequisites=["mod_1_state", "mod_2_loops"],
        concepts=["def", "parameters", "return", "local scope"],
        lesson_points=[
            "Running 'def' loads a reusable recipe into memory—it waits until called with ().",
            "Parameters are input slots; 'return' hands a result back to the caller and exits immediately.",
            "Variables created inside a function live in that call's local stack frame and vanish on return.",
        ],
        example_code='''def apply_damage(shields, hit):
    remaining = max(0, shields - hit)
    return remaining

current = 30
current = apply_damage(current, 45)
print("Shields:", current)
''',
        quizzes=[
            QuizQuestion(
                id="m3_predict",
                kind="predict",
                title="Early Return Check",
                prompt="What does check_fuel(0) return?",
                code='''def check_fuel(fuel):
    if fuel <= 0:
        return "Empty"
    return "Ready"

print(check_fuel(0))
''',
                options=["Empty", "Ready", "Empty then Ready", "None"],
                correct_index=0,
                explanation=(
                    "As soon as 'return \"Empty\"' runs, the function exits immediately—line 4 never executes."
                ),
            ),
            QuizQuestion(
                id="m3_spot_bug",
                kind="spot_bug",
                title="Spot the Missing Return",
                prompt="Click the line causing 'total' to become None instead of 15.",
                code='''def add_bonus(score):
    new_score = score + 5

total = add_bonus(10)
print(total)
''',
                correct_line=2,
                explanation=(
                    "add_bonus computes new_score on line 2, but never returns it, "
                    "so Python returns None by default."
                ),
            ),
            QuizQuestion(
                id="m3_explain",
                kind="explain",
                title="Explain Function Scope",
                prompt=(
                    "Why does 'return' matter instead of just setting a variable named "
                    "'remaining' inside the function?"
                ),
                code='''def clamp(val):
    remaining = max(0, val)
    return remaining
''',
                rubric_keywords=[
                    "local",
                    "scope",
                    "caller",
                    "outside",
                    "send",
                    "back",
                    "disappear",
                    "frame",
                ],
                sample_explanation=(
                    "Variables inside a function are local to that call frame and disappear on exit, "
                    "so 'return' sends the result back to the caller."
                ),
                explanation=(
                    "Local variables stay private inside the function's call stack frame; "
                    "'return' passes the output cleanly across the boundary."
                ),
            ),
        ],
    ),
    CurriculumModule(
        id="mod_4_modules",
        track="Foundations",
        difficulty="Beginner",
        tier=1,
        order=4,
        title="Connecting Parts",
        subtitle="Separating data from pure logic functions",
        prerequisites=["mod_3_functions"],
        concepts=["pure function", "data vs logic", "pipeline", "composition"],
        lesson_points=[
            "Projects split 'data shapes' (dicts/objects) from 'logic functions' that transform them.",
            "Pure functions take inputs and return outputs without hidden side effects—easy to test.",
            "Calling small helper functions in sequence forms a readable data pipeline.",
        ],
        example_code='''def parse_cmd(raw):
    return raw.strip().lower()

def run_cmd(cmd):
    if cmd == "ping":
        return "pong"
    return "unknown"

cleaned = parse_cmd("  PING ")
reply = run_cmd(cleaned)
print(reply)
''',
        quizzes=[
            QuizQuestion(
                id="m4_reorder",
                kind="reorder",
                title="Assemble the Pipeline",
                prompt="Order these steps so raw input is cleaned first, routed second, and printed last.",
                blocks=[
                    "reply = route(clean)",
                    'raw = "  STATUS "',
                    "print(reply)",
                    "clean = raw.strip().lower()",
                ],
                correct_order=[1, 3, 0, 2],
                explanation=(
                    "Data flows step-by-step: raw text -> cleaned text -> routed reply -> printed output."
                ),
            ),
            QuizQuestion(
                id="m4_predict",
                kind="predict",
                title="Chained Function Calls",
                prompt="What gets printed?",
                code='''def step_a(x):
    return x + 2

def step_b(y):
    return y * 3

print(step_b(step_a(4)))
''',
                options=["14", "18", "10", "24"],
                correct_index=1,
                explanation="Inner call step_a(4) returns 6 first, then outer call step_b(6) returns 18.",
            ),
            QuizQuestion(
                id="m4_explain",
                kind="explain",
                title="Why Split Functions?",
                prompt=(
                    "Why is separating parse_cmd() and run_cmd() better for agentic coding "
                    "than putting everything in one giant block?"
                ),
                code="clean = parse_cmd(text)\nreply = run_cmd(clean)\n",
                rubric_keywords=[
                    "test",
                    "small",
                    "reuse",
                    "read",
                    "separate",
                    "bug",
                    "focus",
                    "boundary",
                ],
                sample_explanation=(
                    "Small single-purpose functions have clear input/output contracts, making them easy "
                    "to test independently and safer for AI agents to edit."
                ),
                explanation=(
                    "Clear boundaries between small functions make both human reading "
                    "and AI agent edits dramatically more reliable."
                ),
            ),
        ],
    ),
    CurriculumModule(
        id="mod_5_debugging",
        track="Foundations",
        difficulty="Beginner",
        tier=1,
        order=5,
        title="Reading Failures & Tests",
        subtitle="Assertions, edge cases, and common code mistakes",
        prerequisites=["mod_2_loops", "mod_3_functions"],
        concepts=["assert", "edge case", "off-by-one", "None / empty"],
        lesson_points=[
            "Tests use 'assert condition' to verify a function keeps its promise on normal and tricky inputs.",
            "Most AI agent bugs happen at boundaries: empty lists [], zero, negative numbers, or None.",
            "Reading tests first is the fastest way to understand what an agent's code is supposed to do.",
        ],
        example_code='''def average(nums):
    if not nums:
        return 0
    return sum(nums) / len(nums)

assert average([10, 20]) == 15
assert average([]) == 0
print("All checks passed!")
''',
        quizzes=[
            QuizQuestion(
                id="m5_spot_bug",
                kind="spot_bug",
                title="Spot the Edge-Case Crash",
                prompt="Click the line that crashes with ZeroDivisionError when 'nums' is empty [].",
                code='''def average(nums):
    total = sum(nums)
    return total / len(nums)

print(average([]))
''',
                correct_line=3,
                explanation="When nums is [], len(nums) is 0, so line 3 divides total by 0!",
            ),
            QuizQuestion(
                id="m5_predict",
                kind="predict",
                title="Assert Behavior",
                prompt="What happens when this code runs?",
                code='''def clamp_positive(n):
    return max(0, n)

assert clamp_positive(-5) == 0
print("OK")
''',
                options=["AssertionError", "Prints OK", "Prints -5", "SyntaxError"],
                correct_index=1,
                explanation=(
                    "max(0, -5) returns 0, so the assert condition is True and Python continues to print OK."
                ),
            ),
            QuizQuestion(
                id="m5_explain",
                kind="explain",
                title="Reviewing Agent Tests",
                prompt=(
                    "When an AI agent submits a fix, why is checking the 'assert' tests "
                    "so valuable before trusting the code?"
                ),
                code="assert average([]) == 0\n",
                rubric_keywords=[
                    "edge",
                    "prove",
                    "contract",
                    "case",
                    "empty",
                    "verify",
                    "behavior",
                    "expect",
                ],
                sample_explanation=(
                    "Tests show the exact edge cases and expected outputs the agent checked—"
                    "if empty or negative cases are missing, the code probably ignores them."
                ),
                explanation=(
                    "Tests document the contract in plain assertions; "
                    "missing edge-case tests are your fastest clue to hidden bugs."
                ),
            ),
        ],
    ),
]


def get_all_modules() -> list[CurriculumModule]:
    """Return Tier 1 modules in curriculum order."""
    return TIER1_MODULES


def get_quiz_by_id(quiz_id: str) -> tuple[str | None, QuizQuestion | None]:
    """Find a quiz question across placement and Tier 1 modules, returning (module_id, question)."""
    for q in PLACEMENT_QUESTIONS:
        if q.id == quiz_id:
            return (None, q)
    for mod in TIER1_MODULES:
        for q in mod.quizzes:
            if q.id == quiz_id:
                return (mod.id, q)
    return (None, None)


def grade_deterministic_answer(
    question: QuizQuestion,
    *,
    selected_index: int | None = None,
    selected_line: int | None = None,
    ordered_indices: list[int] | None = None,
    explanation_text: str | None = None,
) -> dict[str, object]:
    """Deterministically grade predict, spot_bug, reorder, or offline explain quizzes."""
    if question.kind == "predict":
        correct = selected_index is not None and selected_index == question.correct_index
        expected = (
            question.options[question.correct_index]
            if question.correct_index is not None and question.correct_index < len(question.options)
            else ""
        )
        return {
            "correct": correct,
            "score": 1.0 if correct else 0.0,
            "feedback": question.explanation,
            "expected": expected,
            "ai_graded": False,
        }

    if question.kind == "spot_bug":
        correct = selected_line is not None and selected_line == question.correct_line
        return {
            "correct": correct,
            "score": 1.0 if correct else 0.0,
            "feedback": question.explanation,
            "expected": f"Line {question.correct_line}",
            "ai_graded": False,
        }

    if question.kind == "reorder":
        correct = ordered_indices == question.correct_order
        return {
            "correct": correct,
            "score": 1.0 if correct else 0.0,
            "feedback": question.explanation,
            "expected": question.correct_order,
            "ai_graded": False,
        }

    text = (explanation_text or "").strip().lower()
    if len(text) < 8:
        return {
            "correct": False,
            "score": 0.0,
            "feedback": "Write a short 1-2 sentence explanation first, then compare with the sample answer.",
            "expected": question.sample_explanation,
            "ai_graded": False,
        }

    hits = sum(1 for kw in question.rubric_keywords if kw in text)
    passed = hits >= 2 or (hits >= 1 and len(text.split()) >= 8)
    score = 1.0 if passed else 0.5
    feedback = (
        f"Nice intuition! Compare with the sample explanation: {question.sample_explanation}"
        if passed
        else f"Good attempt (offline rubric). Key idea to include: {question.sample_explanation}"
    )
    return {
        "correct": passed,
        "score": score,
        "feedback": feedback,
        "expected": question.sample_explanation,
        "ai_graded": False,
    }
