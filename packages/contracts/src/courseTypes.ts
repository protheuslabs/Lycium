export const LYCIUM_COURSE_CONTRACT_VERSION = "0.1.0" as const;

export type LyciumPageType = "learn" | "apply";
export type LyciumSectionType = "lesson" | "assessment" | "summary" | string;

export type LyciumSourceRecord = {
  id: string;
  type?: string;
  title?: string;
  url?: string;
  embedUrl?: string;
  localPath?: string;
  usedByCourseIds?: string[];
  usedByCourseTitles?: string[];
  [key: string]: unknown;
};

export type LyciumCourseFeedbackRating = "up" | "down";
export type LyciumCourseFeedbackMagnitude = 1 | 2 | 3;

export type LyciumCourseSourceSuggestion = {
  id?: string;
  url: string;
  description?: string | null;
  created_at?: string;
};

export type LyciumCourseFeedbackNote = {
  id?: string;
  rating?: LyciumCourseFeedbackRating | null;
  feedback_magnitude?: LyciumCourseFeedbackMagnitude | null;
  text?: string | null;
  created_at?: string;
};

export type LyciumCourseFeedbackRatingEvent = {
  id?: string;
  rating: LyciumCourseFeedbackRating;
  created_at?: string;
};

export type LyciumCourseFeedbackRecord = {
  course_key: string;
  course_title?: string | null;
  rating?: LyciumCourseFeedbackRating | null;
  rating_events?: LyciumCourseFeedbackRatingEvent[];
  feedback_notes?: LyciumCourseFeedbackNote[];
  source_suggestions?: LyciumCourseSourceSuggestion[];
  updated_at?: string | null;
};

export type LyciumCourseFeedbackPayload = {
  course_key: string;
  course_title?: string | null;
  rating?: LyciumCourseFeedbackRating | null;
  feedback_text?: string | null;
  feedback_magnitude?: LyciumCourseFeedbackMagnitude | null;
  source_url?: string | null;
  source_description?: string | null;
};

export type LyciumCourseHealthStatus = "unknown" | "healthy" | "watch" | "needs_review";

export type LyciumCourseHealthRecord = {
  course_key: string;
  course_title?: string | null;
  status: LyciumCourseHealthStatus;
  score: number | null;
  latest_rating?: LyciumCourseFeedbackRating | null;
  rating_counts: Record<LyciumCourseFeedbackRating, number>;
  feedback_note_count: number;
  source_suggestion_count: number;
  average_feedback_magnitude: number | null;
  signals: string[];
  updated_at?: string | null;
};

export type LyciumCoursePrerequisite = {
  type: "course" | "competency" | "assessment" | "program" | "external";
  id?: string;
  title?: string;
  courseId?: string;
  competencyId?: string;
  assessmentId?: string;
  programId?: string;
  required?: boolean;
  minimumMasteryPercent?: number;
  rationale?: string;
};

export type LyciumCourseEquivalency = {
  institution?: string;
  department?: string;
  courseCode?: string;
  title: string;
  url?: string;
  catalogYear?: string;
  notes?: string;
};

export type LyciumConcept = {
  name?: string;
  description?: string;
  sourceSectionId?: string;
};

export type LyciumQuizQuestion = {
  question?: string;
  options?: string[];
  answer?: number;
  answers?: number[];
  timed?: "t" | "f" | boolean;
};

export type LyciumCourseBlock = {
  type: string;
  title?: string;
  value?: string;
  url?: string;
  sourceIds?: string[];
  concepts?: LyciumConcept[];
  question?: string;
  questions?: LyciumQuizQuestion[];
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

export type LyciumCourseSection = {
  id: string;
  title: string;
  content: LyciumCourseBlock[];
  sourceIds?: string[];
  pageType?: LyciumPageType;
  sectionType?: LyciumSectionType;
};

export type LyciumCourseModule = {
  id: string;
  title: string;
  sections: LyciumCourseSection[];
  sourceIds?: string[];
};

export type LyciumCourseData = {
  title: string;
  shortDescription?: string;
  difficultyLevel?: string;
  category?: string;
  department?: string;
  tags?: string[];
  learningTypes?: string[];
  courseEquivalencies?: LyciumCourseEquivalency[];
  orderMandatory?: boolean;
  prerequisites?: LyciumCoursePrerequisite[];
  sourceIds?: string[];
  sourceRecords?: LyciumSourceRecord[] | Record<string, LyciumSourceRecord | Record<string, unknown>>;
  metadata?: {
    pacingLabel?: "Module" | "Week" | string;
    [key: string]: unknown;
  };
  modules: LyciumCourseModule[];
};

export type LyciumCourseEntry = {
  key: string;
  title: string;
  data: LyciumCourseData;
  snapshotId?: number;
  source: "local" | "remote" | string;
  status?: LyciumCourseLifecycleStatus;
};

export type LyciumCourseLifecycleStatus =
  | "draft"
  | "generated"
  | "validating"
  | "needs_revision"
  | "ready_for_review"
  | "published"
  | "archived"
  | "failed";

export type LyciumCourseQualityGate = "generation" | "review" | "publish";

export type LyciumCourseGenerationGateStatus = "passed" | "needs_review" | "failed";

export type LyciumCourseGenerationGateIssue = {
  severity: "warning" | "error";
  message: string;
  location?: string | null;
};

export type LyciumCourseGenerationGateResult = {
  gate: string;
  status: LyciumCourseGenerationGateStatus;
  summary: string;
  artifacts: Record<string, unknown>;
  issues: LyciumCourseGenerationGateIssue[];
};

export type LyciumCourseGenerationWorkflowReport = {
  workflowVersion: string;
  status: LyciumCourseGenerationGateStatus;
  checkedAt: string;
  gates: LyciumCourseGenerationGateResult[];
  metrics: Record<string, number>;
};

export type LyciumCourseQualityReport = {
  gate: LyciumCourseQualityGate;
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
  evals?: LyciumCourseQualityEvalSuite;
  workflow?: LyciumCourseGenerationWorkflowReport;
  checkedAt: string;
  contractVersion?: string;
};

export type LyciumCourseQualityEvalFinding = {
  severity: "warning" | "error";
  message: string;
  location?: string | null;
};

export type LyciumCourseQualityEvalDimension = {
  key: string;
  label: string;
  weight: number;
  score: number;
  status: LyciumCourseGenerationGateStatus;
  findings: LyciumCourseQualityEvalFinding[];
  metrics: Record<string, number>;
};

export type LyciumCourseQualityEvalSuite = {
  evalVersion: string;
  status: LyciumCourseGenerationGateStatus;
  overallScore: number;
  dimensions: LyciumCourseQualityEvalDimension[];
  recommendations: string[];
  metrics: Record<string, number>;
};

export type LyciumSourceRecordLike = {
  id?: unknown;
};

export type LyciumCourseValidationOptions = {
  centralSourceRecords?: ReadonlyArray<LyciumSourceRecordLike>;
  requireSources?: boolean;
};

export type LyciumCourseValidationResult = {
  valid: boolean;
  errors: string[];
};

export type LearningBlockType = LyciumCourseBlock["type"];
export type SourceReference = LyciumSourceRecord;
export type LearningBlock = LyciumCourseBlock;
export type CourseSection = LyciumCourseSection;
export type CourseSnapshot = LyciumCourseData;

export type LyciumSectionStatus = "completed" | "locked" | "seen" | "timed";

export type LyciumProgressRecord = {
  completedSectionIds: string[];
  sectionStatuses: Record<string, LyciumSectionStatus>;
};

export type LyciumBookmarkRecord = {
  course_key?: string;
  course_title?: string | null;
  section_id?: string | null;
  section_title?: string | null;
  path?: string | null;
};

export type LyciumAgentModelRecord = {
  id: string;
  label?: string | null;
};

export type LyciumAgentProviderRecord = {
  id: string;
  label: string;
  default_model?: string | null;
  recommended_model?: string | null;
  minimum_recommended_parameters_billion?: number | null;
  model_recommendation_note?: string | null;
  model_fetch_supported?: boolean;
  generation_adapter?: string;
  local_provider?: boolean;
  credential_label?: string;
  credential_placeholder?: string;
  credential_default?: string;
  local_endpoint_candidates?: string[];
};

export type LyciumAgentKeyRecord = {
  id: string;
  provider_id: string;
  provider_label: string;
  key_preview: string;
  model?: string | null;
  models?: LyciumAgentModelRecord[];
  models_fetched_at?: string | null;
  connection_status?: "verified" | "unverified";
  connection_message?: string | null;
  last_verified_at?: string | null;
  last_error?: string | null;
  is_active: boolean;
};

export type LyciumThemeMode = "light" | "auto" | "dark";

export type LyciumLocalSettings = {
  agent_keys?: LyciumAgentKeyRecord[];
};

export type LyciumGeneratedCourseRecord = {
  id: string | number;
  title: string;
  structure: LyciumCourseData;
  status?: LyciumCourseLifecycleStatus;
  generation_trace?: Record<string, unknown>;
  qualityReport?: LyciumCourseQualityReport;
};

export type LyciumCourseGenerationRequest = {
  prompt: string;
  learner_id?: number;
  language?: string;
  level?: string;
  model?: string;
  source_policy?: string;
  free_only?: boolean;
  trust_min?: number;
  category?: string;
  department?: string;
  desired_module_count?: number;
  expected_duration_minutes?: number;
  source_urls?: string[];
};

export type LyciumCourseGenerationExperiment = {
  accepted: boolean;
  course: LyciumCourseData;
  quality_report: LyciumCourseQualityReport;
  trace: Record<string, unknown>;
};

export type LyciumCourseGenerationJobStatus = "queued" | "running" | "validating" | "ready" | "failed";

export type LyciumCourseGenerationJob = {
  id: string;
  status: LyciumCourseGenerationJobStatus;
  request: LyciumCourseGenerationRequest;
  progress?: number;
  current_stage?: string | null;
  message?: string | null;
  course?: LyciumCourseData | null;
  quality_report?: LyciumCourseQualityReport | null;
  trace?: Record<string, unknown>;
  course_snapshot?: LyciumGeneratedCourseRecord | null;
  error?: string | null;
  courseKey?: string;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
};

export type LyciumValidationReport = {
  valid: boolean;
  errors: string[];
  warnings?: string[];
};

export type LyciumQuizAttemptOrderItem = {
  questionIndex: number;
  optionOrder: number[];
};

export type LyciumQuizAttemptHistoryItem = {
  attemptNumber: number;
  elapsedSeconds: number;
  scorePercentage: number;
  correctCount?: number;
  totalQuestions?: number;
  submittedAt: string;
  attemptOrder?: LyciumQuizAttemptOrderItem[];
  selectedByQuestion?: number[][];
  questionCorrectness?: boolean[];
};

export type LyciumQuizProgressRecord = {
  startedAt?: string;
  submittedAt?: string;
  submitted?: boolean;
  attemptCount?: number;
  attemptHistory?: LyciumQuizAttemptHistoryItem[];
  elapsedSeconds?: number;
  selectedByQuestion?: number[][];
  questionCorrectness?: boolean[];
  attemptOrder?: LyciumQuizAttemptOrderItem[];
  attemptSignature?: string;
  previousAttemptSignature?: string;
};
