import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Settings, Sparkles, Volume2, VolumeX } from "lucide-react";
import type { GlossarySpan, TraceFrame } from "../types/trace";
import { isSpeechSupported, speakText, stopSpeech } from "../utils/speech";

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
  const [explanation, setExplanation] = useState<{ text: string; step: number; label?: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speechReady = isSpeechSupported();

  useEffect(() => {
    setModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    setExplanation(null);
    stopSpeech();
    setSpeaking(false);
  }, [code]);

  useEffect(() => () => stopSpeech(), []);

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
    stopSpeech();
    setSpeaking(false);
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
      setExplanation({
        text: data.explanation ?? "No explanation returned.",
        step: frame.step,
      });
    } catch (err) {
      setExplanation({
        text: `Failed to reach mentor backend: ${String(err)}`,
        step: frame.step,
      });
    } finally {
      setLoading(false);
    }
  }

  async function translateSnippet(targetLang: "TypeScript" | "Rust") {
    if (!code.trim()) return;
    setLoading(true);
    stopSpeech();
    setSpeaking(false);
    try {
      const resp = await fetch("/api/translate-snippet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          target_lang: targetLang,
          model: selectedModel,
        }),
      });
      const data = (await resp.json()) as { translation?: string };
      setExplanation({
        text: data.translation ?? "No translation returned.",
        step: frame?.step ?? 0,
        label: `Python → ${targetLang} Bridge`,
      });
    } catch (err) {
      setExplanation({
        text: `Failed to reach mentor backend: ${String(err)}`,
        step: frame?.step ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tab-stack">
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
          <button
            className="jump-pill"
            disabled={loading || !aiEnabled || !code.trim()}
            onClick={() => void translateSnippet("TypeScript")}
          >
            To TypeScript
          </button>
          <button
            className="jump-pill"
            disabled={loading || !aiEnabled || !code.trim()}
            onClick={() => void translateSnippet("Rust")}
          >
            To Rust
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

        {explanation && (
          <div className="narrator-reply-wrap">
            <div className="subcard-header-row">
              {explanation.label ? (
                <div className="stale-step-note">{explanation.label}</div>
              ) : frame && explanation.step !== frame.step ? (
                <div className="stale-step-note">
                  Answered for Step {explanation.step + 1} (now viewing Step {frame.step + 1})
                </div>
              ) : (
                <span />
              )}
              {speechReady && (
                <button
                  className="icon-btn-sm"
                  onClick={() => {
                    if (speaking) {
                      stopSpeech();
                      setSpeaking(false);
                    } else {
                      setSpeaking(true);
                      speakText(explanation.text, () => setSpeaking(false));
                    }
                  }}
                  title={speaking ? "Stop reading" : "Read response aloud"}
                >
                  {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  {speaking ? "Stop" : "Read"}
                </button>
              )}
            </div>
            <div className="narrator-reply">{explanation.text}</div>
            <div className="ai-inline-warning">
              <AlertTriangle size={12} className="disclaimer-icon" />
              <span>AI can be wrong—verify against the trace &amp; your own research.</span>
            </div>
          </div>
        )}
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
