"""Unit tests for the deterministic Python sys.settrace runner."""

from mentor.presets import get_preset_by_id
from mentor.tracer import trace_python_code


def test_space_ship_tick_preset_traces_cleanly() -> None:
    preset = get_preset_by_id("space_ship_tick")
    assert preset is not None

    result = trace_python_code(preset.code)
    assert result.error is None
    assert result.truncated is False
    assert result.total_steps > 5

    final_frame = result.frames[-1]
    assert final_frame.variables["ship"].value["fuel"] == 30
    assert final_frame.variables["ship"].value["shields"] == 0
    assert "Final state:" in final_frame.stdout

    assert any(f.branch_info and "Condition True" in f.branch_info for f in result.frames)


def test_voxel_grid_scan_detects_grid2d_and_counts_solids() -> None:
    preset = get_preset_by_id("voxel_grid_scan")
    assert preset is not None

    result = trace_python_code(preset.code)
    assert result.error is None
    assert result.frames[0].line == 1
    final_frame = result.frames[-1]
    assert final_frame.variables["chunk"].shape == "grid2d"
    assert final_frame.variables["solid_count"].value == 5
    assert "Solid voxels found: 5" in final_frame.stdout


def test_agent_command_router_records_call_stack_and_returns() -> None:
    preset = get_preset_by_id("agent_command_router")
    assert preset is not None

    result = trace_python_code(preset.code)
    assert result.error is None

    calls = [f for f in result.frames if f.event == "call"]
    returns = [f for f in result.frames if f.event == "return" and f.function != "<module>"]
    assert any(f.function == "route_task" for f in calls)
    assert any(f.function == "run_check" for f in calls)
    assert any(f.function == "run_check" and f.return_value == "'tests: OK'" for f in returns)
    assert any(len(f.call_stack) == 3 for f in result.frames)


def test_variable_diff_captures_numeric_delta() -> None:
    code = "score = 10\nscore += 5\n"
    result = trace_python_code(code)
    assert result.error is None

    deltas = [
        f.changes.updated["score"].delta
        for f in result.frames
        if "score" in f.changes.updated
    ]
    assert 5 in deltas


def test_infinite_loop_stops_at_step_limit() -> None:
    code = "x = 0\nwhile True:\n    x += 1\n"
    result = trace_python_code(code, max_steps=25)
    assert result.truncated is True
    assert result.total_steps == 25
    assert result.error is not None
    assert "25 steps" in result.error


def test_syntax_error_returns_friendly_diagnostic() -> None:
    result = trace_python_code("if x == 1\n    print(x)\n")
    assert result.frames == []
    assert result.error is not None
    assert "SyntaxError" in result.error


def test_blocked_module_import_fails_safely() -> None:
    result = trace_python_code("import os\nprint(os.getcwd())\n")
    assert result.error is not None
    assert "disabled" in result.error
