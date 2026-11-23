import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  FlaskConical,
  Plus,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type {
  CurriculumModule,
  CurriculumProgress,
  DifficultyLevel,
  LessonVerificationResult,
  QuizKind,
  QuizQuestion,
} from "../types/curriculum";
import type { TraceResponse } from "../types/trace";
import { highlightPythonLine } from "../utils/pythonHighlight";

interface LessonStudioModalProps {
  isOpen: boolean;
  existingModules: CurriculumModule[];
  editingModule: CurriculumModule | null;
  onClose: () => void;
  onSaved: (
    savedModule: CurriculumModule,
    allModules: CurriculumModule[],
    progress: CurriculumProgress
  ) => void;
}

function makeEmptyQuiz(kind: QuizKind, index: number): QuizQuestion {
  const base = {
    id: `draft_q${index}_${Date.now()}`,
    kind,
    title:
      kind === "predict"
        ? "Predict the Output"
        : kind === "spot_bug"
          ? "Spot the Bug"
          : kind === "reorder"
            ? "Order the Logic"
            : "Explain in Plain English",
    prompt:
      kind === "predict"
        ? "What does this snippet print?"
        : kind === "spot_bug"
          ? "Click the line containing the bug."
          : kind === "reorder"
            ? "Arrange these blocks in the right order."
            : "Explain what this code does in 1–2 plain sentences.",
    code: "x = 10\nprint(x + 5)\n",
    options: kind === "predict" ? ["10", "15", "5", "Error"] : [],
    blocks: kind === "reorder" ? ["x = 10", "x += 5", "print(x)"] : [],
    correct_index: kind === "predict" ? 1 : null,
    correct_line: kind === "spot_bug" ? 1 : null,
    correct_order: kind === "reorder" ? [0, 1, 2] : [],
    rubric_keywords: kind === "explain" ? ["value", "variable", "print"] : [],
    sample_explanation: kind === "explain" ? "It stores 10 in x and prints 15." : "",
    explanation: "Review how each line executes step-by-step.",
  };
  return base;
}

function makeEmptyModule(): CurriculumModule {
  return {
    id: "",
    track: "Custom Lessons",
    difficulty: "Beginner",
    source: "custom",
    tier: 1,
    order: 99,
    title: "",
    subtitle: "",
    prerequisites: [],
    concepts: [],
    lesson_points: ["Explain the core idea in one clear sentence."],
    example_code: "score = 10\nscore += 5\nprint(\"Score:\", score)\n",
    quizzes: [makeEmptyQuiz("predict", 1)],
  };
}

export function LessonStudioModal({
  isOpen,
  existingModules,
  editingModule,
  onClose,
  onSaved,
}: LessonStudioModalProps) {
  const [studioTab, setStudioTab] = useState<"author" | "import">("author");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [seedCode, setSeedCode] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [draft, setDraft] = useState<CurriculumModule>(makeEmptyModule);
  const [pointsText, setPointsText] = useState("");
  const [conceptsText, setConceptsText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [verification, setVerification] = useState<LessonVerificationResult | null>(null);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStudioTab("author");
    setVerification(null);
    setStatusMsg(null);
    setImportError(null);
    setImportJson("");
    const base = editingModule ? structuredClone(editingModule) : makeEmptyModule();
    setDraft(base);
    setPointsText(base.lesson_points.join("\n"));
    setConceptsText(base.concepts.join(", "));
  }, [isOpen, editingModule]);

  if (!isOpen) return null;

  function buildPayload(): CurriculumModule {
    return {
      ...draft,
      lesson_points: pointsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      concepts: conceptsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  async function handleGenerateAi() {
    if (!topicPrompt.trim()) return;
    setGenerating(true);
    setStatusMsg(null);
    setVerification(null);
    try {
      const resp = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicPrompt.trim(),
          difficulty: draft.difficulty,
          track: draft.track || "Custom Lessons",
          prerequisites: draft.prerequisites,
          seed_code: showSeed && seedCode.trim() ? seedCode : null,
        }),
      });
      const data = (await resp.json()) as {
        ok: boolean;
        module?: CurriculumModule;
        verification?: LessonVerificationResult;
        repaired?: boolean;
        error?: string;
      };
      if (!data.ok || !data.module) {
        setStatusMsg(data.error ?? "AI generation failed.");
        return;
      }
      setDraft(data.module);
      setPointsText(data.module.lesson_points.join("\n"));
      setConceptsText(data.module.concepts.join(", "));
      if (data.verification) setVerification(data.verification);
      setStatusMsg(
        data.repaired
          ? "Draft generated and auto-repaired via the Python tracer! Review and click Save Lesson."
          : "Draft generated! Review below and click Save Lesson."
      );
    } catch (err) {
      setStatusMsg(`Failed to reach backend: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setStatusMsg(null);
    try {
      const resp = await fetch("/api/lessons/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await resp.json()) as LessonVerificationResult;
      setVerification(data);
    } finally {
      setVerifying(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatusMsg(null);
    try {
      const resp = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!resp.ok) {
        const errBody = (await resp.json()) as {
          detail?: { message?: string; verification?: LessonVerificationResult };
        };
        if (errBody.detail?.verification) {
          setVerification(errBody.detail.verification);
        }
        setStatusMsg(errBody.detail?.message ?? `Save failed (HTTP ${resp.status}).`);
        return;
      }
      const data = (await resp.json()) as {
        module: CurriculumModule;
        modules: CurriculumModule[];
        progress: CurriculumProgress;
      };
      onSaved(data.module, data.modules, data.progress);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleImportPack() {
    setImportError(null);
    setSaving(true);
    try {
      const resp = await fetch("/api/lessons/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: importJson }),
      });
      if (!resp.ok) {
        const errBody = (await resp.json()) as { detail?: unknown };
        setImportError(
          typeof errBody.detail === "string"
            ? errBody.detail
            : JSON.stringify(errBody.detail ?? "Import failed")
        );
        return;
      }
      const data = (await resp.json()) as {
        module: CurriculumModule;
        modules: CurriculumModule[];
        progress: CurriculumProgress;
      };
      onSaved(data.module, data.modules, data.progress);
      onClose();
    } catch (err) {
      setImportError(String(err));
    } finally {
      setSaving(false);
    }
  }

  function updateQuiz(idx: number, patch: Partial<QuizQuestion>) {
    setDraft((prev) => ({
      ...prev,
      quizzes: prev.quizzes.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  }

  async function grabOutputFromTracer(quizIdx: number) {
    const q = draft.quizzes[quizIdx];
    if (!q || !q.code.trim()) return;
    const resp = await fetch("/api/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: q.code }),
    });
    const data = (await resp.json()) as TraceResponse;
    if (data.trace.error) {
      setStatusMsg(`Quiz #${quizIdx + 1} tracer error: ${data.trace.error}`);
      return;
    }
    const last = data.trace.frames[data.trace.frames.length - 1];
    const out = last?.stdout.trim() || "(no stdout)";
    const targetIdx = q.correct_index ?? 0;
    const nextOpts = [...(q.options.length >= 2 ? q.options : ["", "", "", ""])];
    nextOpts[targetIdx] = out;
    updateQuiz(quizIdx, { options: nextOpts, correct_index: targetIdx });
  }

  function togglePrereq(id: string) {
    setDraft((prev) => {
      const has = prev.prerequisites.includes(id);
      return {
        ...prev,
        prerequisites: has
          ? prev.prerequisites.filter((p) => p !== id)
          : [...prev.prerequisites, id],
      };
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="subcard-title">
              <Sparkles size={16} />
              {editingModule ? "Edit Custom Lesson" : "Lesson Creator Studio"}
            </span>
            <div className="mode-switcher">
              <button
                type="button"
                className={`mode-btn ${studioTab === "author" ? "active" : ""}`}
                onClick={() => setStudioTab("author")}
              >
                Create / Edit
              </button>
              <button
                type="button"
                className={`mode-btn ${studioTab === "import" ? "active" : ""}`}
                onClick={() => setStudioTab("import")}
              >
                <FileUp size={13} />
                Import JSON Pack
              </button>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose} aria-label="Close studio">
            <X size={16} />
          </button>
        </div>

        <div className="studio-modal-body">
          {studioTab === "import" ? (
            <div className="tab-stack">
              <p className="muted-note">
                Upload or paste a shareable <code>.json</code> Lesson Pack. Its example code will be
                verified in the Python tracer before adding it to your Topic Catalog.
              </p>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void file.text().then((txt) => setImportJson(txt));
                }}
              />
              <textarea
                className="explain-textarea"
                rows={12}
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"schema_version": 1, "module": { ... }}'
              />
              {importError && <div className="test-status err">{importError}</div>}
            </div>
          ) : (
            <div className="tab-stack">
              {/* Optional AI Drafter */}
              <div className="subcard">
                <div className="subcard-header-row">
                  <span className="subcard-title">
                    <Sparkles size={14} />
                    AI Lesson Drafter (Optional — auto-verifies via tracer)
                  </span>
                  <button
                    type="button"
                    className="jump-pill"
                    onClick={() => setShowSeed((v) => !v)}
                  >
                    {showSeed ? "Hide seed code" : "+ Paste code snippet"}
                  </button>
                </div>
                <div className="narrator-controls">
                  <input
                    className="text-input"
                    value={topicPrompt}
                    onChange={(e) => setTopicPrompt(e.target.value)}
                    placeholder="Topic to teach (e.g. Python sets, list comprehensions, decorators)..."
                  />
                  <button
                    type="button"
                    className="icon-btn primary"
                    disabled={!topicPrompt.trim() || generating}
                    onClick={() => void handleGenerateAi()}
                  >
                    {generating ? "Drafting..." : "Generate Draft"}
                  </button>
                </div>
                {showSeed && (
                  <textarea
                    className="explain-textarea"
                    rows={3}
                    value={seedCode}
                    onChange={(e) => setSeedCode(e.target.value)}
                    placeholder="Optional: paste Python code you want this lesson to explain..."
                  />
                )}
              </div>

              {statusMsg && <div className="gentle-intro">{statusMsg}</div>}

              {/* Lesson Metadata */}
              <div className="studio-two-col">
                <div className="field-block">
                  <label className="field-label">Lesson Title</label>
                  <input
                    className="text-input"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Python Sets & Uniqueness"
                  />
                </div>
                <div className="field-block">
                  <label className="field-label">Subtitle</label>
                  <input
                    className="text-input"
                    value={draft.subtitle}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    placeholder="Short 1-line description"
                  />
                </div>
                <div className="field-block">
                  <label className="field-label">Track</label>
                  <input
                    className="text-input"
                    value={draft.track}
                    onChange={(e) => setDraft({ ...draft, track: e.target.value })}
                  />
                </div>
                <div className="field-block">
                  <label className="field-label">Difficulty</label>
                  <select
                    className="text-input"
                    value={draft.difficulty}
                    onChange={(e) =>
                      setDraft({ ...draft, difficulty: e.target.value as DifficultyLevel })
                    }
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>

              <div className="field-block">
                <label className="field-label">Builds On (Optional Prerequisites)</label>
                <div className="quick-prompts">
                  {existingModules
                    .filter((m) => m.id !== draft.id)
                    .map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`jump-pill ${draft.prerequisites.includes(m.id) ? "active" : ""}`}
                        onClick={() => togglePrereq(m.id)}
                      >
                        {m.title}
                      </button>
                    ))}
                </div>
              </div>

              <div className="studio-two-col">
                <div className="field-block">
                  <label className="field-label">Key Takeaways (one per line)</label>
                  <textarea
                    className="explain-textarea"
                    rows={4}
                    value={pointsText}
                    onChange={(e) => setPointsText(e.target.value)}
                  />
                </div>
                <div className="field-block">
                  <label className="field-label">Concepts (comma-separated)</label>
                  <input
                    className="text-input"
                    value={conceptsText}
                    onChange={(e) => setConceptsText(e.target.value)}
                    placeholder="set, unique items, membership"
                  />
                </div>
              </div>

              <div className="field-block">
                <div className="subcard-header-row">
                  <label className="field-label">Interactive Example Code (must pass Python tracer)</label>
                  <button
                    type="button"
                    className="icon-btn-sm"
                    onClick={() => void handleVerify()}
                    disabled={verifying}
                  >
                    <FlaskConical size={12} />
                    {verifying ? "Verifying..." : "Verify in Tracer"}
                  </button>
                </div>
                <textarea
                  className="explain-textarea"
                  style={{ fontFamily: "var(--mono)" }}
                  rows={6}
                  spellCheck={false}
                  value={draft.example_code}
                  onChange={(e) => setDraft({ ...draft, example_code: e.target.value })}
                />
              </div>

              {verification && (
                <div className={`test-status ${verification.valid ? "ok" : "err"}`}>
                  {verification.valid ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  <div>
                    {verification.valid ? (
                      <span>
                        Verified! Example traced cleanly in {verification.example_steps} steps.
                      </span>
                    ) : (
                      <div>
                        {verification.example_error && (
                          <div>Example error: {verification.example_error}</div>
                        )}
                        {verification.quiz_errors.map((qe) => (
                          <div key={qe}>{qe}</div>
                        ))}
                      </div>
                    )}
                    {verification.warnings.map((w) => (
                      <div key={w} style={{ color: "#fcd34d" }}>
                        Warning: {w}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Quiz Builder */}
              <div className="subcard">
                <div className="subcard-header-row">
                  <span className="subcard-title">Quizzes ({draft.quizzes.length})</span>
                  <div className="quick-prompts">
                    {(["predict", "spot_bug", "reorder", "explain"] as QuizKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="jump-pill"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            quizzes: [
                              ...prev.quizzes,
                              makeEmptyQuiz(k, prev.quizzes.length + 1),
                            ],
                          }))
                        }
                      >
                        <Plus size={11} style={{ verticalAlign: "middle" }} /> {k.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.quizzes.map((q, qIdx) => (
                  <div key={q.id} className="studio-quiz-box">
                    <div className="subcard-header-row">
                      <span className="quiz-kind-pill">{q.kind.replace("_", " ")}</span>
                      <input
                        className="text-input"
                        style={{ maxWidth: "240px" }}
                        value={q.title}
                        onChange={(e) => updateQuiz(qIdx, { title: e.target.value })}
                      />
                      <button
                        type="button"
                        className="icon-btn-ghost"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            quizzes: prev.quizzes.filter((_, i) => i !== qIdx),
                          }))
                        }
                        title="Remove quiz"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <input
                      className="text-input"
                      value={q.prompt}
                      onChange={(e) => updateQuiz(qIdx, { prompt: e.target.value })}
                      placeholder="Question prompt"
                    />

                    {q.kind !== "reorder" && (
                      <textarea
                        className="explain-textarea"
                        style={{ fontFamily: "var(--mono)" }}
                        rows={4}
                        spellCheck={false}
                        value={q.code}
                        onChange={(e) => updateQuiz(qIdx, { code: e.target.value })}
                      />
                    )}

                    {q.kind === "predict" && (
                      <div className="tab-stack">
                        <div className="subcard-header-row">
                          <span className="muted-note">Options (click radio for correct answer):</span>
                          <button
                            type="button"
                            className="icon-btn-sm"
                            onClick={() => void grabOutputFromTracer(qIdx)}
                          >
                            <FlaskConical size={12} />
                            Grab Real Output from Tracer
                          </button>
                        </div>
                        <div className="studio-two-col">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correct_index === oIdx}
                                onChange={() => updateQuiz(qIdx, { correct_index: oIdx })}
                              />
                              <input
                                className="text-input"
                                value={opt}
                                onChange={(e) => {
                                  const next = [...q.options];
                                  next[oIdx] = e.target.value;
                                  updateQuiz(qIdx, { options: next });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.kind === "spot_bug" && (
                      <div className="tab-stack">
                        <span className="muted-note">
                          Click the buggy line below (selected: Line {q.correct_line ?? "?"}):
                        </span>
                        <div className="quiz-code-box">
                          {q.code
                            .trimEnd()
                            .split("\n")
                            .map((ln, lIdx) => {
                              const lineNum = lIdx + 1;
                              return (
                                <div
                                  key={lineNum}
                                  className={`quiz-code-line clickable ${q.correct_line === lineNum ? "picked" : ""}`}
                                  onClick={() => updateQuiz(qIdx, { correct_line: lineNum })}
                                >
                                  <span className="line-num">{lineNum}</span>
                                  <span className="line-content">{highlightPythonLine(ln)}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {q.kind === "reorder" && (
                      <div className="tab-stack">
                        <span className="muted-note">
                          Enter blocks in their correct execution order (1 per line):
                        </span>
                        <textarea
                          className="explain-textarea"
                          style={{ fontFamily: "var(--mono)" }}
                          rows={3}
                          spellCheck={false}
                          value={q.blocks.join("\n")}
                          onChange={(e) => {
                            const lines = e.target.value.split("\n").filter((l) => l.trim().length > 0);
                            updateQuiz(qIdx, {
                              blocks: lines,
                              correct_order: lines.map((_, i) => i),
                            });
                          }}
                        />
                      </div>
                    )}

                    {q.kind === "explain" && (
                      <input
                        className="text-input"
                        value={q.sample_explanation}
                        onChange={(e) => updateQuiz(qIdx, { sample_explanation: e.target.value })}
                        placeholder="Sample reference explanation..."
                      />
                    )}

                    <input
                      className="text-input"
                      value={q.explanation}
                      onChange={(e) => updateQuiz(qIdx, { explanation: e.target.value })}
                      placeholder="Feedback shown after answering..."
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="icon-btn" onClick={onClose}>
            Cancel
          </button>
          {studioTab === "import" ? (
            <button
              type="button"
              className="icon-btn primary"
              disabled={!importJson.trim() || saving}
              onClick={() => void handleImportPack()}
            >
              {saving ? "Importing..." : "Import & Verify Pack"}
            </button>
          ) : (
            <button
              type="button"
              className="icon-btn primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving..." : "Verify & Save Lesson"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
