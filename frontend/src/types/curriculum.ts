export type QuizKind = "predict" | "spot_bug" | "reorder" | "explain";

export interface QuizQuestion {
  id: string;
  kind: QuizKind;
  title: string;
  prompt: string;
  code: string;
  options: string[];
  blocks: string[];
  correct_index: number | null;
  correct_line: number | null;
  correct_order: number[];
  rubric_keywords: string[];
  sample_explanation: string;
  explanation: string;
}

export type DifficultyLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";
export type LessonSource = "builtin" | "pack" | "custom";

export interface CurriculumModule {
  id: string;
  track: string;
  difficulty: DifficultyLevel;
  source?: LessonSource;
  tier: number;
  order: number;
  title: string;
  subtitle: string;
  prerequisites: string[];
  concepts: string[];
  lesson_points: string[];
  example_code: string;
  quizzes: QuizQuestion[];
}

export interface LessonVerificationResult {
  valid: boolean;
  example_ok: boolean;
  example_steps: number;
  example_error: string | null;
  quiz_errors: string[];
  warnings: string[];
}

export interface LessonPack {
  schema_version: number;
  module: CurriculumModule;
}

export interface ReviewItem {
  quiz: QuizQuestion;
  module_id: string | null;
  module_title: string;
  reason: "missed" | "review" | "new";
}

export interface ReviewQueueResponse {
  items: ReviewItem[];
  due_count: number;
  breakdown: {
    missed: number;
    passed: number;
    unattempted: number;
  };
}

export interface ComplexitySideSpec {
  label: string;
  big_o: string;
  description: string;
}

export interface ComplexityPairMeta {
  id: string;
  title: string;
  subtitle: string;
  min_n: number;
  max_n: number;
  step_n: number;
  default_n: number;
  takeaway: string;
  left: ComplexitySideSpec;
  right: ComplexitySideSpec;
}

export interface ComplexityRunSide extends ComplexitySideSpec {
  steps: number;
  truncated: boolean;
  error: string | null;
  code: string;
}

export interface ComplexityRunResponse {
  pair: ComplexityPairMeta;
  n: number;
  left: ComplexityRunSide;
  right: ComplexityRunSide;
}

export interface CurriculumProgress {
  mastery: Record<string, { status: string; score: number }>;
  quizzes: Record<string, { module_id: string | null; correct: boolean; score: number }>;
}

export interface CurriculumResponse {
  placement: QuizQuestion[];
  modules: CurriculumModule[];
  progress: CurriculumProgress;
}

export interface QuizAnswerResponse {
  correct: boolean;
  score: number;
  feedback: string;
  expected: unknown;
  ai_graded: boolean;
  module_id: string | null;
  progress: CurriculumProgress;
}
