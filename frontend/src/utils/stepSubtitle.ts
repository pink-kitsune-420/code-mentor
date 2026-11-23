import type { GlossarySpan, TraceFrame } from "../types/trace";

export function buildStepSubtitle(
  frame: TraceFrame | null,
  glossary: GlossarySpan[]
): string | null {
  if (!frame) return null;

  if (frame.exception) {
    return `Stopped with error: ${frame.exception}`;
  }

  if (frame.event === "call" && frame.function !== "<module>") {
    const args = Object.entries(frame.variables)
      .map(([k, v]) => `${k}=${v.repr}`)
      .join(", ");
    return `Entering ${frame.function}(${args})`;
  }

  if (frame.event === "return" && frame.function !== "<module>") {
    return `Returning ${frame.return_value ?? "None"} back to caller`;
  }

  if (frame.branch_info) {
    return frame.branch_info;
  }

  const created = frame.changes.created;
  const updated = Object.entries(frame.changes.updated);
  if (created.length > 0 || updated.length > 0) {
    const parts: string[] = [];
    for (const name of created.slice(0, 2)) {
      const snap = frame.variables[name];
      if (snap) parts.push(`Created ${name} = ${snap.repr}`);
    }
    for (const [name, diff] of updated.slice(0, 2)) {
      parts.push(`Updated ${name}: ${diff.before} -> ${diff.after}`);
    }
    return parts.join(" · ");
  }

  const lineSpan = glossary.find((g) => g.start_line === frame.line);
  if (lineSpan) {
    return lineSpan.plain_english;
  }

  if (frame.event === "return" && frame.function === "<module>") {
    return "Program finished executing.";
  }

  return null;
}
