import { useEffect, useState } from "react";
import { Gauge, Play } from "lucide-react";
import type { ComplexityPairMeta, ComplexityRunResponse } from "../types/curriculum";
import { highlightPythonLine } from "../utils/pythonHighlight";

interface StepCountLabProps {
  onOpenInStepper: (code: string) => void;
}

export function StepCountLab({ onOpenInStepper }: StepCountLabProps) {
  const [pairs, setPairs] = useState<ComplexityPairMeta[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string>("");
  const [inputN, setInputN] = useState<number>(32);
  const [runResult, setRunResult] = useState<ComplexityRunResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadPresets() {
      const resp = await fetch("/api/complexity-lab/presets");
      const list = (await resp.json()) as ComplexityPairMeta[];
      setPairs(list);
      if (list.length > 0) {
        setSelectedPairId(list[0].id);
        setInputN(list[0].default_n);
      }
    }
    void loadPresets();
  }, []);

  const activePair = pairs.find((p) => p.id === selectedPairId) ?? null;

  useEffect(() => {
    if (!selectedPairId) return;
    let cancelled = false;
    async function execute() {
      setLoading(true);
      try {
        const resp = await fetch("/api/complexity-lab/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pair_id: selectedPairId, n: inputN }),
        });
        const data = (await resp.json()) as ComplexityRunResponse;
        if (!cancelled) setRunResult(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void execute();
    return () => {
      cancelled = true;
    };
  }, [selectedPairId, inputN]);

  const maxSteps = runResult
    ? Math.max(1, runResult.left.steps, runResult.right.steps)
    : 1;

  const speedup =
    runResult && runResult.right.steps > 0
      ? (runResult.left.steps / runResult.right.steps).toFixed(1)
      : null;

  return (
    <div className="learn-content">
      <div className="lesson-hero">
        <div className="lesson-hero-top">
          <div>
            <div className="topic-badges-row">
              <span className="difficulty-pill diff-intermediate">Interactive Lab</span>
              <span className="tag">Complexity Intuition</span>
            </div>
            <h2>Step-Count Complexity Lab</h2>
            <p className="muted-note">
              See Big-O scaling in real execution steps—no math formulas required. Slide input size{" "}
              <strong>N</strong> and watch how two approaches grow.
            </p>
          </div>
          {speedup && (
            <span className="placement-pill">
              <Gauge size={15} />
              {speedup}× fewer steps
            </span>
          )}
        </div>

        <div className="quick-prompts">
          {pairs.map((p) => (
            <button
              key={p.id}
              className={`jump-pill ${p.id === selectedPairId ? "active" : ""}`}
              onClick={() => {
                setSelectedPairId(p.id);
                setInputN(p.default_n);
              }}
            >
              {p.title}
            </button>
          ))}
        </div>

        {activePair && (
          <div className="lab-slider-bar">
            <div className="lab-slider-label">
              <span>
                Input Size <strong>N = {inputN}</strong>
              </span>
              <span className="muted-note">{activePair.subtitle}</span>
            </div>
            <input
              type="range"
              className="scrubber"
              min={activePair.min_n}
              max={activePair.max_n}
              step={activePair.step_n}
              value={inputN}
              onChange={(e) => setInputN(Number(e.target.value))}
            />
          </div>
        )}

        {activePair && (
          <div className="gentle-intro">
            <strong>Takeaway:</strong> {activePair.takeaway}
          </div>
        )}
      </div>

      {runResult && (
        <div className="lab-compare-grid">
          {(["left", "right"] as const).map((sideKey) => {
            const side = runResult[sideKey];
            const pct = Math.max(4, Math.round((side.steps / maxSteps) * 100));
            return (
              <div key={sideKey} className={`lab-card ${sideKey}`}>
                <div className="lab-card-head">
                  <div>
                    <span className={`quiz-kind-pill ${sideKey === "right" ? "fast" : ""}`}>
                      {side.big_o}
                    </span>
                    <strong style={{ marginLeft: "8px" }}>{side.label}</strong>
                  </div>
                  <button
                    className="icon-btn-sm"
                    onClick={() => onOpenInStepper(side.code)}
                  >
                    <Play size={12} />
                    Open in Stepper
                  </button>
                </div>

                <p className="muted-note">{side.description}</p>

                <div className="lab-metric-row">
                  <span className="lab-steps-num">
                    {loading ? "..." : `${side.steps} steps`}
                    {side.truncated ? " (capped)" : ""}
                  </span>
                </div>
                <div className="lab-bar-track">
                  <div
                    className={`lab-bar-fill ${sideKey}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="quiz-code-box">
                  {side.code
                    .trimEnd()
                    .split("\n")
                    .map((ln, i) => (
                      <div key={i + 1} className="quiz-code-line">
                        <span className="line-num">{i + 1}</span>
                        <span className="line-content">{highlightPythonLine(ln)}</span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
