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

export interface CurriculumModule {
  id: string;
  tier: number;
  order: number;
  title: string;
  subtitle: str_or_string;
  concepts: string[];
  lesson_points: string[];
  example_code: string;
  quizzes: QuizQuestion[];
}

type str_or_string = string;

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
