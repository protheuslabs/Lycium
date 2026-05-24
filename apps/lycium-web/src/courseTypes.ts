export type CourseBlock = {
  type: string;
  title?: string;
  value?: string;
  url?: string;
  sourceIds?: string[];
  concepts?: Array<{
    name?: string;
    description?: string;
    sourceSectionId?: string;
  }>;
  question?: string;
  questions?: Array<{
    question?: string;
    options?: string[];
    answer?: number;
    answers?: number[];
    timed?: "t" | "f" | boolean;
  }>;
  questionBank?: unknown;
  question_bank?: unknown;
  questionsPerAttempt?: number | string;
  questions_per_attempt?: number | string;
  questionCount?: number | string;
  question_count?: number | string;
  options?: string[];
  answer?: number;
  answers?: number[];
  name?: string;
  description?: string;
  timed?: "t" | "f" | boolean;
  maxAttempts?: number | string;
  max_attempts?: number | string;
  attemptLimit?: number | string;
  attempt_limit?: number | string;
  timeLimit?: number | string;
  time_limit?: number | string;
  timeLimitSeconds?: number | string;
  time_limit_seconds?: number | string;
  passPercentage?: number | string;
  pass_percentage?: number | string;
  passPercent?: number | string;
  pass_percent?: number | string;
  showAnswers?: boolean | string;
  show_answers?: boolean | string;
  showCorrectAnswers?: boolean | string;
  show_correct_answers?: boolean | string;
};

export type CourseSection = {
  id: string;
  title: string;
  content: CourseBlock[];
  sourceIds?: string[];
  pageType?: "learn" | "apply";
  sectionType?: "lesson" | "assessment" | "summary" | string;
};

export type CourseModule = {
  id: string;
  title: string;
  sections: CourseSection[];
  sourceIds?: string[];
};

export type CourseData = {
  title: string;
  shortDescription?: string;
  difficultyLevel?: string;
  category?: string;
  tags?: string[];
  learningTypes?: string[];
  orderMandatory?: boolean;
  sourceIds?: string[];
  sourceRecords?: Array<Record<string, unknown>> | Record<string, unknown>;
  metadata?: {
    pacingLabel?: "Module" | "Week" | string;
    [key: string]: unknown;
  };
  modules: CourseModule[];
};

export type CourseEntry = {
  key: string;
  title: string;
  data: CourseData;
  snapshotId?: number;
  source: "local" | "remote";
};

export type AgentModelRecord = {
  id: string;
  label?: string | null;
};

export type AgentProviderRecord = {
  id: string;
  label: string;
  default_model?: string | null;
  model_fetch_supported?: boolean;
  generation_adapter?: string;
};

export type AgentKeyRecord = {
  id: string;
  provider_id: string;
  provider_label: string;
  key_preview: string;
  model?: string | null;
  models?: AgentModelRecord[];
  models_fetched_at?: string | null;
  is_active: boolean;
};

export type ThemeMode = "light" | "auto" | "dark";

export type CourseBookmarkRecord = {
  course_key?: string;
  course_title?: string | null;
  section_id?: string | null;
  section_title?: string | null;
  path?: string | null;
};

export type SectionStatus = "completed" | "locked" | "seen" | "timed";

export type CourseProgressRecord = {
  completedSectionIds: string[];
  sectionStatuses: Record<string, SectionStatus>;
};

export type RouteInfo = {
  kind: "home" | "course" | "settings";
  courseSlug: string | null;
  unitSlug: string | null;
};
