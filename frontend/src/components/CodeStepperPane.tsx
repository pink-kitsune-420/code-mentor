import { useMemo } from "react";
import type { GlossarySpan, TraceFrame } from "../types/trace";
import { highlightPythonLine } from "../utils/pythonHighlight";
import { buildStepSubtitle } from "../utils/stepSubtitle";

interface CodeStepperPaneProps {
  code: string;
  currentFrame: TraceFrame | null;
  glossary: GlossarySpan[];
  selectedLine: number | null;
  isEditing: boolean;
  onSelectLine: (line: number) => void;
  onCodeChange: (nextCode: string) => void;
}

export function CodeStepperPane({
  code,
  currentFrame,
  glossary,
  selectedLine,
  isEditing,
  onSelectLine,
  onCodeChange,
}: CodeStepperPaneProps) {
  const lines = useMemo(() => code.split("\n"), [code]);
  const subtitle = useMemo(
    () => buildStepSubtitle(currentFrame, glossary),
    [currentFrame, glossary]
  );
  const isErrFrame = currentFrame?.event === "exception";

  if (isEditing) {
    return (
      <div className="code-pane-fill">
        <div className="editor-with-gutter">
          <div className="editor-gutter" aria-hidden="true">
            {lines.map((_, idx) => (
              <div key={idx + 1} className="editor-gutter-line">
                {idx + 1}
              </div>
            ))}
          </div>
          <textarea
            className="code-editor-lined"
            value={code}
            rows={Math.max(12, lines.length + 1)}
            spellCheck={false}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="code-pane-fill">
      <div className="code-body">
        {lines.map((lineText, idx) => {
          const lineNum = idx + 1;
          const isCurrent = currentFrame?.line === lineNum;
          const isSelected = selectedLine === lineNum && !isCurrent;
          const isErr = isCurrent && isErrFrame;

          return (
            <div
              key={lineNum}
              className={`code-line ${isCurrent ? "active" : "dimmed"} ${isSelected ? "selected-line" : ""} ${isErr ? "error-line" : ""}`}
              onClick={() => onSelectLine(lineNum)}
              title="Click to inspect this line in Flow & Loops or Glossary"
            >
              <span className="line-num">{lineNum}</span>
              <span className="line-content">{highlightPythonLine(lineText)}</span>
            </div>
          );
        })}
      </div>

      <div className={`step-story-bar ${isErrFrame ? "error" : ""}`}>
        <span className="step-story-badge">
          {currentFrame ? `Line ${currentFrame.line}` : "Ready"}
        </span>
        <span className="step-story-text">
          {subtitle ?? "Click Next or Play to step through each line."}
        </span>
      </div>
    </div>
  );
}
