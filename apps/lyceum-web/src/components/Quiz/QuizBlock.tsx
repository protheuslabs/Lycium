import { useCallback, useEffect, useMemo, useState } from "react";
import "./quiz.css";

type QuizQuestionPayload = {
  question?: string;
  options?: unknown;
  answer?: unknown;
  answers?: unknown;
  timed?: "t" | "f" | boolean;
};

type QuizPayload = {
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

type NormalizedQuestion = {
  prompt: string;
  options: string[];
  correctAnswers: number[];
  isMultiple: boolean;
  timed: boolean;
};

type AttemptOrderItem = {
  questionIndex: number;
  optionOrder: number[];
};

type AttemptHistoryItem = {
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeBoolean(value: unknown): boolean {
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

function normalizePayload(payload: QuizPayload): NormalizedQuestion[] {
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

function extractQuestionsPerAttempt(payload: QuizPayload, totalQuestions: number): number {
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

function extractTimeLimit(payload: QuizPayload): number | null {
  const candidates = [
    payload.timeLimit,
    payload.time_limit,
    payload.timeLimitSeconds,
    payload.time_limit_seconds,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
}

function extractMaxAttempts(payload: QuizPayload): number | null {
  const candidates = [
    payload.maxAttempts,
    payload.max_attempts,
    payload.attemptLimit,
    payload.attempt_limit,
  ];

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

function extractPassPercentage(payload: QuizPayload): number | null {
  const candidates = [
    payload.passPercentage,
    payload.pass_percentage,
    payload.passPercent,
    payload.pass_percent,
  ];

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

function shouldShowAnswersFromPayload(payload: QuizPayload): boolean {
  return normalizeBoolean(
    payload.showAnswers ??
      payload.show_answers ??
      payload.showCorrectAnswers ??
      payload.show_correct_answers
  );
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function timestampToMs(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsSince(startedAtMs: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let idx = shuffled.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(Math.random() * (idx + 1));
    [shuffled[idx], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[idx]];
  }

  return shuffled;
}

function attemptSignature(order: AttemptOrderItem[]): string {
  return order
    .map((item) => `${item.questionIndex}:${item.optionOrder.join(".")}`)
    .join("|");
}

function canAttemptVary(questionBank: NormalizedQuestion[], questionsPerAttempt: number): boolean {
  return (
    questionBank.length > questionsPerAttempt ||
    questionsPerAttempt > 1 ||
    questionBank.some((question) => question.options.length > 1)
  );
}

function createAttemptOrder(
  questionBank: NormalizedQuestion[],
  questionsPerAttempt: number,
  previousSignature?: string | null
): AttemptOrderItem[] {
  const makeOrder = () => {
    const questionIndexes = shuffleArray(questionBank.map((_, idx) => idx))
      .slice(0, questionsPerAttempt);

    return questionIndexes.map((questionIndex) => ({
      questionIndex,
      optionOrder: shuffleArray(questionBank[questionIndex].options.map((_, idx) => idx)),
    }));
  };

  let order = makeOrder();
  const shouldAvoidPrevious =
    Boolean(previousSignature) && canAttemptVary(questionBank, questionsPerAttempt);

  if (!shouldAvoidPrevious) {
    return order;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (attemptSignature(order) !== previousSignature) {
      return order;
    }

    order = makeOrder();
  }

  if (order.length > 1) {
    return [order[1], order[0], ...order.slice(2)];
  }

  if (order[0]?.optionOrder.length > 1) {
    const [first, second, ...rest] = order[0].optionOrder;
    return [{ ...order[0], optionOrder: [second, first, ...rest] }];
  }

  return order;
}

function parseAttemptOrder(value: unknown, questionBank: NormalizedQuestion[]): AttemptOrderItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const questionIndex = Number((item as AttemptOrderItem).questionIndex);
      const question = questionBank[questionIndex];

      if (!Number.isInteger(questionIndex) || !question) {
        return null;
      }

      const optionOrder = Array.isArray((item as AttemptOrderItem).optionOrder)
        ? (item as AttemptOrderItem).optionOrder
            .map((optionIndex) => Number(optionIndex))
            .filter((optionIndex) =>
              Number.isInteger(optionIndex) &&
              optionIndex >= 0 &&
              optionIndex < question.options.length
            )
        : [];

      const normalizedOptionOrder =
        optionOrder.length === question.options.length
          ? optionOrder
          : question.options.map((_, idx) => idx);

      return { questionIndex, optionOrder: normalizedOptionOrder };
    })
    .filter((item): item is AttemptOrderItem => item !== null);

  return parsed.length > 0 ? parsed : null;
}

function buildAttemptQuestions(
  questionBank: NormalizedQuestion[],
  attemptOrder: AttemptOrderItem[]
): NormalizedQuestion[] {
  return attemptOrder
    .map((item) => {
      const question = questionBank[item.questionIndex];

      if (!question) {
        return null;
      }

      const optionOrder =
        item.optionOrder.length === question.options.length
          ? item.optionOrder
          : question.options.map((_, idx) => idx);
      const options = optionOrder.map((optionIndex) => question.options[optionIndex]);
      const correctAnswers = optionOrder
        .map((originalOptionIndex, displayedOptionIndex) =>
          question.correctAnswers.includes(originalOptionIndex) ? displayedOptionIndex : null
        )
        .filter((optionIndex): optionIndex is number => optionIndex !== null);

      return {
        ...question,
        options,
        correctAnswers,
        isMultiple: correctAnswers.length > 1,
      };
    })
    .filter((question): question is NormalizedQuestion => question !== null);
}

function parseAttemptHistory(value: unknown, questionBank: NormalizedQuestion[]): AttemptHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as AttemptHistoryItem;
      const attemptNumber = Number(raw.attemptNumber);
      const elapsedSeconds = Number(raw.elapsedSeconds);
      const scorePercentage = Number(raw.scorePercentage);
      const correctCount = Number(raw.correctCount);
      const totalQuestions = Number(raw.totalQuestions);

      if (
        !Number.isFinite(attemptNumber) ||
        !Number.isFinite(elapsedSeconds) ||
        !Number.isFinite(scorePercentage) ||
        typeof raw.submittedAt !== "string"
      ) {
        return null;
      }

      return {
        attemptNumber: Math.max(1, Math.floor(attemptNumber)),
        elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
        scorePercentage: Math.max(0, Math.min(100, scorePercentage)),
        correctCount: Number.isFinite(correctCount) ? Math.max(0, Math.floor(correctCount)) : undefined,
        totalQuestions: Number.isFinite(totalQuestions) ? Math.max(0, Math.floor(totalQuestions)) : undefined,
        submittedAt: raw.submittedAt,
        attemptOrder: parseAttemptOrder(raw.attemptOrder, questionBank) ?? undefined,
        selectedByQuestion: Array.isArray(raw.selectedByQuestion)
          ? raw.selectedByQuestion.map((selection) =>
              Array.isArray(selection)
                ? selection.filter((item) => Number.isInteger(item)).map((item) => Number(item))
                : []
            )
          : undefined,
        questionCorrectness: Array.isArray(raw.questionCorrectness)
          ? raw.questionCorrectness.map((value) => value === true)
          : undefined,
      };
    })
    .filter((item): item is AttemptHistoryItem => item !== null);
}

function areSelectionsCorrect(correctAnswers: number[], selected: number[]): boolean {
  if (correctAnswers.length !== selected.length) {
    return false;
  }

  const sortedCorrect = [...correctAnswers].sort((a, b) => a - b);
  const sortedSelected = [...selected].sort((a, b) => a - b);

  return sortedCorrect.every((item, index) => item === sortedSelected[index]);
}

export default function QuizBlock({
  data,
  name,
  onSubmissionChange,
}: {
  data: QuizPayload;
  name: string;
  onSubmissionChange?: (quizKey: string, submitted: boolean) => void;
}) {
  const questionBank = useMemo(() => normalizePayload(data), [data]);
  const questionsPerAttempt = useMemo(
    () => extractQuestionsPerAttempt(data, questionBank.length),
    [data, questionBank.length]
  );
  const [attemptOrder, setAttemptOrder] = useState<AttemptOrderItem[]>([]);
  const questionsWithTiming = useMemo(
    () =>
      buildAttemptQuestions(questionBank, attemptOrder).map((question) => ({
        ...question,
        timed: question.timed || normalizeBoolean(data.timed),
      })),
    [attemptOrder, data.timed, questionBank]
  );

  const isTimed = questionsWithTiming.some((question) => question.timed);
  const timeLimit = extractTimeLimit(data);
  const maxAttempts = extractMaxAttempts(data);
  const passPercentage = extractPassPercentage(data);
  const showAnswers = shouldShowAnswersFromPayload(data);

  const timerDuration = useMemo(() => {
    if ((!isTimed && timeLimit === null) || timeLimit === null) {
      return null;
    }

    return timeLimit;
  }, [isTimed, timeLimit]);

  const [selectedByQuestion, setSelectedByQuestion] = useState<number[][]>(
    questionsWithTiming.map(() => [])
  );
  const [submitted, setSubmitted] = useState(false);
  const [questionCorrectness, setQuestionCorrectness] = useState<boolean[]>([]);
  const [questionMarked, setQuestionMarked] = useState<boolean[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [attemptHistory, setAttemptHistory] = useState<AttemptHistoryItem[]>([]);
  const [reviewAttemptNumber, setReviewAttemptNumber] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now());

  const markerStorageKey = useMemo(() => `lyceum-quiz-marker-${name || "quiz"}`, [name]);
  const quizProgressStorageKey = useMemo(() => `lyceum-quiz-progress-${name || "quiz"}`, [name]);

  useEffect(() => {
    let nextAttemptOrder: AttemptOrderItem[] = [];
    let nextSelectedByQuestion: number[][] = [];
    let nextQuestionCorrectness: boolean[] = [];
    let nextSubmitted = false;

    let nextStartedAtMs = Date.now();
    let nextAttemptCount = 0;
    let nextAttemptHistory: AttemptHistoryItem[] = [];
    let nextElapsedSeconds = 0;

    try {
      const stored = localStorage.getItem(quizProgressStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const storedStartedAtMs = timestampToMs(parsed?.startedAt);
      const hasSubmittedAttempt = parsed?.submitted === true && typeof parsed?.submittedAt === "string";
      const storedAttemptOrder = parseAttemptOrder(parsed?.attemptOrder, questionBank);
      const previousAttemptSignature =
        typeof parsed?.attemptSignature === "string"
          ? parsed.attemptSignature
          : typeof parsed?.previousAttemptSignature === "string"
            ? parsed.previousAttemptSignature
            : null;

      nextAttemptOrder =
        storedAttemptOrder ?? createAttemptOrder(questionBank, questionsPerAttempt, previousAttemptSignature);

      if (storedStartedAtMs !== null) {
        nextStartedAtMs = storedStartedAtMs;
      }

      if (Number.isFinite(Number(parsed?.attemptCount))) {
        nextAttemptCount = Math.max(0, Math.floor(Number(parsed.attemptCount)));
      }

      nextAttemptHistory = parseAttemptHistory(parsed?.attemptHistory, questionBank);

      if (hasSubmittedAttempt) {
        nextSubmitted = true;
        nextElapsedSeconds = Number.isFinite(Number(parsed?.elapsedSeconds))
          ? Math.max(0, Math.floor(Number(parsed.elapsedSeconds)))
          : secondsSince(nextStartedAtMs);
        nextQuestionCorrectness = Array.isArray(parsed?.questionCorrectness)
          ? parsed.questionCorrectness
              .slice(0, nextAttemptOrder.length)
              .map((value: unknown) => value === true)
          : [];

        if (nextAttemptHistory.length === 0) {
          const correctCount = nextQuestionCorrectness.filter(Boolean).length;
          const totalQuestions = nextAttemptOrder.length;
          const scorePercentage =
            totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
          nextAttemptHistory = [
            {
              attemptNumber: Math.max(1, nextAttemptCount),
              elapsedSeconds: nextElapsedSeconds,
              scorePercentage,
              correctCount,
              totalQuestions,
              submittedAt: parsed.submittedAt,
              attemptOrder: nextAttemptOrder,
              selectedByQuestion: nextSelectedByQuestion,
              questionCorrectness: nextQuestionCorrectness,
            },
          ];
        }

        if (Array.isArray(parsed?.selectedByQuestion)) {
          const restoredSelectedByQuestion = parsed.selectedByQuestion
            .slice(0, nextAttemptOrder.length)
            .map((selection: unknown) =>
              Array.isArray(selection)
                ? selection.filter((item) => Number.isInteger(item)).map((item) => Number(item))
                : []
            );
          nextSelectedByQuestion = nextAttemptOrder.map(
            (_, index) => restoredSelectedByQuestion[index] ?? []
          );
        }
      } else {
        nextElapsedSeconds = secondsSince(nextStartedAtMs);
      }
    } catch {
      // Ignore invalid progress data and start a fresh active attempt.
    }

    if (nextAttemptOrder.length === 0 && questionBank.length > 0) {
      nextAttemptOrder = createAttemptOrder(questionBank, questionsPerAttempt);
    }

    if (nextSelectedByQuestion.length === 0) {
      nextSelectedByQuestion = nextAttemptOrder.map(() => []);
    }

    setAttemptOrder(nextAttemptOrder);
    setSelectedByQuestion(nextSelectedByQuestion);
    setQuestionCorrectness(nextQuestionCorrectness);
    setSubmitted(nextSubmitted);
    setQuestionMarked(Array(nextAttemptOrder.length).fill(false));
    setReviewAttemptNumber(null);
    setStartedAtMs(nextStartedAtMs);
    setAttemptCount(nextAttemptCount);
    setAttemptHistory(nextAttemptHistory);
    setElapsedSeconds(nextElapsedSeconds);

    if (!nextSubmitted) {
      localStorage.setItem(
        quizProgressStorageKey,
        JSON.stringify({
          startedAt: new Date(nextStartedAtMs).toISOString(),
          attemptCount: nextAttemptCount,
          attemptHistory: nextAttemptHistory,
          submitted: false,
          attemptOrder: nextAttemptOrder,
          attemptSignature: attemptSignature(nextAttemptOrder),
        })
      );
    }

    onSubmissionChange?.(name, nextSubmitted);
  }, [name, onSubmissionChange, questionBank, questionsPerAttempt, quizProgressStorageKey, timerDuration]);

  useEffect(() => {
    const stored = localStorage.getItem(markerStorageKey);
    if (!stored) {
      setQuestionMarked(Array(questionsWithTiming.length).fill(false));
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .slice(0, questionsWithTiming.length)
          .map((value) => value === true);
        const padded = normalized.concat(
          Array(Math.max(0, questionsWithTiming.length - normalized.length)).fill(false)
        );
        setQuestionMarked(padded);
        return;
      }
    } catch {
      // Ignore invalid storage values and reset to false.
    }

    setQuestionMarked(Array(questionsWithTiming.length).fill(false));
  }, [markerStorageKey, questionsWithTiming.length]);

  const handleSubmit = useCallback(() => {
    const results = questionsWithTiming.map((question, idx) => {
      const selected = selectedByQuestion[idx] ?? [];
      return areSelectionsCorrect(question.correctAnswers, selected);
    });
    const finalElapsedSeconds = secondsSince(startedAtMs);
    const normalizedElapsedSeconds =
      timerDuration === null ? finalElapsedSeconds : Math.min(finalElapsedSeconds, timerDuration);
    const scorePercentage =
      questionsWithTiming.length > 0
        ? (results.filter(Boolean).length / questionsWithTiming.length) * 100
        : 0;
    const correctCount = results.filter(Boolean).length;
    const totalQuestions = questionsWithTiming.length;
    const nextAttemptCount = attemptCount + 1;
    const nextAttemptHistory = [
      ...attemptHistory,
      {
        attemptNumber: nextAttemptCount,
        elapsedSeconds: normalizedElapsedSeconds,
        scorePercentage,
        correctCount,
        totalQuestions,
        submittedAt: new Date().toISOString(),
        attemptOrder,
        selectedByQuestion,
        questionCorrectness: results,
      },
    ];

    setQuestionCorrectness(results);
    setSubmitted(true);
    setElapsedSeconds(normalizedElapsedSeconds);
    setAttemptCount(nextAttemptCount);
    setAttemptHistory(nextAttemptHistory);
    localStorage.setItem(
      quizProgressStorageKey,
      JSON.stringify({
        startedAt: new Date(startedAtMs).toISOString(),
        submittedAt: new Date().toISOString(),
        submitted: true,
        attemptCount: nextAttemptCount,
        attemptHistory: nextAttemptHistory,
        elapsedSeconds: normalizedElapsedSeconds,
        selectedByQuestion,
        questionCorrectness: results,
        attemptOrder,
        attemptSignature: attemptSignature(attemptOrder),
      })
    );
    onSubmissionChange?.(name, true);
  }, [attemptCount, attemptHistory, attemptOrder, name, onSubmissionChange, questionsWithTiming, quizProgressStorageKey, selectedByQuestion, startedAtMs, timerDuration]);

  useEffect(() => {
    if (submitted) {
      return;
    }

    if (timerDuration !== null && elapsedSeconds >= timerDuration) {
      handleSubmit();
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(() => {
        const next = secondsSince(startedAtMs);

        if (timerDuration !== null) {
          return Math.min(next, timerDuration);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerDuration, elapsedSeconds, submitted, handleSubmit, startedAtMs]);

  const allQuestionsAnswered = questionsWithTiming.every((_, idx) => (
    selectedByQuestion[idx] ?? []
  ).length > 0);

  const hasMultipleQuestions = questionsWithTiming.length > 1;
  const attemptLimitReached = maxAttempts !== null && attemptCount >= maxAttempts;
  const canTryAgain = submitted && !attemptLimitReached;
  const canSubmit = !submitted && !attemptLimitReached && allQuestionsAnswered;
  const currentAttempt = submitted || attemptLimitReached ? attemptCount : attemptCount + 1;
  const attemptsLabel = `${currentAttempt}/${maxAttempts ?? "∞"}`;
  const timeLabel = `${formatDuration(elapsedSeconds)}/${timerDuration === null ? "∞" : formatDuration(timerDuration)}`;
  const reviewAttempt = attemptHistory.find(
    (attempt) => attempt.attemptNumber === reviewAttemptNumber
  );
  const displayedQuestions =
    reviewAttempt?.attemptOrder
      ? buildAttemptQuestions(questionBank, reviewAttempt.attemptOrder)
      : questionsWithTiming;
  const displayedSelectedByQuestion =
    reviewAttempt?.selectedByQuestion ?? selectedByQuestion;
  const displayedQuestionCorrectness =
    reviewAttempt?.questionCorrectness ?? questionCorrectness;
  const isReviewingPastAttempt = Boolean(reviewAttempt);
  const displayedAttemptNumber = reviewAttempt?.attemptNumber ?? attemptCount;
  const shouldRevealAnswers =
    (submitted || isReviewingPastAttempt) &&
    (showAnswers || (maxAttempts !== null && displayedAttemptNumber >= maxAttempts));
  const scoreClassFor = (scorePercentage: number) => {
    if (passPercentage === null) {
      return "quiz-score--neutral";
    }

    return scorePercentage >= passPercentage ? "quiz-score--pass" : "quiz-score--fail";
  };
  const formatScore = (attempt: AttemptHistoryItem) => {
    const fallbackTotalQuestions =
      attempt.questionCorrectness?.length ?? attempt.attemptOrder?.length ?? null;
    const totalQuestions =
      typeof attempt.totalQuestions === "number" && attempt.totalQuestions > 0
        ? attempt.totalQuestions
        : fallbackTotalQuestions;
    const correctCount =
      typeof attempt.correctCount === "number"
        ? attempt.correctCount
        : attempt.questionCorrectness?.filter(Boolean).length;

    if (typeof correctCount === "number" && typeof totalQuestions === "number" && totalQuestions > 0) {
      return `${correctCount}/${totalQuestions} ${Math.round(attempt.scorePercentage)}%`;
    }

    return `${Math.round(attempt.scorePercentage)}%`;
  };
  const formatPassingScore = () => {
    if (passPercentage === null) {
      return "";
    }

    const totalQuestions = displayedQuestions.length;

    if (totalQuestions === 0) {
      return `${Math.round(passPercentage)}%`;
    }

    const requiredCorrect = Math.ceil((passPercentage / 100) * totalQuestions);
    return `${requiredCorrect}/${totalQuestions} ${Math.round(passPercentage)}%`;
  };
  const historicalAttempts = submitted ? attemptHistory.slice(0, -1) : attemptHistory;
  const currentAttemptResult = submitted ? attemptHistory[attemptHistory.length - 1] : null;

  const toggleQuestionMarker = (questionIndex: number) => {
    setQuestionMarked((prev) => {
      const nextState = [...prev];
      const nextValue = !nextState[questionIndex];
      nextState[questionIndex] = nextValue;
      localStorage.setItem(markerStorageKey, JSON.stringify(nextState));
      return nextState;
    });
  };

  const handleOptionSelect = (questionIndex: number, optionIndex: number, multiple: boolean) => {
    if (submitted || isReviewingPastAttempt) {
      return;
    }

    setSelectedByQuestion((prev) => {
      const nextState = prev.map((selection) => [...selection]);
      const selected = nextState[questionIndex] ?? [];

      if (multiple) {
        if (selected.includes(optionIndex)) {
          nextState[questionIndex] = selected.filter((item) => item !== optionIndex);
        } else {
          nextState[questionIndex] = [...selected, optionIndex];
        }
      } else {
        nextState[questionIndex] = [optionIndex];
      }

      return nextState;
    });
  };

  const handleReset = () => {
    const previousAttemptSignature = attemptSignature(attemptOrder);
    const nextAttemptOrder = createAttemptOrder(
      questionBank,
      questionsPerAttempt,
      previousAttemptSignature
    );
    setSubmitted(false);
    setQuestionCorrectness([]);
    setReviewAttemptNumber(null);
    setAttemptOrder(nextAttemptOrder);
    setSelectedByQuestion(nextAttemptOrder.map(() => []));
    setQuestionMarked(Array(nextAttemptOrder.length).fill(false));
    const nextStartedAtMs = Date.now();
    setStartedAtMs(nextStartedAtMs);
    setElapsedSeconds(0);
    localStorage.removeItem(markerStorageKey);
    localStorage.setItem(
      quizProgressStorageKey,
      JSON.stringify({
        startedAt: new Date(nextStartedAtMs).toISOString(),
        attemptCount,
        attemptHistory,
        submitted: false,
        attemptOrder: nextAttemptOrder,
        attemptSignature: attemptSignature(nextAttemptOrder),
        previousAttemptSignature,
      })
    );
    onSubmissionChange?.(name, false);
  };

  const handlePrimaryButton = () => {
    if (isReviewingPastAttempt) {
      setReviewAttemptNumber(null);
      return;
    }

    if (submitted) {
      if (canTryAgain) {
        handleReset();
      }
      return;
    }

    if (!canSubmit) {
      return;
    }

    handleSubmit();
  };

  if (questionsWithTiming.length === 0) {
    return (
      <div className="quiz-block">
        <p className="quiz-result quiz-incorrect">No quiz questions were found in this block.</p>
      </div>
    );
  }

  return (
    <div className="quiz-block">
      <div className="quiz-meta-stack" aria-label="Quiz metadata">
        {historicalAttempts.map((attempt) => (
          <button
            type="button"
            className={`quiz-meta-row quiz-meta-row--submitted ${
              reviewAttemptNumber === attempt.attemptNumber ? "quiz-meta-row--active" : ""
            }`}
            key={`${name}-attempt-${attempt.attemptNumber}`}
            onClick={() => setReviewAttemptNumber(attempt.attemptNumber)}
          >
            <span>Attempt {attempt.attemptNumber}/{maxAttempts ?? "∞"}</span>
            <span className={`quiz-score ${scoreClassFor(attempt.scorePercentage)}`}>
              Score: {formatScore(attempt)}
            </span>
            <span>
              Time: {formatDuration(attempt.elapsedSeconds)}/{timerDuration === null ? "∞" : formatDuration(timerDuration)}
            </span>
          </button>
        ))}

        <button
          type="button"
          className={`quiz-meta-row quiz-meta-row--current ${
            !isReviewingPastAttempt ? "quiz-meta-row--active" : ""
          }`}
          onClick={() => setReviewAttemptNumber(null)}
        >
          <span>Attempt {attemptsLabel}</span>
          {currentAttemptResult ? (
            <span className={`quiz-score ${scoreClassFor(currentAttemptResult.scorePercentage)}`}>
              Score: {formatScore(currentAttemptResult)}
            </span>
          ) : passPercentage !== null ? (
            <span className="quiz-score quiz-score--neutral">
              Passing score: {formatPassingScore()}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          <span>
            Time: {currentAttemptResult
              ? `${formatDuration(currentAttemptResult.elapsedSeconds)}/${timerDuration === null ? "∞" : formatDuration(timerDuration)}`
              : timeLabel}
          </span>
        </button>
      </div>

      {displayedQuestions.map((question, questionIndex) => {
        const selectedForQuestion = displayedSelectedByQuestion[questionIndex] ?? [];
        const isQuestionAnswered = selectedForQuestion.length > 0;
        const result = displayedQuestionCorrectness[questionIndex];

        return (
          <div key={`${name}-${questionIndex}`} className="quiz-question-block">
            <div className="quiz-question-header">
              <button
                type="button"
                className={`quiz-question-marker ${
                  questionMarked[questionIndex] ? "quiz-marker-marked" : ""
                }`}
                aria-label={
                  questionMarked[questionIndex]
                    ? "Unmark this question for review"
                    : "Mark this question for review"
                }
                onClick={() => toggleQuestionMarker(questionIndex)}
              />

              <h4 className="quiz-question">
                {hasMultipleQuestions ? `${questionIndex + 1}. ` : ""}
                {question.prompt}
              </h4>
            </div>

            <div className="quiz-options">
              {question.options.map((option, optionIndex) => {
                const isSelectedOption = selectedForQuestion.includes(optionIndex);
                const isCorrectOption = question.correctAnswers.includes(optionIndex);
                const showCorrectIndicator = shouldRevealAnswers && isCorrectOption;
                const showIncorrectIndicator = shouldRevealAnswers && isSelectedOption && !isCorrectOption;

                return (
                  <label
                    key={optionIndex}
                    className={`quiz-option ${
                      showCorrectIndicator
                        ? "quiz-option--correct-answer"
                        : showIncorrectIndicator
                          ? "quiz-option--wrong-selection"
                          : ""
                    }`}
                  >
                    <span className="quiz-option-control">
                      <input
                        type={question.isMultiple ? "checkbox" : "radio"}
                        name={`${name}-question-${questionIndex}`}
                        value={optionIndex}
                        checked={
                          question.isMultiple
                            ? isSelectedOption
                            : selectedForQuestion[0] === optionIndex
                        }
                        onChange={() =>
                          handleOptionSelect(questionIndex, optionIndex, question.isMultiple)
                        }
                        disabled={submitted || isReviewingPastAttempt}
                      />
                      {showCorrectIndicator && (
                        <span className="quiz-answer-indicator quiz-answer-indicator--correct">
                          ✓
                        </span>
                      )}
                      {showIncorrectIndicator && (
                        <span className="quiz-answer-indicator quiz-answer-indicator--incorrect">
                          ×
                        </span>
                      )}
                    </span>
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="quiz-actions">
        <button
          type="button"
          className="quiz-button"
          onClick={handlePrimaryButton}
          disabled={!isReviewingPastAttempt && !canSubmit && !canTryAgain}
        >
          {isReviewingPastAttempt
            ? "Back to current attempt"
            : submitted
              ? (canTryAgain ? "Try again" : "Attempts used")
              : "Submit"}
        </button>
      </div>
    </div>
  );
}
