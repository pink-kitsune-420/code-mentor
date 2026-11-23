import { useEffect, useMemo, useState } from "react";
import { GitFork, Layers, MousePointerClick, Repeat } from "lucide-react";
import type { TraceFrame } from "../types/trace";
import { buildCallTree, type CallTreeNode } from "../utils/callTree";

interface FlowLoopsTabProps {
  frames: TraceFrame[];
  currentFrame: TraceFrame | null;
  selectedLine: number | null;
  codeLines: string[];
  onJumpToStep: (stepIdx: number) => void;
}

type FlowViewMode = "tree" | "stack" | "loops";

function TreeBranch({
  node,
  currentStep,
  onJumpToStep,
}: {
  node: CallTreeNode;
  currentStep: number;
  onJumpToStep: (stepIdx: number) => void;
}) {
  const isInSpan =
    currentStep >= node.callStep &&
    (node.returnStep === null || currentStep <= node.returnStep);
  const childActive = node.children.some(
    (c) =>
      currentStep >= c.callStep &&
      (c.returnStep === null || currentStep <= c.returnStep)
  );
  const isExactTop = isInSpan && !childActive;
  const isDone = node.returnStep !== null && currentStep > node.returnStep;

  return (
    <div className="tree-branch">
      <button
        className={`tree-node-btn ${isExactTop ? "active" : isInSpan ? "ancestor" : isDone ? "done" : ""}`}
        onClick={() => onJumpToStep(node.callStep)}
        title={`Jump to Step ${node.callStep + 1}`}
      >
        <span className="tree-fn-name">
          {node.functionName === "Main Program"
            ? "Main Program"
            : `${node.functionName}(${node.argsSummary})`}
        </span>
        <span className="tree-meta-right">
          {node.returnValue !== null && (
            <span className="tree-ret-pill">→ {node.returnValue}</span>
          )}
          <span className="tree-step-pill">S{node.callStep + 1}</span>
        </span>
      </button>

      {node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              currentStep={currentStep}
              onJumpToStep={onJumpToStep}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FlowLoopsTab({
  frames,
  currentFrame,
  selectedLine,
  codeLines,
  onJumpToStep,
}: FlowLoopsTabProps) {
  const callTree = useMemo(() => buildCallTree(frames), [frames]);
  const hasFunctionCalls = (callTree[0]?.children.length ?? 0) > 0;
  const [viewMode, setViewMode] = useState<FlowViewMode>(hasFunctionCalls ? "tree" : "stack");

  useEffect(() => {
    setViewMode(hasFunctionCalls ? "tree" : "stack");
  }, [hasFunctionCalls]);

  const inspectLine = selectedLine ?? currentFrame?.line ?? 1;
  const lineHits = frames.filter((f) => f.line === inspectLine).map((f) => f.step);
  const loopSteps = frames.filter((f) => f.branch_info && f.branch_info.startsWith("Loop"));
  const currentStep = currentFrame?.step ?? 0;

  return (
    <div className="tab-stack">
      <div className="flow-mode-pills">
        <button
          className={`jump-pill ${viewMode === "tree" ? "active" : ""}`}
          onClick={() => setViewMode("tree")}
        >
          <GitFork size={11} style={{ verticalAlign: "middle", marginRight: "4px" }} />
          Call Tree
        </button>
        <button
          className={`jump-pill ${viewMode === "stack" ? "active" : ""}`}
          onClick={() => setViewMode("stack")}
        >
          <Layers size={11} style={{ verticalAlign: "middle", marginRight: "4px" }} />
          Stack
        </button>
        <button
          className={`jump-pill ${viewMode === "loops" ? "active" : ""}`}
          onClick={() => setViewMode("loops")}
        >
          <Repeat size={11} style={{ verticalAlign: "middle", marginRight: "4px" }} />
          Loops &amp; Lines
        </button>
      </div>

      {viewMode === "tree" && (
        <section className="subcard">
          <div className="subcard-title">
            <GitFork size={14} />
            Live Call Tree (click any call to jump)
          </div>
          {callTree.length === 0 ? (
            <span className="muted-note">No trace loaded yet.</span>
          ) : (
            <div className="call-tree">
              {callTree.map((root) => (
                <TreeBranch
                  key={root.id}
                  node={root}
                  currentStep={currentStep}
                  onJumpToStep={onJumpToStep}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {viewMode === "stack" && (
        <section className="subcard">
          <div className="subcard-title">
            <Layers size={15} />
            Active Call Stack
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
                  <div
                    key={`${entry.function}-${idx}`}
                    className={`stack-item ${isTop ? "top" : ""}`}
                  >
                    <span>
                      {entry.function === "<module>" ? "Main Program" : `${entry.function}()`}
                    </span>
                    <span className="muted-note">Line {entry.line}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {viewMode === "loops" && (
        <>
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
        </>
      )}
    </div>
  );
}
