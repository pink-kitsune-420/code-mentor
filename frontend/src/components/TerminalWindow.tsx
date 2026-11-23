import type { TraceFrame } from "../types/trace";

interface TerminalWindowProps {
  frame: TraceFrame | null;
  traceError: string | null;
  hasPrintedThisStep: boolean;
  isAtEnd: boolean;
}

export function TerminalWindow({
  frame,
  traceError,
  hasPrintedThisStep,
  isAtEnd,
}: TerminalWindowProps) {
  const output = frame?.stdout ?? "";
  const errText = frame?.exception ?? traceError;

  return (
    <div className={`terminal-screen ${hasPrintedThisStep ? "terminal-flash" : ""}`}>
      <div className="terminal-prompt-line">
        <span className="term-user">mentor</span>
        <span className="term-sep">:</span>
        <span className="term-path">~/lesson</span>
        <span className="term-sep">$</span>{" "}
        <span className="term-cmd">python3 main.py</span>
        {isAtEnd && !errText && <span className="term-done">finished</span>}
      </div>

      <div className="terminal-output-area">
        {output ? (
          <pre className="terminal-stdout">{output}</pre>
        ) : (
          <div className="terminal-placeholder">
            (Waiting for print() output...)
          </div>
        )}

        {errText && <pre className="terminal-stderr">{errText}</pre>}
      </div>
    </div>
  );
}
