import { useEffect, useState } from "react";
import { CheckCircle2, PlugZap, X } from "lucide-react";
import type { AiConfigPublic } from "../types/trace";

interface AiSettingsModalProps {
  isOpen: boolean;
  initialConfig: AiConfigPublic | null;
  availableModels: string[];
  onClose: () => void;
  onSaved: (
    config: AiConfigPublic,
    status: { online: boolean; disabled?: boolean; models?: string[]; error?: string }
  ) => void;
}

const PROVIDER_PRESETS = [
  { label: "llama.cpp (:8080)", url: "http://127.0.0.1:8080", model: "qwen3.5-4b-fast" },
  { label: "Ollama (:11434)", url: "http://127.0.0.1:11434/v1", model: "llama3.2" },
  { label: "LM Studio (:1234)", url: "http://127.0.0.1:1234/v1", model: "local-model" },
  { label: "OpenAI-Compatible", url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
];

export function AiSettingsModal({
  isOpen,
  initialConfig,
  availableModels,
  onClose,
  onSaved,
}: AiSettingsModalProps) {
  const [enabled, setEnabled] = useState(true);
  const [providerUrl, setProviderUrl] = useState("http://127.0.0.1:8080");
  const [defaultModel, setDefaultModel] = useState("qwen3.5-4b-fast");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !initialConfig) return;
    setEnabled(initialConfig.enabled);
    setProviderUrl(initialConfig.provider_url);
    setDefaultModel(initialConfig.default_model);
    setApiKey("");
    setClearApiKey(false);
    setDiscoveredModels(availableModels);
    setTestMsg(null);
    setTestOk(null);
  }, [isOpen, initialConfig, availableModels]);

  if (!isOpen) return null;

  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const resp = await fetch("/api/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_url: providerUrl,
          api_key: apiKey.trim() || null,
        }),
      });
      const data = (await resp.json()) as {
        online: boolean;
        models?: string[];
        error?: string;
      };
      if (data.online) {
        const models = data.models ?? [];
        setDiscoveredModels(models);
        if (models.length > 0 && !models.includes(defaultModel)) {
          setDefaultModel(models[0]);
        }
        setTestOk(true);
        setTestMsg(`Connected! Found ${models.length} model(s).`);
      } else {
        setTestOk(false);
        setTestMsg(`Could not connect: ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      setTestOk(false);
      setTestMsg(`Request failed: ${String(err)}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const resp = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          provider_url: providerUrl,
          default_model: defaultModel,
          api_key: apiKey.trim() || null,
          clear_api_key: clearApiKey,
        }),
      });
      const data = (await resp.json()) as {
        ai_config: AiConfigPublic;
        llama_router: { online: boolean; disabled?: boolean; models?: string[]; error?: string };
      };
      onSaved(data.ai_config, data.llama_router);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="subcard-title">
            <PlugZap size={16} />
            Configure AI Model Provider
          </span>
          <button className="icon-btn-ghost" onClick={onClose} aria-label="Close AI settings">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable optional AI Step Narrator (stepper &amp; AST glossary always work offline)</span>
          </label>

          {enabled && (
            <>
              <div className="field-block">
                <span className="field-label">Quick Presets</span>
                <div className="quick-prompts">
                  {PROVIDER_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`jump-pill ${providerUrl === p.url ? "active" : ""}`}
                      onClick={() => {
                        setProviderUrl(p.url);
                        setDefaultModel(p.model);
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-block">
                <label className="field-label" htmlFor="ai-base-url">
                  OpenAI-Compatible Base URL
                </label>
                <div className="narrator-controls">
                  <input
                    id="ai-base-url"
                    className="text-input"
                    value={providerUrl}
                    onChange={(e) => setProviderUrl(e.target.value)}
                    placeholder="http://127.0.0.1:11434/v1"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void handleTest()}
                    disabled={testing || !providerUrl.trim()}
                  >
                    {testing ? "Testing..." : "Test & Fetch"}
                  </button>
                </div>
              </div>

              {testMsg && (
                <div className={`test-status ${testOk ? "ok" : "err"}`}>
                  {testOk && <CheckCircle2 size={14} />}
                  <span>{testMsg}</span>
                </div>
              )}

              <div className="field-block">
                <label className="field-label" htmlFor="ai-model-input">
                  Default Model ID
                </label>
                {discoveredModels.length > 0 ? (
                  <div className="narrator-controls">
                    <select
                      id="ai-model-input"
                      className="text-input"
                      value={discoveredModels.includes(defaultModel) ? defaultModel : "__custom__"}
                      onChange={(e) => {
                        if (e.target.value !== "__custom__") {
                          setDefaultModel(e.target.value);
                        }
                      }}
                    >
                      {discoveredModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      {!discoveredModels.includes(defaultModel) && (
                        <option value="__custom__">Custom: {defaultModel}</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <input
                    id="ai-model-input"
                    className="text-input"
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    placeholder="e.g. llama3.2, qwen2.5-coder, gpt-4o-mini"
                  />
                )}
              </div>

              <div className="field-block">
                <label className="field-label" htmlFor="ai-api-key">
                  API Key (optional — only needed for cloud providers)
                </label>
                <input
                  id="ai-api-key"
                  type="password"
                  className="text-input"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setClearApiKey(false);
                  }}
                  placeholder={
                    initialConfig?.has_api_key && !clearApiKey
                      ? "•••••••• (saved locally; enter new key to replace)"
                      : "sk-... (leave blank for local Ollama / llama.cpp)"
                  }
                />
                {initialConfig?.has_api_key && !clearApiKey && (
                  <button
                    type="button"
                    className="jump-pill"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => {
                      setClearApiKey(true);
                      setApiKey("");
                    }}
                  >
                    Clear saved API key
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="icon-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-btn primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
