export type WindowId = "code" | "state" | "terminal" | "mentor" | "flow";
export type SlotId =
  | "leftTop"
  | "leftBottom"
  | "centerTop"
  | "centerBottom"
  | "rightTop"
  | "rightBottom";

export interface LayoutConfig {
  slots: Record<SlotId, WindowId | null>;
  leftWidthPx: number;
  rightWidthPx: number;
  leftTopPct: number;
  centerTopPct: number;
  rightTopPct: number;
  maximized: WindowId | null;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  slots: {
    leftTop: "state",
    leftBottom: "flow",
    centerTop: "code",
    centerBottom: "terminal",
    rightTop: "mentor",
    rightBottom: null,
  },
  leftWidthPx: 370,
  rightWidthPx: 360,
  leftTopPct: 60,
  centerTopPct: 72,
  rightTopPct: 60,
  maximized: null,
};
