import type { TraceFrame } from "../types/trace";
import { MemoryBoxes } from "./MemoryBoxes";

interface VisualStateTabProps {
  frame: TraceFrame | null;
}

export function VisualStateTab({ frame }: VisualStateTabProps) {
  return (
    <div className="state-tab">
      <MemoryBoxes frame={frame} />
    </div>
  );
}
