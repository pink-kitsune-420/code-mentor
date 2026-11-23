import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Settings, Sparkles } from "lucide-react";
import type { GlossarySpan, TraceFrame } from "../types/trace";

interface MentorGlossaryTabProps {
  code: string;
  frame: TraceFrame | null;
  selectedLine: number | null;
  glossary: GlossarySpan[];
  aiEnabled: boolean;
  llamaOnline: boolean;
  availableModels: string[];
  defaultModel: string;
  onOpenSettings: () => void;
}

export function MentorGlossaryTab({
  code,
  frame,
  selectedLine,
  glossary,
  aiEnabled,
  llamaOnline,
  availableModels,
  defaultModel,
  onOpenSettings,
}: MentorGlossaryTabProps) {
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setModel(defaultModel);
  }, [defaultModel]);

  const modelChoices =
    availableModels.length > 0
      ? availableModels
      : [defaultModel || "qwen3.5-4b-fast"];
  const selectedModel = modelChoices.includes(model) ? model : modelChoices[0];

  const inspectLine = selectedLine ?? frame?.line ?? 1;
  const lineGlossary = glossary.filter((g) => g.start_line === inspectLine);

  async function askNarrator(customPrompt?: string) {
    if (!frame) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/explain-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          frame,
          question: (customPrompt ?? question).trim() || null,
          model: selectedModel,
        }),
      });
      const data = (await resp.json()) as { explanation?: string };
      setExplanation(data.explanation ?? "No explanation returned.");
    } catch (err) {
      setExplanation(`Failed to reach mentor backend: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tab-stack">
      <div className="ai-disclaimer-box">
        <AlertTriangle size={15} className="disclaimer-icon" />
        <div>
          <strong>Alpha Software — Verify AI Answers:</strong> AI models are not 100% accurate.
          Always pair AI explanations with the deterministic execution trace, Visual Memory Boxes,
          and your own reading/research before treating anything as fact.
        </div>
      </div>

      <section className="subcard">
        <div className="subcard-header-row">
          <span className="subcard-title">
            <Sparkles size={15} />
            AI Mentor (Step {frame ? frame.step + 1 : 0})
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <select
              className="compact-select"
              value={selectedModel}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Narrator model"
              disabled={!aiEnabled}
            >
              {modelChoices.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              className="icon-btn-sm"
              onClick={onOpenSettings}
              title="Configure AI model or endpoint"
            >
              <Settings size={12} />
              Setup
            </button>
          </div>
        </div>

        <p className="muted-note">
          Grounded in the exact recorded trace frame for this step.
        </p>

        <div className="quick-prompts">
          <button
            className="jump-pill"
            disabled={!frame || loading || !aiEnabled}
            onClick={() => void askNarrator("Explain what just happened in plain English.")}
          >
            Explain this step
          </button>
          <button
            className="jump-pill"
            disabled={!frame || loading || !aiEnabled}
            onClick={() => void askNarrator("Why did the code go to this line next?")}
          >
            Why this line next?
          </button>
        </div>

        <div className="narrator-controls">
          <input
            className="text-input"
            placeholder={aiEnabled ? "Ask a question about this step..." : "AI is turned off in Setup"}
            value={question}
            disabled={!aiEnabled}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void askNarrator();
            }}
          />
          <button
            className="icon-btn primary"
            onClick={() => void askNarrator()}
            disabled={!frame || loading || !aiEnabled}
          >
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>

        {!aiEnabled ? (
          <p className="muted-note">
            AI Narrator is turned off. Click <strong>Setup</strong> above to connect Ollama, LM Studio, llama.cpp, or a cloud key.
          </p>
        ) : !llamaOnline ? (
          <p className="warn-note">
            No AI endpoint reachable yet. Click <strong>Setup</strong> to configure your model, or keep using the offline stepper &amp; AST glossary.
          </p>
        ) : null}

        {explanation && <div className="narrator-reply">{explanation}</div>}
      </section>

      <section className="subcard">
        <div className="subcard-title">
          <BookOpen size={15} />
          Line {inspectLine} Plain-English Breakdown
        </div>
        {lineGlossary.length === 0 ? (
          <p className="muted-note">
            Click any line in the code pane to inspect its Python syntax pieces here.
          </p>
        ) : (
          <div className="glossary-list">
            {lineGlossary.map((span, idx) => (
              <div key={`${span.kind}-${span.start_col}-${idx}`} className="glossary-item">
                <div className="glossary-item-title">{span.title}</div>
                <div className="glossary-item-desc">{span.plain_english}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
