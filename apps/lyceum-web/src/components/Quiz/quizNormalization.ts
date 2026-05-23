import type { NormalizedQuestion, QuizPayload, QuizQuestionPayload } from "./quizTypes";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "t" || normalized === "true" || normalized === "1" || normalized === "yes";
  }

  return false;
}

function normalizeAnswers(raw: unknown): number[] {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return [raw];
  }

  if (typeof raw === "string") {
    const parsed = Number(raw.trim());
    return Number.isInteger(parsed) ? [parsed] : [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? Number(item.trim()) : item))
      .filter((item) => Number.isInteger(item))
      .map((item) => Number(item));
  }

  return [];
}

function normalizeQuestion(payload: QuizQuestionPayload | undefined): NormalizedQuestion | null {
  const questionText = payload?.question?.trim();
  if (!questionText) {
    return null;
  }

  const options = toStringArray(payload?.options);
  const correctAnswers = normalizeAnswers(payload?.answers ?? payload?.answer);

  return {
    prompt: questionText,
    options,
    correctAnswers,
    isMultiple: correctAnswers.length > 1,
    timed: normalizeBoolean(payload?.timed),
  };
}

export function normalizePayload(payload: QuizPayload): NormalizedQuestion[] {
  const questionBank = Array.isArray(payload.questionBank)
    ? payload.questionBank
    : Array.isArray(payload.question_bank)
      ? payload.question_bank
      : Array.isArray(payload.bank)
        ? payload.bank
        : payload.questions;

  const nestedQuestions = Array.isArray(questionBank)
    ? questionBank
        .map((rawQuestion) => normalizeQuestion(rawQuestion as QuizQuestionPayload))
        .filter((question): question is NormalizedQuestion => question !== null)
    : [];

  if (nestedQuestions.length > 0) {
    return nestedQuestions;
  }

  const single = normalizeQuestion(payload);
  return single ? [single] : [];
}

export function extractQuestionsPerAttempt(payload: QuizPayload, totalQuestions: number): number {
  const candidates = [
    payload.questionsPerAttempt,
    payload.questions_per_attempt,
    payload.questionCount,
    payload.question_count,
    payload.displayCount,
    payload.display_count,
  ];

  for (const candidate of candidates) {
    if (candidate === "" || candidate === null || candidate === undefined) {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.floor(parsed), totalQuestions);
    }
  }

  return totalQuestions;
}

export function extractTimeLimit(payload: QuizPayload): number | null {
  const candidates = [payload.timeLimit, payload.time_limit, payload.timeLimitSeconds, payload.time_limit_seconds];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
}

export function extractMaxAttempts(payload: QuizPayload): number | null {
  const candidates = [payload.maxAttempts, payload.max_attempts, payload.attemptLimit, payload.attempt_limit];

  for (const candidate of candidates) {
    if (candidate === "" || candidate === null || candidate === undefined) {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
}

export function extractPassPercentage(payload: QuizPayload): number | null {
  const candidates = [payload.passPercentage, payload.pass_percentage, payload.passPercent, payload.pass_percent];

  for (const candidate of candidates) {
    if (candidate === "" || candidate === null || candidate === undefined) {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  return null;
}

export function shouldShowAnswersFromPayload(payload: QuizPayload): boolean {
  return normalizeBoolean(
    payload.showAnswers ?? payload.show_answers ?? payload.showCorrectAnswers ?? payload.show_correct_answers
  );
}
