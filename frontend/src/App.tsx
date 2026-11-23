import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Cpu,
  Edit3,
  Play,
  Repeat,
  RotateCcw,
  Settings,
  Sparkles,
  Terminal,
} from "lucide-react";
import { AiSettingsModal } from "./components/AiSettingsModal";
import { CodeStepperPane } from "./components/CodeStepperPane";
import { DockWindow } from "./components/DockWindow";
import { FlowLoopsTab } from "./components/FlowLoopsTab";
import { MentorGlossaryTab } from "./components/MentorGlossaryTab";
import { TerminalWindow } from "./components/TerminalWindow";
import { TimelineControls } from "./components/TimelineControls";
import { VisualStateTab } from "./components/VisualStateTab";
import { DEFAULT_LAYOUT, type LayoutConfig, type SlotId, type WindowId } from "./types/layout";
import type {
  AiConfigPublic,
  GlossarySpan,
  HealthResponse,
  PresetLesson,
  TraceResponse,
  TraceResult,
} from "./types/trace";

const LAYOUT_STORAGE_KEY = "mentor_dock_layout_v3";

const WINDOW_TITLES: Record<WindowId, string> = {
  code: "Code Spotlight",
  state: "Visual State",
  terminal: "Output Terminal",
  mentor: "AI Mentor & Glossary",
  flow: "Flow, Loops & Stack",
};

function loadLayout(): LayoutConfig {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutConfig>;
    if (!parsed.slots) return DEFAULT_LAYOUT;
    return {
      slots: { ...DEFAULT_LAYOUT.slots, ...parsed.slots },
      leftWidthPx: parsed.leftWidthPx ?? DEFAULT_LAYOUT.leftWidthPx,
      rightWidthPx: parsed.rightWidthPx ?? DEFAULT_LAYOUT.rightWidthPx,
      leftTopPct: parsed.leftTopPct ?? DEFAULT_LAYOUT.leftTopPct,
      centerTopPct: parsed.centerTopPct ?? DEFAULT_LAYOUT.centerTopPct,
      rightTopPct: parsed.rightTopPct ?? DEFAULT_LAYOUT.rightTopPct,
      maximized: parsed.maximized ?? null,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export default function App() {
  const [presets, setPresets] = useState<PresetLesson[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [tracedCode, setTracedCode] = useState<string>("");
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [glossary, setGlossary] = useState<GlossarySpan[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [layout, setLayout] = useState<LayoutConfig>(loadLayout);
  const [showBrief, setShowBrief] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(750);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState<AiConfigPublic | null>(null);
  const [llamaOnline, setLlamaOnline] = useState<boolean>(false);
  const [llamaModels, setLlamaModels] = useState<string[]>([]);
  const [showAiSettings, setShowAiSettings] = useState<boolean>(false);
  const [traceFetchError, setTraceFetchError] = useState<string | null>(null);

  const dragSourceRef = useRef<{ windowId: WindowId; fromSlot: SlotId } | null>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const centerColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // ignore storage errors
    }
  }, [layout]);

  const runTrace = useCallback(async (sourceCode: string, presetId?: string) => {
    setIsPlaying(false);
    setTraceFetchError(null);
    try {
      const resp = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: sourceCode, preset_id: presetId ?? null }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as TraceResponse;
      setTracedCode(sourceCode);
      setTrace(data.trace);
      setGlossary(data.glossary);
      setCurrentStep(0);
      setSelectedLine(null);
    } catch (err) {
      setTraceFetchError(`Could not run trace against backend: ${String(err)}`);
    }
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const [presetsRes, healthRes] = await Promise.all([
          fetch("/api/presets"),
          fetch("/api/health"),
        ]);
        const presetList = (await presetsRes.json()) as PresetLesson[];
        const healthData = (await healthRes.json()) as HealthResponse;
        setPresets(presetList);
        setAiConfig(healthData.ai_config);
        setLlamaOnline(healthData.llama_router.online);
        setLlamaModels(healthData.llama_router.models ?? []);
        if (presetList.length > 0) {
          setActivePresetId(presetList[0].id);
          setCode(presetList[0].code);
          await runTrace(presetList[0].code, presetList[0].id);
        }
      } catch {
        setLlamaOnline(false);
      }
    }
    void boot();
  }, [runTrace]);

  useEffect(() => {
    if (!isPlaying || !trace || trace.total_steps <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= trace.total_steps - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, speedMs, trace]);

  useEffect(() => {
    const total = trace?.frames.length ?? 0;
    function onKeyDown(e: KeyboardEvent) {
      if (showAiSettings || isEditing || total === 0) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStep((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStep((prev) => Math.min(total - 1, prev + 1));
      } else if (e.key === " ") {
        e.preventDefault();
        if (total > 1) setIsPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditing, showAiSettings, trace]);

  const activePreset = presets.find((p) => p.id === activePresetId) ?? null;
  const frames = trace?.frames ?? [];
  const currentFrame = frames[currentStep] ?? null;
  const codeLines = useMemo(() => code.split("\n"), [code]);

  const hasPrintedThisStep = useMemo(() => {
    if (!currentFrame) return false;
    const prevStdout = currentStep > 0 ? (frames[currentStep - 1]?.stdout ?? "") : "";
    return currentFrame.stdout.length > prevStdout.length;
  }, [currentFrame, currentStep, frames]);

  const isDirty = code !== tracedCode;
  const isModifiedFromPreset = activePreset ? code !== activePreset.code : false;
  const isAtEnd = frames.length > 0 && currentStep === frames.length - 1;

  const hiddenWindows = useMemo(() => {
    const visible = new Set(Object.values(layout.slots).filter(Boolean));
    return (["state", "flow", "code", "terminal", "mentor"] as WindowId[]).filter(
      (w) => !visible.has(w)
    );
  }, [layout.slots]);

  const isCustomLayout =
    JSON.stringify(layout.slots) !== JSON.stringify(DEFAULT_LAYOUT.slots) ||
    layout.leftWidthPx !== DEFAULT_LAYOUT.leftWidthPx ||
    layout.rightWidthPx !== DEFAULT_LAYOUT.rightWidthPx ||
    layout.leftTopPct !== DEFAULT_LAYOUT.leftTopPct ||
    layout.centerTopPct !== DEFAULT_LAYOUT.centerTopPct ||
    layout.rightTopPct !== DEFAULT_LAYOUT.rightTopPct ||
    layout.maximized !== null ||
    !showBrief;

  const handleDropOnSlot = useCallback((targetSlot: SlotId) => {
    const src = dragSourceRef.current;
    dragSourceRef.current = null;
    if (!src || src.fromSlot === targetSlot) return;
    setLayout((prev) => {
      const targetWin = prev.slots[targetSlot];
      return {
        ...prev,
        slots: {
          ...prev.slots,
          [targetSlot]: src.windowId,
          [src.fromSlot]: targetWin,
        },
      };
    });
  }, []);

  const handleSwitchWindow = useCallback((slotId: SlotId, nextWindow: WindowId) => {
    setLayout((prev) => {
      const existingSlot = (Object.keys(prev.slots) as SlotId[]).find(
        (s) => prev.slots[s] === nextWindow
      );
      const currentInSlot = prev.slots[slotId];
      if (existingSlot && existingSlot !== slotId) {
        return {
          ...prev,
          slots: {
            ...prev.slots,
            [slotId]: nextWindow,
            [existingSlot]: currentInSlot,
          },
        };
      }
      return {
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: nextWindow,
        },
      };
    });
  }, []);

  const handleHideSlot = useCallback((slotId: SlotId) => {
    setLayout((prev) => ({
      ...prev,
      slots: { ...prev.slots, [slotId]: null },
    }));
  }, []);

  const handleRestoreWindow = useCallback((windowId: WindowId) => {
    setLayout((prev) => {
      const preferred: Record<WindowId, SlotId> = {
        state: "leftTop",
        flow: "leftBottom",
        code: "centerTop",
        terminal: "centerBottom",
        mentor: "rightTop",
      };
      const order: SlotId[] = [
        preferred[windowId],
        "leftBottom",
        "rightBottom",
        "centerBottom",
        "leftTop",
        "rightTop",
        "centerTop",
      ];
      const emptySlot = order.find((s) => prev.slots[s] === null);
      if (!emptySlot) return prev;
      return {
        ...prev,
        slots: { ...prev.slots, [emptySlot]: windowId },
      };
    });
  }, []);

  const startResize = useCallback(
    (
      kind: "left" | "right" | "leftSplit" | "centerSplit" | "rightSplit",
      e: React.MouseEvent
    ) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const initLeft = layout.leftWidthPx;
      const initRight = layout.rightWidthPx;
      const initLeftPct = layout.leftTopPct;
      const initCenterPct = layout.centerTopPct;
      const initRightPct = layout.rightTopPct;

      function onMove(ev: MouseEvent) {
        if (kind === "left") {
          const next = Math.max(240, Math.min(620, initLeft + (ev.clientX - startX)));
          setLayout((prev) => ({ ...prev, leftWidthPx: next }));
        } else if (kind === "right") {
          const next = Math.max(240, Math.min(620, initRight - (ev.clientX - startX)));
          setLayout((prev) => ({ ...prev, rightWidthPx: next }));
        } else if (kind === "leftSplit" && leftColRef.current) {
          const rect = leftColRef.current.getBoundingClientRect();
          const deltaPct = ((ev.clientY - startY) / Math.max(200, rect.height)) * 100;
          const next = Math.max(25, Math.min(82, Math.round(initLeftPct + deltaPct)));
          setLayout((prev) => ({ ...prev, leftTopPct: next }));
        } else if (kind === "centerSplit" && centerColRef.current) {
          const rect = centerColRef.current.getBoundingClientRect();
          const deltaPct = ((ev.clientY - startY) / Math.max(200, rect.height)) * 100;
          const next = Math.max(28, Math.min(84, Math.round(initCenterPct + deltaPct)));
          setLayout((prev) => ({ ...prev, centerTopPct: next }));
        } else if (kind === "rightSplit" && rightColRef.current) {
          const rect = rightColRef.current.getBoundingClientRect();
          const deltaPct = ((ev.clientY - startY) / Math.max(200, rect.height)) * 100;
          const next = Math.max(25, Math.min(82, Math.round(initRightPct + deltaPct)));
          setLayout((prev) => ({ ...prev, rightTopPct: next }));
        }
      }

      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      layout.centerTopPct,
      layout.leftTopPct,
      layout.leftWidthPx,
      layout.rightTopPct,
      layout.rightWidthPx,
    ]
  );

  function renderWindowIcon(windowId: WindowId) {
    if (windowId === "code") return <Code2 size={15} />;
    if (windowId === "state") return <Boxes size={15} />;
    if (windowId === "terminal") return <Terminal size={15} />;
    if (windowId === "flow") return <Repeat size={15} />;
    return <Sparkles size={15} />;
  }

  function renderWindowActions(windowId: WindowId) {
    if (windowId !== "code") return null;
    const stackDepth = currentFrame?.call_stack.length ?? 0;
    const stackCrumb =
      stackDepth > 1 && currentFrame
        ? currentFrame.call_stack
            .map((s) => (s.function === "<module>" ? "Main" : `${s.function}()`))
            .join(" → ")
        : null;

    return (
      <>
        {stackCrumb && !isEditing && (
          <span className="stack-crumb" title="Active Call Stack">
            {stackCrumb}
          </span>
        )}
        {isDirty && <span className="dirty-pill">Edited</span>}
        {selectedLine !== null && !isEditing && (
          <span className="subtle-hint">L{selectedLine}</span>
        )}
        {isModifiedFromPreset && (
          <button
            className="icon-btn-sm"
            onClick={() => {
              if (!activePreset) return;
              setCode(activePreset.code);
              setIsEditing(false);
              void runTrace(activePreset.code, activePreset.id);
            }}
            title="Restore original starter preset code"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
        <button
          className={`icon-btn-sm ${isEditing && isDirty ? "primary" : ""}`}
          onClick={() => {
            if (isEditing) {
              setIsEditing(false);
              if (code !== tracedCode) {
                void runTrace(code, activePresetId);
              }
            } else {
              setIsEditing(true);
            }
          }}
        >
          <Edit3 size={12} />
          {isEditing ? (isDirty ? "Save & Step" : "Stepper") : "Tweak"}
        </button>
        {isEditing && (
          <button
            className="icon-btn-sm primary"
            onClick={() => {
              setIsEditing(false);
              void runTrace(code, activePresetId);
            }}
          >
            <Play size={12} />
            Run
          </button>
        )}
      </>
    );
  }

  function renderWindowContent(windowId: WindowId) {
    if (windowId === "code") {
      return (
        <CodeStepperPane
          code={code}
          currentFrame={currentFrame}
          glossary={glossary}
          selectedLine={selectedLine}
          isEditing={isEditing}
          onSelectLine={(ln) => setSelectedLine(ln)}
          onCodeChange={setCode}
        />
      );
    }
    if (windowId === "state") {
      return <VisualStateTab frame={currentFrame} />;
    }
    if (windowId === "terminal") {
      return (
        <TerminalWindow
          frame={currentFrame}
          traceError={trace?.error ?? null}
          hasPrintedThisStep={hasPrintedThisStep}
          isAtEnd={isAtEnd}
        />
      );
    }
    if (windowId === "flow") {
      return (
        <FlowLoopsTab
          frames={frames}
          currentFrame={currentFrame}
          selectedLine={selectedLine}
          codeLines={codeLines}
          onJumpToStep={(stepIdx) => {
            setIsPlaying(false);
            setCurrentStep(stepIdx);
          }}
        />
      );
    }
    return (
      <MentorGlossaryTab
        code={code}
        frame={currentFrame}
        selectedLine={selectedLine}
        glossary={glossary}
        aiEnabled={aiConfig?.enabled ?? true}
        llamaOnline={llamaOnline}
        availableModels={llamaModels}
        defaultModel={aiConfig?.default_model ?? "qwen3.5-4b-fast"}
        onOpenSettings={() => setShowAiSettings(true)}
      />
    );
  }

  function renderSlot(slotId: SlotId, windowId: WindowId) {
    return (
      <DockWindow
        slotId={slotId}
        windowId={windowId}
        title={WINDOW_TITLES[windowId]}
        icon={renderWindowIcon(windowId)}
        isMaximized={layout.maximized === windowId}
        canHide={windowId !== "code"}
        headerActions={renderWindowActions(windowId)}
        onDragStartWindow={(win, from) => {
          dragSourceRef.current = { windowId: win, fromSlot: from };
        }}
        onDropOnSlot={handleDropOnSlot}
        onSwitchWindow={handleSwitchWindow}
        onToggleMaximize={(win) =>
          setLayout((prev) => ({
            ...prev,
            maximized: prev.maximized === win ? null : win,
          }))
        }
        onHideSlot={handleHideSlot}
      >
        {renderWindowContent(windowId)}
      </DockWindow>
    );
  }

  function renderColumn(
    colRef: React.RefObject<HTMLDivElement>,
    topSlot: SlotId,
    bottomSlot: SlotId,
    topPct: number,
    splitKind: "leftSplit" | "centerSplit" | "rightSplit",
    widthPx?: number,
    isCenter?: boolean
  ) {
    const topWin = layout.slots[topSlot];
    const bottomWin = layout.slots[bottomSlot];
    if (!topWin && !bottomWin) return null;

    return (
      <div
        ref={colRef}
        className={isCenter ? "dock-center-col" : "dock-col"}
        style={widthPx ? { width: `${widthPx}px` } : undefined}
      >
        {topWin && (
          <div
            className="dock-pane"
            style={bottomWin ? { height: `${topPct}%` } : { flex: 1, minHeight: 0 }}
          >
            {renderSlot(topSlot, topWin)}
          </div>
        )}

        {topWin && bottomWin && (
          <div
            className="splitter-h"
            onMouseDown={(e) => startResize(splitKind, e)}
            title="Drag up or down to resize windows"
          />
        )}

        {bottomWin && (
          <div className="dock-pane" style={{ flex: 1, minHeight: 0 }}>
            {renderSlot(bottomSlot, bottomWin)}
          </div>
        )}
      </div>
    );
  }

  const hasLeft = layout.slots.leftTop !== null || layout.slots.leftBottom !== null;
  const hasCenter = layout.slots.centerTop !== null || layout.slots.centerBottom !== null;
  const hasRight = layout.slots.rightTop !== null || layout.slots.rightBottom !== null;

  const maximizedSlot = layout.maximized
    ? (Object.entries(layout.slots).find(([, w]) => w === layout.maximized)?.[0] as SlotId | undefined)
    : undefined;

  return (
    <div className="app-shell">
      <header className="topbar-compact">
        <div className="brand-compact">
          <div className="brand-icon-sm">
            <Cpu size={17} />
          </div>
          <span className="alpha-badge" title="Early Alpha release — verify AI explanations against the trace">
            Alpha v0.1
          </span>
          <select
            className="lesson-select"
            value={activePresetId}
            aria-label="Choose starter lesson"
            onChange={(e) => {
              const chosen = presets.find((p) => p.id === e.target.value);
              if (!chosen) return;
              setActivePresetId(chosen.id);
              setCode(chosen.code);
              setIsEditing(false);
              void runTrace(chosen.code, chosen.id);
            }}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.difficulty}: {p.title} ({p.project_link})
              </option>
            ))}
          </select>
        </div>

        <TimelineControls
          currentStep={currentStep}
          totalSteps={frames.length}
          isPlaying={isPlaying}
          speedMs={speedMs}
          onStepChange={(step) => {
            setIsPlaying(false);
            setCurrentStep(step);
          }}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onSpeedChange={setSpeedMs}
        />

        <div className="topbar-right">
          {hiddenWindows.map((w) => (
            <button
              key={w}
              className="icon-btn"
              onClick={() => handleRestoreWindow(w)}
              title={`Restore ${WINDOW_TITLES[w]}`}
            >
              + {WINDOW_TITLES[w].split(/[ ,]/)[0]}
            </button>
          ))}
          {isCustomLayout && (
            <button
              className="icon-btn"
              onClick={() => {
                setLayout(DEFAULT_LAYOUT);
                setShowBrief(true);
              }}
              title="Reset windows and split sizes to default"
            >
              Reset Layout
            </button>
          )}
          <button
            className="status-pill status-btn"
            onClick={() => setShowAiSettings(true)}
            title="Configure AI model or endpoint"
          >
            <span
              className={`dot ${!(aiConfig?.enabled ?? true) ? "disabled" : llamaOnline ? "online" : "offline"}`}
            />
            {!(aiConfig?.enabled ?? true)
              ? "AI Off"
              : llamaOnline
                ? "AI Ready"
                : "Setup AI"}
            <Settings size={12} />
          </button>
        </div>
      </header>

      {activePreset && (
        <section className="lesson-brief">
          <div className="lesson-brief-head">
            <div className="lesson-brief-title">
              <Compass size={15} className="brief-icon" />
              <strong>
                {activePreset.difficulty} — {activePreset.title}
              </strong>
              <span className="brief-tag">{activePreset.project_link}</span>
              {!showBrief && (
                <span className="brief-inline-preview">{activePreset.summary}</span>
              )}
            </div>
            <button
              className="icon-btn-ghost"
              onClick={() => setShowBrief((v) => !v)}
              aria-label={showBrief ? "Collapse lesson brief" : "Expand lesson brief"}
            >
              {showBrief ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
          {showBrief && (
            <div className="lesson-brief-body">
              <p className="brief-desc">{activePreset.summary}</p>
              <p className="brief-focus">
                <strong>Focus on:</strong> {activePreset.watch_for}
              </p>
            </div>
          )}
        </section>
      )}

      {(traceFetchError || trace?.error) && (
        <div className="error-banner">
          <strong>Execution Notice:</strong> {traceFetchError ?? trace?.error}
        </div>
      )}

      {layout.maximized && maximizedSlot ? (
        <main className="dock-maximized-stage">
          {renderSlot(maximizedSlot, layout.maximized)}
        </main>
      ) : (
        <main className="dock-workspace">
          {renderColumn(
            leftColRef,
            "leftTop",
            "leftBottom",
            layout.leftTopPct,
            "leftSplit",
            layout.leftWidthPx
          )}

          {hasLeft && (hasCenter || hasRight) && (
            <div
              className="splitter-v"
              onMouseDown={(e) => startResize("left", e)}
              title="Drag left or right to resize column"
            />
          )}

          {renderColumn(
            centerColRef,
            "centerTop",
            "centerBottom",
            layout.centerTopPct,
            "centerSplit",
            undefined,
            true
          )}

          {hasCenter && hasRight && (
            <div
              className="splitter-v"
              onMouseDown={(e) => startResize("right", e)}
              title="Drag left or right to resize column"
            />
          )}

          {renderColumn(
            rightColRef,
            "rightTop",
            "rightBottom",
            layout.rightTopPct,
            "rightSplit",
            layout.rightWidthPx
          )}
        </main>
      )}

      <AiSettingsModal
        isOpen={showAiSettings}
        initialConfig={aiConfig}
        availableModels={llamaModels}
        onClose={() => setShowAiSettings(false)}
        onSaved={(cfg, status) => {
          setAiConfig(cfg);
          setLlamaOnline(status.online);
          setLlamaModels(status.models ?? []);
        }}
      />
    </div>
  );
}
