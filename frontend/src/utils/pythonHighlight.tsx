import type { ReactNode } from "react";

const KEYWORDS = new Set([
  "def",
  "return",
  "for",
  "in",
  "if",
  "elif",
  "else",
  "while",
  "and",
  "or",
  "not",
  "True",
  "False",
  "None",
  "import",
  "from",
  "as",
  "pass",
  "break",
  "continue",
]);

const BUILTINS = new Set([
  "print",
  "range",
  "len",
  "max",
  "min",
  "sum",
  "abs",
  "int",
  "str",
  "float",
  "bool",
  "list",
  "dict",
  "enumerate",
]);

const TOKEN_RE =
  /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b|([=<>!+\-*/%:,\[\]{}()])/g;

export function highlightPythonLine(line: string): ReactNode {
  if (!line) return " ";

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of line.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      nodes.push(line.slice(lastIndex, idx));
    }

    const [full, comment, strLit, numLit, ident, punct] = match;
    if (comment) {
      nodes.push(
        <span key={key++} className="tok-comment">
          {full}
        </span>
      );
    } else if (strLit) {
      nodes.push(
        <span key={key++} className="tok-string">
          {full}
        </span>
      );
    } else if (numLit) {
      nodes.push(
        <span key={key++} className="tok-number">
          {full}
        </span>
      );
    } else if (ident) {
      const cls = KEYWORDS.has(ident)
        ? "tok-keyword"
        : BUILTINS.has(ident)
          ? "tok-builtin"
          : "tok-ident";
      nodes.push(
        <span key={key++} className={cls}>
          {full}
        </span>
      );
    } else if (punct) {
      nodes.push(
        <span key={key++} className="tok-punct">
          {full}
        </span>
      );
    }

    lastIndex = idx + full.length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}
