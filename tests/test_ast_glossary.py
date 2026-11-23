"""Unit tests for the deterministic Python AST glossary."""

from mentor.ast_glossary import build_ast_glossary


def test_glossary_identifies_core_constructs() -> None:
    code = '''def check(ship):
    for item in [1, 2]:
        if ship["fuel"] >= 10:
            return item
'''
    spans = build_ast_glossary(code)
    kinds = {s.kind for s in spans}
    assert "function_def" in kinds
    assert "for_loop" in kinds
    assert "if_branch" in kinds
    assert "subscript" in kinds
    assert "compare" in kinds
    assert "return" in kinds
    assert "list" in kinds


def test_glossary_returns_empty_on_syntax_error() -> None:
    assert build_ast_glossary("def broken(:") == []
