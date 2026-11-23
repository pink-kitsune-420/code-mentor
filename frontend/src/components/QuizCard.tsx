import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Play, XCircle } from "lucide-react";
import type { CurriculumProgress, QuizAnswerResponse, QuizQuestion } from "../types/curriculum";
import { highlightPythonLine } from "../utils/pythonHighlight";

interface QuizCardProps {
  question: QuizQuestion;
  savedState?: { correct: boolean; score: number };
  onOpenInStepper: (code: string) => void;
  onProgressUpdate: (progress: CurriculumProgress) => void;
}

export function QuizCard({
  question,
  savedState,
  onOpenInStepper,
  onProgressUpdate,
}: QuizCardProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [blockOrder, setBlockOrder] = useState<number[]>(() =>
    question.blocks.map((_, i) => i)
  );
  const [explainText, setExplainText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizAnswerResponse | null>(null);

  const codeLines = useMemo(() => question.code.trimEnd().split("\n"), [question.code]);

  function moveBlock(pos: number, dir: -1 | 1) {
    const target = pos + dir;
    if (target < 0 || target >= blockOrder.length) return;
    setBlockOrder((prev) => {
      const copy = [...prev];
      const temp = copy[pos];
      copy[pos] = copy[target];
      copy[target] = temp;
      return copy;
    });
  }

  async function submitAnswer(overrideIndex?: number) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resp = await fetch("/api/curriculum/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: question.id,
          selected_index: overrideIndex ?? selectedIdx,
          selected_line: selectedLine,
          ordered_indices: question.kind === "reorder" ? blockOrder : null,
          explanation_text: question.kind === "explain" ? explainText : null,
        }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as QuizAnswerResponse;
      setResult(data);
      onProgressUpdate(data.progress);
    } catch (err) {
      setSubmitError(`Could not check answer: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isPassed = result ? result.correct : savedState?.correct;

  return (
    <div className={`quiz-card ${isPassed ? "passed" : ""}`}>
      <div className="quiz-card-head">
        <div className="quiz-title-row">
          <span className="quiz-kind-pill">{question.kind.replace("_", " ")}</span>
          <strong>{question.title}</strong>
          {isPassed && (
            <span className="quiz-passed-pill">
              <CheckCircle2 size={13} />
              Passed
            </span>
          )}
        </div>
        {question.code.trim() && (
          <button
            className="icon-btn-sm"
            onClick={() => onOpenInStepper(question.code)}
            title="Watch this exact snippet run line-by-line in Stepper Mode"
          >
            <Play size={12} />
            Open in Stepper
          </button>
        )}
      </div>

      <p className="quiz-prompt">{question.prompt}</p>

      {question.code.trim() && (
        <div className="quiz-code-box">
          {codeLines.map((lineText, idx) => {
            const lineNum = idx + 1;
            const clickable = question.kind === "spot_bug";
            const isPicked = clickable && selectedLine === lineNum;
            const isBugReveal =
              clickable && result && !result.correct && question.correct_line === lineNum;
            return (
              <div
                key={lineNum}
                className={`quiz-code-line ${clickable ? "clickable" : ""} ${isPicked ? "picked" : ""} ${isBugReveal ? "bug-reveal" : ""}`}
                onClick={() => {
                  if (clickable) setSelectedLine(lineNum);
                }}
              >
                <span className="line-num">{lineNum}</span>
                <span className="line-content">{highlightPythonLine(lineText)}</span>
              </div>
            );
          })}
        </div>
      )}

      {question.kind === "predict" && (
        <div className="quiz-options-grid">
          {question.options.map((opt, idx) => (
            <button
              key={opt}
              className={`quiz-opt-btn ${selectedIdx === idx ? "selected" : ""}`}
              disabled={submitting}
              onClick={() => {
                setSelectedIdx(idx);
                void submitAnswer(idx);
              }}
            >
              <code>{opt}</code>
            </button>
          ))}
        </div>
      )}

      {question.kind === "spot_bug" && (
        <div className="quiz-actions-row">
          <span className="muted-note">
            {selectedLine ? `Selected Line ${selectedLine}` : "Click the buggy line above."}
          </span>
          <button
            className="icon-btn primary"
            disabled={selectedLine === null || submitting}
            onClick={() => void submitAnswer()}
          >
            {submitting ? "Checking..." : "Flag Buggy Line"}
          </button>
        </div>
      )}

      {question.kind === "reorder" && (
        <div className="reorder-stack">
          {blockOrder.map((blockIdx, pos) => (
            <div key={blockIdx} className="reorder-row">
              <div className="reorder-arrows">
                <button
                  className="icon-btn-ghost"
                  disabled={pos === 0}
                  onClick={() => moveBlock(pos, -1)}
                  aria-label="Move block up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-btn-ghost"
                  disabled={pos === blockOrder.length - 1}
                  onClick={() => moveBlock(pos, 1)}
                  aria-label="Move block down"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <code className="reorder-code">{highlightPythonLine(question.blocks[blockIdx])}</code>
            </div>
          ))}
          <div className="quiz-actions-row">
            <span className="muted-note">Use arrows to put lines in execution order.</span>
            <button
              className="icon-btn primary"
              disabled={submitting}
              onClick={() => void submitAnswer()}
            >
              {submitting ? "Checking..." : "Check Order"}
            </button>
          </div>
        </div>
      )}

      {question.kind === "explain" && (
        <div className="explain-stack">
          <textarea
            className="explain-textarea"
            rows={2}
            value={explainText}
            onChange={(e) => setExplainText(e.target.value)}
            placeholder="Write 1–2 plain-English sentences..."
          />
          <div className="quiz-actions-row">
            <span className="muted-note">No code typing needed—just explain the idea.</span>
            <button
              className="icon-btn primary"
              disabled={explainText.trim().length < 3 || submitting}
              onClick={() => void submitAnswer()}
            >
              {submitting ? "Checking..." : "Check Mental Model"}
            </button>
          </div>
        </div>
      )}

      {submitError && (
        <div className="quiz-feedback warn">
          <strong>Submission Error:</strong> {submitError}
        </div>
      )}

      {result && (
        <div className={`quiz-feedback ${result.correct ? "ok" : "warn"}`}>
          <div className="quiz-feedback-head">
            {result.correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            <strong>{result.correct ? "Correct!" : "Not quite — try adjusting or inspect in Stepper"}</strong>
          </div>
          <p style={{ margin: 0 }}>{result.feedback}</p>
          {result.ai_graded && (
            <div className="ai-inline-warning">
              <AlertTriangle size={12} className="disclaimer-icon" />
              <span>Graded by AI—compare with the sample concept and your own understanding.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
