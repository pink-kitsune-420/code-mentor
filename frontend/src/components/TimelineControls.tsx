import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

interface TimelineControlsProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speedMs: number;
  onStepChange: (step: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (ms: number) => void;
}

export function TimelineControls({
  currentStep,
  totalSteps,
  isPlaying,
  speedMs,
  onStepChange,
  onTogglePlay,
  onSpeedChange,
}: TimelineControlsProps) {
  const maxIndex = Math.max(0, totalSteps - 1);

  return (
    <div className="timeline-inline">
      <div className="transport-group">
        <button
          className="icon-btn"
          onClick={() => onStepChange(0)}
          disabled={totalSteps === 0 || currentStep === 0}
          title="Reset to start"
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="icon-btn"
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={totalSteps === 0 || currentStep <= 0}
          title="Step back"
        >
          <SkipBack size={14} />
        </button>
        <button
          className="icon-btn primary"
          onClick={onTogglePlay}
          disabled={totalSteps <= 1}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          className="icon-btn"
          onClick={() => onStepChange(Math.min(maxIndex, currentStep + 1))}
          disabled={totalSteps === 0 || currentStep >= maxIndex}
          title="Step forward"
        >
          Next
          <SkipForward size={14} />
        </button>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={maxIndex}
        value={Math.min(currentStep, maxIndex)}
        disabled={totalSteps === 0}
        onChange={(e) => onStepChange(Number(e.target.value))}
        aria-label="Execution timeline"
      />
      <span className="step-counter">
        {totalSteps === 0 ? 0 : currentStep + 1}/{totalSteps}
      </span>

      <select
        className="compact-select"
        value={speedMs}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        aria-label="Playback speed"
      >
        <option value={1200}>0.5×</option>
        <option value={750}>1×</option>
        <option value={350}>2×</option>
      </select>
    </div>
  );
}
