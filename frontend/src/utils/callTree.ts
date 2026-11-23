import type { TraceFrame } from "../types/trace";

export interface CallTreeNode {
  id: string;
  functionName: string;
  argsSummary: string;
  returnValue: string | null;
  callStep: number;
  returnStep: number | null;
  depth: number;
  children: CallTreeNode[];
}

export function buildCallTree(frames: TraceFrame[]): CallTreeNode[] {
  if (frames.length === 0) return [];

  const root: CallTreeNode = {
    id: "root_0",
    functionName: "Main Program",
    argsSummary: "",
    returnValue: null,
    callStep: 0,
    returnStep: frames.length - 1,
    depth: 0,
    children: [],
  };

  const stack: CallTreeNode[] = [root];
  let counter = 0;

  for (const frame of frames) {
    if (frame.event === "call" && frame.function !== "<module>") {
      const argParts = Object.entries(frame.variables)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v.repr}`);
      const parent = stack[stack.length - 1] ?? root;
      const node: CallTreeNode = {
        id: `call_${++counter}`,
        functionName: frame.function,
        argsSummary: argParts.join(", "),
        returnValue: null,
        callStep: frame.step,
        returnStep: null,
        depth: stack.length,
        children: [],
      };
      parent.children.push(node);
      stack.push(node);
    } else if (frame.event === "return" && frame.function !== "<module>") {
      const popped = stack.length > 1 ? stack.pop() : undefined;
      if (popped) {
        popped.returnStep = frame.step;
        popped.returnValue = frame.return_value;
      }
    }
  }

  return [root];
}
