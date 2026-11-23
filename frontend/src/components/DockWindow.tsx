import { useState, type ReactNode } from "react";
import { EyeOff, GripVertical, Maximize2, Minimize2 } from "lucide-react";
import type { SlotId, WindowId } from "../types/layout";

const WINDOW_OPTIONS: { id: WindowId; label: string }[] = [
  { id: "code", label: "Code Spotlight" },
  { id: "state", label: "Visual State" },
  { id: "terminal", label: "Output Terminal" },
  { id: "mentor", label: "AI Mentor & Glossary" },
  { id: "flow", label: "Flow, Loops & Stack" },
];

interface DockWindowProps {
  slotId: SlotId;
  windowId: WindowId;
  title: string;
  icon: ReactNode;
  isMaximized: boolean;
  canHide?: boolean;
  headerActions?: ReactNode;
  onDragStartWindow: (windowId: WindowId, fromSlot: SlotId) => void;
  onDropOnSlot: (targetSlot: SlotId) => void;
  onSwitchWindow: (slotId: SlotId, nextWindow: WindowId) => void;
  onToggleMaximize: (windowId: WindowId) => void;
  onHideSlot: (slotId: SlotId) => void;
  children: ReactNode;
}

export function DockWindow({
  slotId,
  windowId,
  title,
  icon,
  isMaximized,
  canHide = true,
  headerActions,
  onDragStartWindow,
  onDropOnSlot,
  onSwitchWindow,
  onToggleMaximize,
  onHideSlot,
  children,
}: DockWindowProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <section
      className={`dock-window ${isDragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDropOnSlot(slotId);
      }}
    >
      <div
        className="dock-window-header"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", windowId);
          onDragStartWindow(windowId, slotId);
        }}
        title="Drag window bar onto another window to swap positions"
      >
        <div className="dock-window-title">
          <GripVertical size={14} className="drag-grip" />
          {icon}
          <select
            className="window-title-select"
            value={windowId}
            aria-label={`Select view for ${slotId} window`}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => onSwitchWindow(slotId, e.target.value as WindowId)}
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="dock-window-actions">
          {headerActions}
          <button
            className="icon-btn-ghost"
            onClick={() => onToggleMaximize(windowId)}
            title={isMaximized ? "Restore window" : "Maximize window"}
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {canHide && !isMaximized && (
            <button
              className="icon-btn-ghost"
              onClick={() => onHideSlot(slotId)}
              title={`Hide ${title}`}
              aria-label={`Hide ${title}`}
            >
              <EyeOff size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="dock-window-body">{children}</div>
    </section>
  );
}
