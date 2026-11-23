import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Gauge,
  History,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import type {
  CurriculumModule,
  CurriculumProgress,
  CurriculumResponse,
  DifficultyLevel,
  LessonPack,
  QuizQuestion,
  ReviewQueueResponse,
} from "../types/curriculum";
import { highlightPythonLine } from "../utils/pythonHighlight";
import { LessonStudioModal } from "./LessonStudioModal";
import { QuizCard } from "./QuizCard";
import { StepCountLab } from "./StepCountLab";

interface LearnModeViewProps {
  onOpenInStepper: (code: string) => void;
  onMasterySummaryChange?: (mastered: number, total: number) => void;
}

function difficultyClass(level: DifficultyLevel): string {
  return `diff-${level.toLowerCase()}`;
}

export function LearnModeView({
  onOpenInStepper,
  onMasterySummaryChange,
}: LearnModeViewProps) {
  const [placement, setPlacement] = useState<QuizQuestion[]>([]);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [progress, setProgress] = useState<CurriculumProgress>({ mastery: {}, quizzes: {} });
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>("placement");
  const [resetEpoch, setResetEpoch] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [studioOpen, setStudioOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CurriculumModule | null>(null);

  const refreshReview = useCallback(async () => {
    try {
      const resp = await fetch("/api/curriculum/review");
      if (resp.ok) {
        const data = (await resp.json()) as ReviewQueueResponse;
        setReviewQueue(data);
      }
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [currRes, revRes] = await Promise.all([
          fetch("/api/curriculum"),
          fetch("/api/curriculum/review"),
        ]);
        const data = (await currRes.json()) as CurriculumResponse;
        setPlacement(data.placement);
        setModules(data.modules);
        setProgress(data.progress);
        if (revRes.ok) {
          setReviewQueue((await revRes.json()) as ReviewQueueResponse);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const masteredCount = useMemo(
    () => modules.filter((m) => progress.mastery[m.id]?.status === "mastered").length,
    [modules, progress]
  );

  useEffect(() => {
    if (modules.length > 0) {
      onMasterySummaryChange?.(masteredCount, modules.length);
    }
  }, [masteredCount, modules.length, onMasterySummaryChange]);

  const placementPassed = placement.filter((q) => progress.quizzes[q.id]?.correct).length;
  const activeModule = modules.find((m) => m.id === selectedId) ?? null;

  const moduleById = useMemo(() => {
    const map = new Map<string, CurriculumModule>();
    modules.forEach((m) => map.set(m.id, m));
    return map;
  }, [modules]);

  const groupedTracks = useMemo(() => {
    const map = new Map<string, CurriculumModule[]>();
    for (const mod of modules) {
      const list = map.get(mod.track) ?? [];
      list.push(mod);
      map.set(mod.track, list);
    }
    return Array.from(map.entries());
  }, [modules]);

  const nextTopics = useMemo(() => {
    if (!activeModule) return [];
    return modules.filter((m) => m.prerequisites.includes(activeModule.id));
  }, [activeModule, modules]);

  async function handleReset() {
    const resp = await fetch("/api/curriculum/reset", { method: "POST" });
    const data = (await resp.json()) as { progress: CurriculumProgress };
    setProgress(data.progress);
    setResetEpoch((e) => e + 1);
    void refreshReview();
  }

  async function handleExportLesson(lessonId: string) {
    const resp = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/export`);
    if (!resp.ok) return;
    const pack = (await resp.json()) as LessonPack;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lessonId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteLesson(lessonId: string) {
    const resp = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}`, {
      method: "DELETE",
    });
    if (!resp.ok) return;
    const data = (await resp.json()) as {
      modules: CurriculumModule[];
      progress: CurriculumProgress;
    };
    setModules(data.modules);
    setProgress(data.progress);
    setSelectedId("placement");
    void refreshReview();
  }

  function handleProgressUpdate(nextProgress: CurriculumProgress) {
    setProgress(nextProgress);
    void refreshReview();
  }

  if (loading) {
    return <div className="learn-loading">Loading topic catalog...</div>;
  }

  return (
    <div className="learn-layout">
      <aside className="learn-rail">
        <div className="learn-rail-header">
          <div className="subcard-title">
            <Compass size={15} />
            Topic Catalog
          </div>
          <button
            className="icon-btn-sm primary"
            onClick={() => {
              setEditingModule(null);
              setStudioOpen(true);
            }}
          >
            <Plus size={12} />
            Create / Import
          </button>
        </div>

        <div className="learn-rail-list">
          <button
            className={`syllabus-item ${selectedId === "placement" ? "active" : ""}`}
            onClick={() => setSelectedId("placement")}
          >
            <div className="syllabus-item-top">
              <strong>Skill Check (Optional)</strong>
              <span className="syllabus-score">
                {placementPassed}/{placement.length}
              </span>
            </div>
            <span className="syllabus-sub">5 quick checks to spot what you already know</span>
          </button>

          <button
            className={`syllabus-item ${selectedId === "review" ? "active" : ""}`}
            onClick={() => {
              setSelectedId("review");
              void refreshReview();
            }}
          >
            <div className="syllabus-item-top">
              <strong style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <History size={13} />
                Daily Review
              </strong>
              {reviewQueue && reviewQueue.due_count > 0 ? (
                <span className="review-due-pill">{reviewQueue.due_count} missed</span>
              ) : (
                <span className="syllabus-score">Ready</span>
              )}
            </div>
            <span className="syllabus-sub">Weak spots first, then spaced refreshers</span>
          </button>

          <button
            className={`syllabus-item ${selectedId === "complexity_lab" ? "active" : ""}`}
            onClick={() => setSelectedId("complexity_lab")}
          >
            <div className="syllabus-item-top">
              <strong style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Gauge size={13} />
                Step-Count Lab
              </strong>
              <span className="syllabus-score">Big-O</span>
            </div>
            <span className="syllabus-sub">Compare algorithm speed visually</span>
          </button>

          {groupedTracks.map(([trackName, trackMods]) => (
            <div key={trackName} className="track-group">
              <div className="rail-divider">{trackName}</div>
              {trackMods.map((mod) => {
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
                        <CheckCircle2
                          size={15}
                          style={{ color: "var(--emerald)", flexShrink: 0 }}
                        />
                      ) : (
                        <span className="syllabus-score">
                          {doneCount}/{mod.quizzes.length}
                        </span>
                      )}
                    </div>
                    <span className="syllabus-sub">
                      {mod.difficulty} · {mod.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="learn-rail-footer">
          <span className="tag">
            {masteredCount}/{modules.length} Mastered
          </span>
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
                  <h2>5-Minute Visual Skill Check</h2>
                  <p className="muted-note">
                    Optional check to see which concepts already click—or jump straight into any
                    topic on the left.
                  </p>
                </div>
                <span className="placement-pill">
                  <Award size={15} />
                  Score: {placementPassed} / {placement.length}
                </span>
              </div>
              {placementPassed >= 4 && (
                <div className="placement-tip">
                  Strong intuition! Feel free to jump straight into{" "}
                  <button
                    className="jump-pill active"
                    onClick={() => setSelectedId("mod_3_functions")}
                  >
                    Functions &amp; Contracts
                  </button>{" "}
                  or explore Intermediate, Advanced, and Expert tracks on the left.
                </div>
              )}
            </div>

            <div className="quiz-list">
              {placement.map((q) => (
                <QuizCard
                  key={`${q.id}-${resetEpoch}`}
                  question={q}
                  savedState={progress.quizzes[q.id]}
                  onOpenInStepper={onOpenInStepper}
                  onProgressUpdate={handleProgressUpdate}
                />
              ))}
            </div>
          </div>
        ) : selectedId === "review" ? (
          <div className="learn-content">
            <div className="lesson-hero">
              <div className="lesson-hero-top">
                <div>
                  <h2>Daily 5-Minute Review Queue</h2>
                  <p className="muted-note">
                    Prioritizes quizzes you missed first, then your oldest passed checks, then fresh
                    unattempted topics.
                  </p>
                </div>
                {reviewQueue && (
                  <span className="placement-pill">
                    <History size={15} />
                    {reviewQueue.breakdown.missed} missed · {reviewQueue.breakdown.passed} passed
                  </span>
                )}
              </div>
            </div>

            <div className="quiz-list">
              {(reviewQueue?.items ?? []).map((item) => (
                <div key={`${item.quiz.id}-${resetEpoch}`} className="review-item-wrap">
                  <div className="review-item-meta">
                    <span className={`review-reason-pill reason-${item.reason}`}>
                      {item.reason === "missed"
                        ? "Weak Spot"
                        : item.reason === "review"
                          ? "Spaced Refresh"
                          : "Fresh Topic"}
                    </span>
                    <button
                      className="jump-pill"
                      onClick={() => {
                        if (item.module_id) setSelectedId(item.module_id);
                      }}
                    >
                      From: {item.module_title}
                    </button>
                  </div>
                  <QuizCard
                    question={item.quiz}
                    savedState={progress.quizzes[item.quiz.id]}
                    onOpenInStepper={onOpenInStepper}
                    onProgressUpdate={handleProgressUpdate}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : selectedId === "complexity_lab" ? (
          <StepCountLab onOpenInStepper={onOpenInStepper} />
        ) : activeModule ? (
          <div className="learn-content">
            <div className="lesson-hero">
              <div className="lesson-hero-top">
                <div>
                  <div className="topic-badges-row">
                    <span className={`difficulty-pill ${difficultyClass(activeModule.difficulty)}`}>
                      {activeModule.difficulty}
                    </span>
                    <span className="tag">{activeModule.track}</span>
                    {activeModule.source === "custom" && <span className="tag">Custom</span>}
                    {activeModule.source === "pack" && <span className="tag">Pack</span>}
                  </div>
                  <h2>{activeModule.title}</h2>
                  <p className="muted-note">{activeModule.subtitle}</p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  <button
                    className="icon-btn"
                    onClick={() => void handleExportLesson(activeModule.id)}
                    title="Download as shareable Lesson Pack JSON"
                  >
                    Export JSON
                  </button>
                  {activeModule.source === "custom" && (
                    <>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditingModule(activeModule);
                          setStudioOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => void handleDeleteLesson(activeModule.id)}
                        title="Delete custom lesson"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <button
                    className="icon-btn primary"
                    onClick={() => onOpenInStepper(activeModule.example_code)}
                  >
                    <Play size={14} />
                    Step Through Example
                  </button>
                </div>
              </div>

              {(activeModule.prerequisites.length > 0 || nextTopics.length > 0) && (
                <div className="lesson-links-row">
                  {activeModule.prerequisites.length > 0 && (
                    <div className="lesson-link-group">
                      <span className="muted-note">Builds on:</span>
                      {activeModule.prerequisites.map((preId) => {
                        const pre = moduleById.get(preId);
                        if (!pre) return null;
                        return (
                          <button
                            key={preId}
                            className="jump-pill"
                            onClick={() => setSelectedId(preId)}
                          >
                            {pre.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {nextTopics.length > 0 && (
                    <div className="lesson-link-group">
                      <span className="muted-note">Leads to:</span>
                      {nextTopics.map((nxt) => (
                        <button
                          key={nxt.id}
                          className="jump-pill"
                          onClick={() => setSelectedId(nxt.id)}
                        >
                          {nxt.title}{" "}
                          <ArrowRight size={11} style={{ verticalAlign: "middle" }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  Interactive Example
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
                  key={`${q.id}-${resetEpoch}`}
                  question={q}
                  savedState={progress.quizzes[q.id]}
                  onOpenInStepper={onOpenInStepper}
                  onProgressUpdate={handleProgressUpdate}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <LessonStudioModal
        isOpen={studioOpen}
        existingModules={modules}
        editingModule={editingModule}
        onClose={() => setStudioOpen(false)}
        onSaved={(savedMod, allMods, nextProgress) => {
          setModules(allMods);
          setProgress(nextProgress);
          setSelectedId(savedMod.id);
          void refreshReview();
        }}
      />
    </div>
  );
}
