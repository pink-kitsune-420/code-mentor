"""Isolated subprocess execution tracer using Python's sys.settrace."""

from __future__ import annotations

import ast
import io
import json
import sys
import types
from contextlib import redirect_stdout
from typing import Any

LESSON_FILENAME = "<lesson>"
MAX_STDOUT_CHARS = 4000
BLOCKED_MODULES = frozenset(
    {
        "os",
        "subprocess",
        "socket",
        "shutil",
        "pathlib",
        "sys",
        "ctypes",
        "importlib",
        "urllib",
        "http",
        "ftplib",
        "telnetlib",
        "multiprocessing",
        "threading",
        "pty",
    }
)


def _safe_import(name: str, globals_: Any = None, locals_: Any = None, fromlist: Any = (), level: int = 0) -> Any:
    root = name.split(".", 1)[0]
    if root in BLOCKED_MODULES:
        raise ImportError(f"Module '{root}' is disabled inside the Code Mentor sandbox.")
    return __import__(name, globals_, locals_, fromlist, level)


def _is_grid2d(value: Any) -> bool:
    if not isinstance(value, list) or not (1 <= len(value) <= 16):
        return False
    if not all(isinstance(row, list) for row in value):
        return False
    row_len = len(value[0])
    if not (1 <= row_len <= 16):
        return False
    for row in value:
        if len(row) != row_len:
            return False
        for cell in row:
            if not isinstance(cell, (int, float, str, bool)):
                return False
    return True


def _serialize_value(value: Any, depth: int = 0) -> dict[str, Any]:
    """Convert a Python runtime value into an immutable JSON-safe VariableSnapshot."""
    if value is None:
        return {"type": "NoneType", "shape": "none", "value": None, "repr": "None"}
    if isinstance(value, bool):
        return {"type": "bool", "shape": "bool", "value": value, "repr": repr(value)}
    if isinstance(value, (int, float)):
        return {"type": type(value).__name__, "shape": "number", "value": value, "repr": repr(value)}
    if isinstance(value, str):
        short = value if len(value) <= 120 else value[:117] + "..."
        return {"type": "str", "shape": "string", "value": short, "repr": repr(short)}
    if depth >= 3:
        return {"type": type(value).__name__, "shape": "other", "value": repr(value)[:120], "repr": repr(value)[:120]}
    if _is_grid2d(value):
        grid = [[cell for cell in row] for row in value]
        return {
            "type": "list[list]",
            "shape": "grid2d",
            "value": grid,
            "repr": repr(grid),
            "obj_id": id(value),
        }
    if isinstance(value, (list, tuple)):
        items = [_serialize_value(v, depth + 1)["value"] for v in value[:32]]
        out: dict[str, Any] = {
            "type": type(value).__name__,
            "shape": "list",
            "value": items,
            "repr": repr(value)[:160],
        }
        if isinstance(value, list):
            out["obj_id"] = id(value)
        return out
    if isinstance(value, dict):
        entries = {}
        for idx, (k, v) in enumerate(value.items()):
            if idx >= 24:
                break
            entries[str(k)] = _serialize_value(v, depth + 1)["value"]
        return {
            "type": "dict",
            "shape": "dict",
            "value": entries,
            "repr": repr(value)[:160],
            "obj_id": id(value),
        }
    if isinstance(value, set):
        items = [_serialize_value(v, depth + 1)["value"] for v in list(value)[:24]]
        return {
            "type": "set",
            "shape": "list",
            "value": items,
            "repr": repr(value)[:160],
            "obj_id": id(value),
        }
    if hasattr(value, "__dict__") and not isinstance(
        value, (type, types.ModuleType, types.FunctionType, types.BuiltinFunctionType)
    ):
        fields: dict[str, Any] = {}
        for idx, (k, v) in enumerate(vars(value).items()):
            if k.startswith("_") or idx >= 20:
                continue
            fields[str(k)] = _serialize_value(v, depth + 1)["value"]
        cls_name = type(value).__name__
        field_preview = ", ".join(f"{k}={v!r}" for k, v in list(fields.items())[:4])
        return {
            "type": cls_name,
            "shape": "object",
            "value": {"class_name": cls_name, "fields": fields},
            "repr": f"{cls_name}({field_preview})"[:160],
            "obj_id": id(value),
        }
    return {"type": type(value).__name__, "shape": "other", "value": repr(value)[:120], "repr": repr(value)[:120]}


def _capture_locals(frame: types.FrameType) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    obj_id_map: dict[int, int] = {}
    for name, val in frame.f_locals.items():
        if name.startswith("__"):
            continue
        if isinstance(val, (types.FunctionType, types.ModuleType, types.BuiltinFunctionType, type)):
            continue
        snap = _serialize_value(val)
        raw_oid = snap.get("obj_id")
        if isinstance(raw_oid, int):
            if raw_oid not in obj_id_map:
                obj_id_map[raw_oid] = len(obj_id_map) + 1
            snap["obj_id"] = obj_id_map[raw_oid]
        result[name] = snap
    return result


def _compute_changes(prev: dict[str, dict[str, Any]], curr: dict[str, dict[str, Any]]) -> dict[str, Any]:
    created = [k for k in curr if k not in prev]
    deleted = [k for k in prev if k not in curr]
    updated: dict[str, dict[str, Any]] = {}
    for k, after in curr.items():
        if k not in prev:
            continue
        before = prev[k]
        if before["repr"] != after["repr"] or before["value"] != after["value"]:
            delta: float | int | None = None
            if (
                before["shape"] == "number"
                and after["shape"] == "number"
                and isinstance(before["value"], (int, float))
                and isinstance(after["value"], (int, float))
            ):
                raw_delta = after["value"] - before["value"]
                delta = round(raw_delta, 6) if isinstance(raw_delta, float) else raw_delta
            updated[k] = {
                "before": before["repr"],
                "after": after["repr"],
                "delta": delta,
            }
    return {"created": created, "updated": updated, "deleted": deleted}


def _collect_lines(nodes: list[ast.stmt]) -> set[int]:
    lines: set[int] = set()
    for stmt in nodes:
        for child in ast.walk(stmt):
            ln = getattr(child, "lineno", None)
            if isinstance(ln, int):
                lines.add(ln)
    return lines


def _build_multiline_assign_map(tree: ast.AST) -> dict[int, int]:
    """Map continuation lines of multi-line assignments (e.g. 2D lists) to their start line."""
    line_map: dict[int, int] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            end_ln = getattr(node, "end_lineno", None)
            if isinstance(end_ln, int) and end_ln > node.lineno:
                for ln in range(node.lineno, end_ln + 1):
                    line_map[ln] = node.lineno
    return line_map


def _build_control_map(tree: ast.AST) -> dict[int, dict[str, Any]]:
    control_map: dict[int, dict[str, Any]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.If):
            control_map[node.lineno] = {
                "kind": "if",
                "test": ast.unparse(node.test),
                "body_lines": _collect_lines(node.body),
                "orelse_lines": _collect_lines(node.orelse),
            }
        elif isinstance(node, ast.While):
            control_map[node.lineno] = {
                "kind": "while",
                "test": ast.unparse(node.test),
                "body_lines": _collect_lines(node.body),
                "orelse_lines": _collect_lines(node.orelse),
            }
        elif isinstance(node, ast.For):
            control_map[node.lineno] = {
                "kind": "for",
                "target": ast.unparse(node.target),
                "iter": ast.unparse(node.iter),
                "body_lines": _collect_lines(node.body),
            }
    return control_map


def _build_call_stack(frame: types.FrameType) -> list[dict[str, Any]]:
    stack: list[dict[str, Any]] = []
    cur: types.FrameType | None = frame
    while cur is not None:
        if cur.f_code.co_filename == LESSON_FILENAME:
            stack.append({"function": cur.f_code.co_name, "line": cur.f_lineno})
        cur = cur.f_back
    stack.reverse()
    return stack


def _annotate_branches(frames: list[dict[str, Any]], control_map: dict[int, dict[str, Any]]) -> None:
    loop_counts: dict[tuple[int, int], int] = {}
    for idx in range(len(frames) - 1):
        curr = frames[idx]
        nxt = frames[idx + 1]
        info = control_map.get(curr["line"])
        if not info or curr["event"] != "line":
            continue
        if info["kind"] in ("if", "while"):
            if nxt["line"] in info["body_lines"]:
                curr["branch_info"] = f"Condition True: {info['test']} -> entering block"
            else:
                curr["branch_info"] = f"Condition False: {info['test']} -> skipping block"
        elif info["kind"] == "for":
            key = (curr["frame_id"], curr["line"])
            if nxt["line"] in info["body_lines"]:
                loop_counts[key] = loop_counts.get(key, 0) + 1
                curr["branch_info"] = f"Loop iteration #{loop_counts[key]} ({info['target']} in {info['iter']})"
            else:
                curr["branch_info"] = f"Loop finished ({info['iter']})"


def run_trace(code: str, max_steps: int) -> dict[str, Any]:
    """Compile and trace Python code deterministically."""
    try:
        tree = ast.parse(code, filename=LESSON_FILENAME)
        if not tree.body:
            return {"frames": [], "truncated": False, "error": None}
        compiled = compile(tree, LESSON_FILENAME, "exec")
    except SyntaxError as exc:
        return {
            "frames": [],
            "truncated": False,
            "error": f"SyntaxError on line {exc.lineno}: {exc.msg}",
        }

    control_map = _build_control_map(tree)
    assign_line_map = _build_multiline_assign_map(tree)
    frames: list[dict[str, Any]] = []
    prev_vars_by_frame: dict[int, dict[str, dict[str, Any]]] = {}
    stdout_buf = io.StringIO()
    truncated = False
    error_msg: str | None = None
    exception_raised = False
    last_line_seen = 1

    class StepLimitReached(Exception):
        pass

    def trace_fn(frame: types.FrameType, event: str, arg: Any) -> Any:
        nonlocal truncated, exception_raised, last_line_seen
        if frame.f_code.co_filename != LESSON_FILENAME:
            return None

        if event not in ("line", "call", "return", "exception"):
            return trace_fn

        func_name = frame.f_code.co_name
        # Skip noisy module-level entry call; we start cleanly at line 1.
        if event == "call" and func_name == "<module>":
            return trace_fn
        if event == "return" and func_name == "<module>" and exception_raised:
            return None

        if len(frames) >= max_steps:
            truncated = True
            raise StepLimitReached()

        fid = id(frame)
        raw_line_no = frame.f_lineno
        line_no = assign_line_map.get(raw_line_no, raw_line_no) if event == "line" else raw_line_no
        if event == "line":
            last_line_seen = line_no
            if (
                frames
                and frames[-1]["frame_id"] == fid
                and frames[-1]["event"] == "line"
                and frames[-1]["line"] == line_no
            ):
                return trace_fn
        elif event == "return" and func_name == "<module>":
            line_no = last_line_seen

        curr_vars = _capture_locals(frame)
        prev_vars = prev_vars_by_frame.get(fid, {})
        changes = _compute_changes(prev_vars, curr_vars)
        prev_vars_by_frame[fid] = curr_vars

        return_val = _serialize_value(arg)["repr"] if (event == "return" and func_name != "<module>") else None
        exc_text: str | None = None
        if event == "exception":
            exception_raised = True
            exc_type, exc_val, _ = arg
            exc_text = f"{exc_type.__name__}: {exc_val}"

        raw_stdout = stdout_buf.getvalue()
        if len(raw_stdout) > MAX_STDOUT_CHARS:
            capped_stdout = "... (earlier output truncated)\n" + raw_stdout[-MAX_STDOUT_CHARS:]
        else:
            capped_stdout = raw_stdout

        frames.append(
            {
                "step": len(frames),
                "frame_id": fid,
                "event": event,
                "line": line_no,
                "function": func_name,
                "call_stack": _build_call_stack(frame),
                "variables": curr_vars,
                "changes": changes,
                "return_value": return_val,
                "exception": exc_text,
                "stdout": capped_stdout,
                "branch_info": None,
            }
        )
        return trace_fn

    safe_builtins = dict(__builtins__) if isinstance(__builtins__, dict) else dict(vars(__builtins__))
    safe_builtins["__import__"] = _safe_import
    for forbidden in ("open", "exec", "eval", "compile", "input"):
        safe_builtins.pop(forbidden, None)

    exec_globals: dict[str, Any] = {"__builtins__": safe_builtins, "__name__": "__main__"}

    with redirect_stdout(stdout_buf):
        sys.settrace(trace_fn)
        try:
            exec(compiled, exec_globals, exec_globals)
        except StepLimitReached:
            error_msg = f"Stopped after {max_steps} steps (loop limit reached)."
        except Exception as exc:
            if not error_msg:
                error_msg = f"{type(exc).__name__}: {exc}"
        finally:
            sys.settrace(None)

    _annotate_branches(frames, control_map)
    for frame_data in frames:
        frame_data.pop("frame_id", None)

    return {
        "frames": frames,
        "truncated": truncated,
        "error": error_msg,
    }


def main() -> None:
    payload = json.loads(sys.stdin.read())
    result = run_trace(payload["code"], int(payload.get("max_steps", 500)))
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
