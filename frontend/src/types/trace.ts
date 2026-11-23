export type VariableShape =
  | "number"
  | "string"
  | "bool"
  | "list"
  | "dict"
  | "grid2d"
  | "none"
  | "other";

export interface VariableSnapshot {
  type: string;
  shape: VariableShape;
  value: unknown;
  repr: string;
}

export interface VariableUpdate {
  before: string;
  after: string;
  delta: number | null;
}

export interface VariableChanges {
  created: string[];
  updated: Record<string, VariableUpdate>;
  deleted: string[];
}

export interface StackEntry {
  function: string;
  line: number;
}

export interface TraceFrame {
  step: number;
  event: "line" | "call" | "return" | "exception";
  line: number;
  function: string;
  call_stack: StackEntry[];
  variables: Record<string, VariableSnapshot>;
  changes: VariableChanges;
  return_value: string | null;
  exception: string | null;
  stdout: string;
  branch_info: string | null;
}

export interface TraceResult {
  frames: TraceFrame[];
  total_steps: number;
  truncated: boolean;
  error: string | null;
}

export interface GlossarySpan {
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
  kind: string;
  title: string;
  plain_english: string;
}

export interface TraceResponse {
  trace: TraceResult;
  glossary: GlossarySpan[];
}

export interface PresetLesson {
  id: string;
  title: string;
  project_link: string;
  difficulty: string;
  summary: string;
  concepts: string[];
  watch_for: string;
  code: string;
}

export interface AiConfigPublic {
  enabled: boolean;
  provider_url: string;
  default_model: string;
  has_api_key: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  ai_config: AiConfigPublic;
  llama_router: {
    online: boolean;
    disabled?: boolean;
    models?: string[];
    error?: string;
  };
}
