import { Layers, MousePointerClick, Repeat } from "lucide-react";
import type { TraceFrame } from "../types/trace";

interface FlowLoopsTabProps {
  frames: TraceFrame[];
  currentFrame: TraceFrame | null;
  selectedLine: number | null;
  codeLines: string[];
  onJumpToStep: (stepIdx: number) => void;
}

export function FlowLoopsTab({
  frames,
  currentFrame,
  selectedLine,
  codeLines,
  onJumpToStep,
}: FlowLoopsTabProps) {
  const inspectLine = selectedLine ?? currentFrame?.line ?? 1;
  const lineHits = frames.filter((f) => f.line === inspectLine).map((f) => f.step);
  const loopSteps = frames.filter((f) => f.branch_info && f.branch_info.startsWith("Loop"));

  return (
    <div className="tab-stack">
      <section className="subcard">
        <div className="subcard-title">
          <Layers size={15} />
          Call Stack
          {currentFrame?.return_value && (
            <span className="badge-new">Return: {currentFrame.return_value}</span>
          )}
        </div>
        <div className="stack-frames-clean">
          {!currentFrame || currentFrame.call_stack.length === 0 ? (
            <span className="muted-note">Stack idle</span>
          ) : (
            currentFrame.call_stack.map((entry, idx) => {
              const isTop = idx === currentFrame.call_stack.length - 1;
              return (
                <div key={`${entry.function}-${idx}`} className={`stack-item ${isTop ? "top" : ""}`}>
                  <span>{entry.function === "<module>" ? "Main Program" : `${entry.function}()`}</span>
                  <span className="muted-note">Line {entry.line}</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {loopSteps.length > 0 && (
        <section className="subcard">
          <div className="subcard-title">
            <Repeat size={15} />
            Loop Iterations ({loopSteps.length})
          </div>
          <div className="loop-timeline">
            {loopSteps.map((f) => (
              <button
                key={f.step}
                className={`loop-row ${currentFrame?.step === f.step ? "active" : ""}`}
                onClick={() => onJumpToStep(f.step)}
              >
                <span className="loop-step-tag">Step {f.step + 1}</span>
                <span className="loop-line-tag">L{f.line}</span>
                <span className="loop-msg">{f.branch_info}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="subcard">
        <div className="subcard-title">
          <MousePointerClick size={15} />
          Line {inspectLine} Runs ({lineHits.length}×)
        </div>
        <div className="subcard-code-preview">
          <code>{(codeLines[inspectLine - 1] ?? "").trim() || "(blank line)"}</code>
        </div>
        {lineHits.length === 0 ? (
          <p className="muted-note">Line {inspectLine} did not run in this trace.</p>
        ) : (
          <div className="jump-pill-row">
            {lineHits.map((stepIdx, idx) => (
              <button
                key={stepIdx}
                className={`jump-pill ${currentFrame?.step === stepIdx ? "active" : ""}`}
                onClick={() => onJumpToStep(stepIdx)}
              >
                #{idx + 1} (Step {stepIdx + 1})
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
