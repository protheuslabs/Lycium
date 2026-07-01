export type ConceptCard = {
  name?: string;
  description?: string;
  title?: string;
  heading?: string;
  body?: string;
  value?: string;
  text?: string;
  sourceIds?: string[];
};

export type ProjectRubricLevel = {
  label?: string;
  description?: string;
  points?: number | string;
};

export type ProjectRubricCriterion = {
  id?: string;
  title?: string;
  criterion?: string;
  description?: string;
  points?: number | string;
  levels?: ProjectRubricLevel[];
};

export type ProjectRubric = {
  id?: string;
  title?: string;
  criteria?: ProjectRubricCriterion[];
};

export type ProjectSubmissionInputType = "pdf" | "docx" | "image" | "text" | "link" | "file" | string;

export type ProjectSubmissionPolicy = {
  submissionType?: ProjectSubmissionInputType;
  submissionMethods?: string[];
  acceptedTypes?: ProjectSubmissionInputType[];
  acceptedFileTypes?: string[];
  instructions?: string;
  maxFiles?: number;
  maxFileSizeMb?: number;
};

export type ProjectGraderWorkflow = {
  grader?: "agent" | "admin" | "human" | string;
  rubricId?: string;
  status?: "ready" | "queued" | "graded" | "needs_review" | string;
  allowedContext?: string[];
  feedbackPolicy?: string;
};

export type ContentBlock = {
  type: string;
  value?: string;
  text?: string;
  body?: string;
  heading?: string;
  title?: string;
  url?: string;
  src?: string;
  imageUrl?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  license?: string;
  generatedBy?: string;
  clip?: {
    startSeconds?: number | string;
    endSeconds?: number | string;
    start?: number | string;
    end?: number | string;
  };
  startSeconds?: number | string;
  endSeconds?: number | string;
  start_seconds?: number | string;
  end_seconds?: number | string;
  sourceIds?: string[];
  cards?: Array<ConceptCard | string>;
  concepts?: Array<ConceptCard | string>;
  question?: string;
  questions?: Array<{
    question?: string;
    options?: string[];
    answer?: number;
    answers?: number[];
    multiple?: boolean;
    isMultiple?: boolean;
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
  instructions?: string;
  artifactType?: string;
  requiredEvidence?: string[];
  rubric?: ProjectRubric | ProjectRubricCriterion[];
  submission?: ProjectSubmissionPolicy;
  graderWorkflow?: ProjectGraderWorkflow;
};

export type Section = {
  id: string;
  title: string;
  content: ContentBlock[];
  displayNumber: string;
  moduleId?: string;
  sectionType?: string;
  pageType?: "learn" | "apply";
  sourceIds?: string[];
};

export type SourceRecord = {
  id: string;
  type: string;
  title: string;
  author?: string;
  publisher?: string;
  url?: string;
  embedUrl?: string;
  localPath?: string;
  usedByCourseIds?: string[];
  usedByCourseTitles?: string[];
};

export type QuizSubmissionStatusHandler = (quizKey: string, submitted: boolean) => void;
export type ProjectSubmissionStatusHandler = (projectKey: string, submitted: boolean) => void;

export type QuizProgressStatus = {
  submitted: boolean;
  inProgress: boolean;
  timed: boolean;
  passed: boolean;
};

export type QuizProgressStatusHandler = (quizKey: string, status: QuizProgressStatus) => void;
