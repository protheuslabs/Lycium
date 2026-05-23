export type QuizQuestionPayload = {
  question?: string;
  options?: unknown;
  answer?: unknown;
  answers?: unknown;
  timed?: "t" | "f" | boolean;
};

export type QuizPayload = {
  question?: string;
  options?: unknown;
  answer?: unknown;
  answers?: unknown;
  questions?: unknown;
  questionBank?: unknown;
  question_bank?: unknown;
  bank?: unknown;
  questionsPerAttempt?: unknown;
  questions_per_attempt?: unknown;
  questionCount?: unknown;
  question_count?: unknown;
  displayCount?: unknown;
  display_count?: unknown;
  timed?: "t" | "f" | boolean;
  maxAttempts?: unknown;
  max_attempts?: unknown;
  attemptLimit?: unknown;
  attempt_limit?: unknown;
  timeLimit?: unknown;
  time_limit?: unknown;
  timeLimitSeconds?: unknown;
  time_limit_seconds?: unknown;
  passPercentage?: unknown;
  pass_percentage?: unknown;
  passPercent?: unknown;
  pass_percent?: unknown;
  showAnswers?: unknown;
  show_answers?: unknown;
  showCorrectAnswers?: unknown;
  show_correct_answers?: unknown;
};

export type NormalizedQuestion = {
  prompt: string;
  options: string[];
  correctAnswers: number[];
  isMultiple: boolean;
  timed: boolean;
};

export type AttemptOrderItem = {
  questionIndex: number;
  optionOrder: number[];
};

export type AttemptHistoryItem = {
  attemptNumber: number;
  elapsedSeconds: number;
  scorePercentage: number;
  correctCount?: number;
  totalQuestions?: number;
  submittedAt: string;
  attemptOrder?: AttemptOrderItem[];
  selectedByQuestion?: number[][];
  questionCorrectness?: boolean[];
};
