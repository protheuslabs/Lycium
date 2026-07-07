import type { LyciumQuizProgressRecord } from "@lycium/contracts";
import {
  createAttemptOrder,
  parseAttemptHistory,
  parseAttemptOrder,
  secondsSince,
  timestampToMs,
} from "./quizAttempts";
import type { AttemptHistoryItem, AttemptOrderItem, NormalizedQuestion } from "./quizTypes";

export type QuizSessionState = {
  attemptOrder: AttemptOrderItem[];
  selectedByQuestion: number[][];
  submitted: boolean;
  questionCorrectness: boolean[];
  questionMarked: boolean[];
  attemptCount: number;
  attemptHistory: AttemptHistoryItem[];
  reviewAttemptNumber: number | null;
  elapsedSeconds: number;
  startedAtMs: number;
  attemptStarted: boolean;
};

type RestoreQuizSessionOptions = {
  isEditMode: boolean;
  questionBank: NormalizedQuestion[];
  questionsPerAttempt: number;
  persistedProgress?: LyciumQuizProgressRecord | null;
  persistedMarkers?: unknown;
  nowMs?: number;
};

function editorAttemptOrder(questionBank: NormalizedQuestion[]): AttemptOrderItem[] {
  return questionBank.map((question, questionIndex) => ({
    questionIndex,
    optionOrder: question.options.map((_, optionIndex) => optionIndex),
  }));
}

function normalizeMarkers(markers: unknown, questionCount: number): boolean[] {
  const normalized = Array.isArray(markers)
    ? markers.slice(0, questionCount).map((value) => value === true)
    : [];
  return normalized.concat(Array(Math.max(0, questionCount - normalized.length)).fill(false));
}

function normalizeSelections(value: unknown, questionCount: number): number[][] {
  const selections = Array.isArray(value)
    ? value.slice(0, questionCount).map((selection) =>
        Array.isArray(selection)
          ? selection.filter((item) => Number.isInteger(item)).map((item) => Number(item))
          : []
      )
    : [];
  return Array.from({ length: questionCount }, (_, index) => selections[index] ?? []);
}

export function restoreQuizSession({
  isEditMode,
  questionBank,
  questionsPerAttempt,
  persistedProgress,
  persistedMarkers,
  nowMs = Date.now(),
}: RestoreQuizSessionOptions): QuizSessionState {
  if (isEditMode) {
    const attemptOrder = editorAttemptOrder(questionBank);
    return {
      attemptOrder,
      selectedByQuestion: attemptOrder.map(() => []),
      submitted: false,
      questionCorrectness: [],
      questionMarked: attemptOrder.map(() => false),
      attemptCount: 0,
      attemptHistory: [],
      reviewAttemptNumber: null,
      elapsedSeconds: 0,
      startedAtMs: nowMs,
      attemptStarted: true,
    };
  }

  const parsed = persistedProgress;
  const storedStartedAtMs = timestampToMs(parsed?.startedAt);
  const hasSubmittedAttempt = parsed?.submitted === true && typeof parsed.submittedAt === "string";
  const hasStartedAttempt = parsed?.attemptStarted === true;
  const storedAttemptOrder = parseAttemptOrder(parsed?.attemptOrder, questionBank);
  const previousAttemptSignature =
    typeof parsed?.attemptSignature === "string"
      ? parsed.attemptSignature
      : typeof parsed?.previousAttemptSignature === "string"
        ? parsed.previousAttemptSignature
        : null;
  const startedAtMs = storedStartedAtMs ?? nowMs;
  const attemptCount = Number.isFinite(Number(parsed?.attemptCount))
    ? Math.max(0, Math.floor(Number(parsed?.attemptCount)))
    : 0;
  let attemptHistory = parseAttemptHistory(parsed?.attemptHistory, questionBank);
  let attemptOrder: AttemptOrderItem[] = [];
  let selectedByQuestion: number[][] = [];
  let questionCorrectness: boolean[] = [];
  let submitted = false;
  let attemptStarted = false;
  let elapsedSeconds = 0;

  if (hasSubmittedAttempt) {
    submitted = true;
    attemptStarted = true;
    attemptOrder = storedAttemptOrder ?? createAttemptOrder(questionBank, questionsPerAttempt, previousAttemptSignature);
    elapsedSeconds = Number.isFinite(Number(parsed?.elapsedSeconds))
      ? Math.max(0, Math.floor(Number(parsed?.elapsedSeconds)))
      : secondsSince(startedAtMs, nowMs);
    questionCorrectness = Array.isArray(parsed?.questionCorrectness)
      ? parsed.questionCorrectness.slice(0, attemptOrder.length).map((value) => value === true)
      : [];
    selectedByQuestion = normalizeSelections(parsed?.selectedByQuestion, attemptOrder.length);

    if (attemptHistory.length === 0) {
      const correctCount = questionCorrectness.filter(Boolean).length;
      const totalQuestions = attemptOrder.length;
      attemptHistory = [{
        attemptNumber: Math.max(1, attemptCount),
        elapsedSeconds,
        scorePercentage: totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0,
        correctCount,
        totalQuestions,
        submittedAt: parsed.submittedAt ?? new Date(nowMs).toISOString(),
        attemptOrder,
        selectedByQuestion,
        questionCorrectness,
      }];
    }
  } else if (hasStartedAttempt && storedStartedAtMs !== null && storedAttemptOrder) {
    attemptStarted = true;
    attemptOrder = storedAttemptOrder;
    elapsedSeconds = secondsSince(startedAtMs, nowMs);
  }

  if (selectedByQuestion.length === 0) {
    selectedByQuestion = attemptOrder.map(() => []);
  }

  return {
    attemptOrder,
    selectedByQuestion,
    submitted,
    questionCorrectness,
    questionMarked: normalizeMarkers(persistedMarkers, attemptOrder.length),
    attemptCount,
    attemptHistory,
    reviewAttemptNumber: null,
    elapsedSeconds,
    startedAtMs,
    attemptStarted,
  };
}
