import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, CheckCircle2, Compass, Play, RotateCcw } from "lucide-react";
import type {
  CurriculumModule,
  CurriculumProgress,
  CurriculumResponse,
  QuizQuestion,
} from "../types/curriculum";
import { highlightPythonLine } from "../utils/pythonHighlight";
import { QuizCard } from "./QuizCard";

interface LearnModeViewProps {
  onOpenInStepper: (code: string) => void;
  onMasterySummaryChange?: (mastered: number, total: number) => void;
}

export function LearnModeView({
  onOpenInStepper,
  onMasterySummaryChange,
}: LearnModeViewProps) {
  const [placement, setPlacement] = useState<QuizQuestion[]>([]);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [progress, setProgress] = useState<CurriculumProgress>({ mastery: {}, quizzes: {} });
  const [selectedId, setSelectedId] = useState<string>("placement");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch("/api/curriculum");
        const data = (await resp.json()) as CurriculumResponse;
        setPlacement(data.placement);
        setModules(data.modules);
        setProgress(data.progress);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const masteredCount = useMemo(
    () =>
      modules.filter((m) => progress.mastery[m.id]?.status === "mastered").length,
    [modules, progress]
  );

  useEffect(() => {
    if (modules.length > 0) {
      onMasterySummaryChange?.(masteredCount, modules.length);
    }
  }, [masteredCount, modules.length, onMasterySummaryChange]);

  const placementPassed = placement.filter((q) => progress.quizzes[q.id]?.correct).length;
  const activeModule = modules.find((m) => m.id === selectedId) ?? null;

  async function handleReset() {
    const resp = await fetch("/api/curriculum/reset", { method: "POST" });
    const data = (await resp.json()) as { progress: CurriculumProgress };
    setProgress(data.progress);
  }

  if (loading) {
    return <div className="learn-loading">Loading starter syllabus...</div>;
  }

  return (
    <div className="learn-layout">
      <aside className="learn-rail">
        <div className="learn-rail-header">
          <div className="subcard-title">
            <Compass size={15} />
            Scaffolded Syllabus
          </div>
          <span className="tag">
            {masteredCount}/{modules.length} Mastered
          </span>
        </div>

        <div className="learn-rail-list">
          <button
            className={`syllabus-item ${selectedId === "placement" ? "active" : ""}`}
            onClick={() => setSelectedId("placement")}
          >
            <div className="syllabus-item-top">
              <strong>Tier 0: Placement Check</strong>
              <span className="syllabus-score">
                {placementPassed}/{placement.length}
              </span>
            </div>
            <span className="syllabus-sub">5 quick checks to spot what you already know</span>
          </button>

          <div className="rail-divider">Tier 1 — Python Foundations</div>

          {modules.map((mod) => {
            const st = progress.mastery[mod.id]?.status ?? "not_started";
            const doneCount = mod.quizzes.filter((q) => progress.quizzes[q.id]?.correct).length;
            return (
              <button
                key={mod.id}
                className={`syllabus-item ${selectedId === mod.id ? "active" : ""}`}
                onClick={() => setSelectedId(mod.id)}
              >
                <div className="syllabus-item-top">
                  <strong>{mod.title}</strong>
                  {st === "mastered" ? (
                    <CheckCircle2 size={15} style={{ color: "var(--emerald)", flexShrink: 0 }} />
                  ) : (
                    <span className="syllabus-score">
                      {doneCount}/{mod.quizzes.length}
                    </span>
                  )}
                </div>
                <span className="syllabus-sub">{mod.subtitle}</span>
              </button>
            );
          })}
        </div>

        <div className="learn-rail-footer">
          <button className="icon-btn" onClick={() => void handleReset()}>
            <RotateCcw size={13} />
            Reset Progress
          </button>
        </div>
      </aside>

      <section className="learn-stage">
        {selectedId === "placement" ? (
          <div className="learn-content">
            <div className="lesson-hero">
              <div className="lesson-hero-top">
                <div>
                  <h2>Tier 0: 5-Minute Visual Placement Check</h2>
                  <p className="muted-note">
                    Answer these 5 zero-typing checks to see which concepts already click and where to start.
                  </p>
                </div>
                <span className="placement-pill">
                  <Award size={15} />
                  Score: {placementPassed} / {placement.length}
                </span>
              </div>
              {placementPassed >= 4 && modules[0] && (
                <div className="placement-tip">
                  Strong intuition! Feel free to start straight at{" "}
                  <button className="jump-pill active" onClick={() => setSelectedId("mod_3_functions")}>
                    Module 3: Functions
                  </button>{" "}
                  or review any module below.
                </div>
              )}
            </div>

            <div className="quiz-list">
              {placement.map((q) => (
                <QuizCard
                  key={q.id}
                  question={q}
                  savedState={progress.quizzes[q.id]}
                  onOpenInStepper={onOpenInStepper}
                  onProgressUpdate={setProgress}
                />
              ))}
            </div>
          </div>
        ) : activeModule ? (
          <div className="learn-content">
            <div className="lesson-hero">
              <div className="lesson-hero-top">
                <div>
                  <h2>{activeModule.title}</h2>
                  <p className="muted-note">{activeModule.subtitle}</p>
                </div>
                <button
                  className="icon-btn primary"
                  onClick={() => onOpenInStepper(activeModule.example_code)}
                >
                  <Play size={14} />
                  Step Through Example
                </button>
              </div>

              <div className="concept-row">
                {activeModule.concepts.map((c) => (
                  <span key={c} className="concept-chip">
                    {c}
                  </span>
                ))}
              </div>

              <ul className="lesson-bullets">
                {activeModule.lesson_points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>

              <div className="lesson-example-card">
                <div className="subcard-title" style={{ marginBottom: "6px" }}>
                  <BookOpen size={14} />
                  Interactive Toy Example
                </div>
                <div className="quiz-code-box">
                  {activeModule.example_code
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
            </div>

            <div className="quiz-list">
              {activeModule.quizzes.map((q) => (
                <QuizCard
                  key={q.id}
                  question={q}
                  savedState={progress.quizzes[q.id]}
                  onOpenInStepper={onOpenInStepper}
                  onProgressUpdate={setProgress}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
