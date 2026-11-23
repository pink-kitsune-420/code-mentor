"""Starter interactive lessons for the Live Execution Stepper."""

from __future__ import annotations

from pydantic import BaseModel


class PresetLesson(BaseModel):
    """A beginner-friendly starter code preset for the Live Execution Stepper."""

    id: str
    title: str
    project_link: str
    difficulty: str
    summary: str
    concepts: list[str]
    watch_for: str
    code: str


STARTER_PRESETS: list[PresetLesson] = [
    PresetLesson(
        id="space_ship_tick",
        title="Mini Ship Fuel & Shields",
        project_link="State & Branching",
        difficulty="Starter 1",
        summary="Track ship state inside a dictionary and clamp shields so damage never goes negative.",
        concepts=["dict", "for loop", "if / else", "max() clamping"],
        watch_for="Watch the 'ship' dictionary card glow amber as fuel drops and shields absorb hits.",
        code='''ship = {"name": "Valkyrie", "fuel": 50, "shields": 30}
incoming_hits = [12, 25]

for damage in incoming_hits:
    if ship["fuel"] >= 10:
        ship["fuel"] -= 10
        ship["shields"] = max(0, ship["shields"] - damage)
        print("Dodged partial hit! Shields:", ship["shields"])
    else:
        print("Low fuel! Direct hit!")

print("Final state:", ship)
''',
    ),
    PresetLesson(
        id="voxel_grid_scan",
        title="3x3 Voxel Scanner",
        project_link="2D Grids & Loops",
        difficulty="Starter 2",
        summary="Loop over a 2D chunk grid row-by-row to count how many solid voxels exist.",
        concepts=["2D list (grid)", "nested for loops", "if condition", "counter"],
        watch_for="Watch 'chunk' render as a 3x3 visual grid while row and col indices step through it.",
        code='''chunk = [
    [1, 0, 1],
    [1, 1, 0],
    [0, 0, 1],
]
solid_count = 0

for row in range(len(chunk)):
    for col in range(len(chunk[row])):
        cell = chunk[row][col]
        if cell == 1:
            solid_count += 1

print("Solid voxels found:", solid_count)
''',
    ),
    PresetLesson(
        id="agent_command_router",
        title="Mini Command Router",
        project_link="Functions & Stack",
        difficulty="Starter 3",
        summary="See how functions take inputs, return results, and push/pop the Call Stack.",
        concepts=["def function", "return value", "call stack", "function scope"],
        watch_for="Watch the Call Stack panel grow when route_task() calls run_check() and shrink on return.",
        code='''def run_check(target):
    status = target + ": OK"
    return status

def route_task(command, target):
    if command == "check":
        result = run_check(target)
        return result
    return "Unknown command"

tasks = [("check", "tests"), ("deploy", "prod")]
reports = []

for cmd, tgt in tasks:
    reply = route_task(cmd, tgt)
    reports.append(reply)
    print(reply)
''',
    ),
]


def get_presets() -> list[PresetLesson]:
    """Return all built-in Milestone 1 starter presets."""
    return STARTER_PRESETS


def get_preset_by_id(preset_id: str) -> PresetLesson | None:
    """Look up a preset by ID."""
    for preset in STARTER_PRESETS:
        if preset.id == preset_id:
            return preset
    return None
