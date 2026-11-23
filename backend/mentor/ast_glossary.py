"""Deterministic Python AST glossary for zero-hallucination code hover tooltips."""

from __future__ import annotations

import ast

from pydantic import BaseModel


class GlossarySpan(BaseModel):
    """Source-anchored plain-English explanation for an AST construct."""

    start_line: int
    start_col: int
    end_line: int
    end_col: int
    kind: str
    title: str
    plain_english: str


_BINOP_LABELS: dict[type[ast.operator], tuple[str, str]] = {
    ast.Add: ("+ (Add / Combine)", "Adds two numbers together, or joins two strings/lists."),
    ast.Sub: ("- (Subtract)", "Subtracts the right number from the left number."),
    ast.Mult: ("* (Multiply)", "Multiplies two numbers together."),
    ast.Div: ("/ (Divide)", "Divides the left number by the right number (always returns a decimal)."),
}

_CMPOP_LABELS: dict[type[ast.cmpop], tuple[str, str]] = {
    ast.Eq: (
        "== (Is Equal To?)",
        "Checks if both sides have the same value (True or False). Double '=' checks equality; single '=' assigns.",
    ),
    ast.NotEq: ("!= (Not Equal?)", "Checks if the two values are different (True or False)."),
    ast.GtE: (">= (At Least)", "True if the left value is greater than or equal to the right value."),
    ast.LtE: ("<= (At Most)", "True if the left value is less than or equal to the right value."),
    ast.Gt: ("> (Greater Than)", "True if the left value is strictly bigger than the right value."),
    ast.Lt: ("< (Less Than)", "True if the left value is strictly smaller than the right value."),
}


def _span_for_node(node: ast.AST, kind: str, title: str, plain_english: str) -> GlossarySpan | None:
    lineno = getattr(node, "lineno", None)
    col = getattr(node, "col_offset", None)
    end_lineno = getattr(node, "end_lineno", None)
    end_col = getattr(node, "end_col_offset", None)
    if None in (lineno, col, end_lineno, end_col):
        return None
    return GlossarySpan(
        start_line=lineno,
        start_col=col,
        end_line=end_lineno,
        end_col=end_col,
        kind=kind,
        title=title,
        plain_english=plain_english,
    )


def build_ast_glossary(code: str) -> list[GlossarySpan]:
    """Parse Python code and return deterministic plain-English GlossarySpan items."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []

    spans: list[GlossarySpan] = []

    for node in ast.walk(tree):
        span: GlossarySpan | None = None
        if isinstance(node, ast.FunctionDef):
            args = ", ".join(arg.arg for arg in node.args.args) or "no inputs"
            span = GlossarySpan(
                start_line=node.lineno,
                start_col=node.col_offset,
                end_line=node.lineno,
                end_col=node.col_offset + 3,
                kind="function_def",
                title=f"def {node.name}({args})",
                plain_english=(
                    f"Defines a reusable action named '{node.name}' that takes ({args}). "
                    "Code inside only runs when called."
                ),
            )
        elif isinstance(node, ast.Return):
            span = _span_for_node(
                node,
                "return",
                "return (Send Result Back)",
                "Stops the current function immediately and hands this value back to whoever called it.",
            )
        elif isinstance(node, ast.For):
            target = ast.unparse(node.target)
            iter_src = ast.unparse(node.iter)
            span = GlossarySpan(
                start_line=node.lineno,
                start_col=node.col_offset,
                end_line=node.lineno,
                end_col=node.col_offset + 3,
                kind="for_loop",
                title=f"for {target} in {iter_src}",
                plain_english=(
                    f"Repeats the indented block once for every item inside '{iter_src}', "
                    f"naming the current item '{target}'."
                ),
            )
        elif isinstance(node, ast.If):
            test_src = ast.unparse(node.test)
            span = GlossarySpan(
                start_line=node.lineno,
                start_col=node.col_offset,
                end_line=node.lineno,
                end_col=node.col_offset + 2,
                kind="if_branch",
                title=f"if {test_src}",
                plain_english=f"Decision gate: only runs the indented block below if '{test_src}' is True.",
            )
        elif isinstance(node, ast.AugAssign):
            op_title, _ = _BINOP_LABELS.get(type(node.op), ("Update in place", "Updates variable."))
            target = ast.unparse(node.target)
            val = ast.unparse(node.value)
            span = _span_for_node(
                node,
                "aug_assign",
                f"In-place update ({op_title})",
                f"Shortcut for updating '{target}' using its existing value and '{val}'.",
            )
        elif isinstance(node, ast.Assign):
            targets = ", ".join(ast.unparse(t) for t in node.targets)
            span = _span_for_node(
                node,
                "assign",
                f"Assign '{targets}'",
                f"Stores or updates the value on the right inside the label '{targets}'.",
            )
        elif isinstance(node, ast.Subscript):
            value_src = ast.unparse(node.value)
            slice_src = ast.unparse(node.slice)
            span = _span_for_node(
                node,
                "subscript",
                f"Lookup {value_src}[{slice_src}]",
                f"Reaches inside '{value_src}' to grab the slot or key '{slice_src}'.",
            )
        elif isinstance(node, ast.Compare) and node.ops:
            op_title, op_desc = _CMPOP_LABELS.get(type(node.ops[0]), ("Compare", "Compares two values."))
            span = _span_for_node(node, "compare", op_title, op_desc)
        elif isinstance(node, ast.Call):
            func_src = ast.unparse(node.func)
            span = _span_for_node(
                node,
                "call",
                f"Call {func_src}(...)",
                f"Runs the '{func_src}' function right now with the inputs inside parentheses.",
            )
        elif isinstance(node, ast.Dict):
            span = _span_for_node(
                node,
                "dict",
                "Dictionary {key: value}",
                "A labeled container storing named fields (like a mini database record).",
            )
        elif isinstance(node, ast.List):
            span = _span_for_node(
                node,
                "list",
                "List [item0, item1, ...]",
                "An ordered sequence of items accessed by position starting at index 0.",
            )

        if span is not None:
            spans.append(span)

    spans.sort(key=lambda s: (s.start_line, s.start_col, (s.end_line - s.start_line), (s.end_col - s.start_col)))
    return spans
