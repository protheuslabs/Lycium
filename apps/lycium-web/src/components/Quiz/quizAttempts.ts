import type { AttemptHistoryItem, AttemptOrderItem, NormalizedQuestion } from "./quizTypes";

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function timestampToMs(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function secondsSince(startedAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let idx = shuffled.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(Math.random() * (idx + 1));
    [shuffled[idx], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[idx]];
  }
  return shuffled;
}

export function attemptSignature(order: AttemptOrderItem[]): string {
  return order.map((item) => `${item.questionIndex}:${item.optionOrder.join(".")}`).join("|");
}

function canAttemptVary(questionBank: NormalizedQuestion[], questionsPerAttempt: number): boolean {
  return (
    questionBank.length > questionsPerAttempt ||
    questionsPerAttempt > 1 ||
    questionBank.some((question) => question.options.length > 1)
  );
}

export function createAttemptOrder(
  questionBank: NormalizedQuestion[],
  questionsPerAttempt: number,
  previousSignature?: string | null
): AttemptOrderItem[] {
  const makeOrder = () => {
    const questionIndexes = shuffleArray(questionBank.map((_, idx) => idx)).slice(0, questionsPerAttempt);
    return questionIndexes.map((questionIndex) => ({
      questionIndex,
      optionOrder: shuffleArray(questionBank[questionIndex].options.map((_, idx) => idx)),
    }));
  };

  let order = makeOrder();
  const shouldAvoidPrevious = Boolean(previousSignature) && canAttemptVary(questionBank, questionsPerAttempt);
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

export function parseAttemptOrder(value: unknown, questionBank: NormalizedQuestion[]): AttemptOrderItem[] | null {
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
            .filter(
              (optionIndex) =>
                Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < question.options.length
            )
        : [];
      const normalizedOptionOrder =
        optionOrder.length === question.options.length ? optionOrder : question.options.map((_, idx) => idx);
      return { questionIndex, optionOrder: normalizedOptionOrder };
    })
    .filter((item): item is AttemptOrderItem => item !== null);

  return parsed.length > 0 ? parsed : null;
}

export function buildAttemptQuestions(
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
        item.optionOrder.length === question.options.length ? item.optionOrder : question.options.map((_, idx) => idx);
      const options = optionOrder.map((optionIndex) => question.options[optionIndex]);
      const correctAnswers = optionOrder
        .map((originalOptionIndex, displayedOptionIndex) =>
          question.correctAnswers.includes(originalOptionIndex) ? displayedOptionIndex : null
        )
        .filter((optionIndex): optionIndex is number => optionIndex !== null);

      return { ...question, options, correctAnswers, isMultiple: correctAnswers.length > 1 };
    })
    .filter((question): question is NormalizedQuestion => question !== null);
}

export function parseAttemptHistory(value: unknown, questionBank: NormalizedQuestion[]): AttemptHistoryItem[] {
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

      const parsedItem: AttemptHistoryItem = {
        attemptNumber: Math.max(1, Math.floor(attemptNumber)),
        elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
        scorePercentage: Math.max(0, Math.min(100, scorePercentage)),
        submittedAt: raw.submittedAt,
      };

      if (Number.isFinite(correctCount)) {
        parsedItem.correctCount = Math.max(0, Math.floor(correctCount));
      }

      if (Number.isFinite(totalQuestions)) {
        parsedItem.totalQuestions = Math.max(0, Math.floor(totalQuestions));
      }

      const attemptOrder = parseAttemptOrder(raw.attemptOrder, questionBank);
      if (attemptOrder) {
        parsedItem.attemptOrder = attemptOrder;
      }

      if (Array.isArray(raw.selectedByQuestion)) {
        parsedItem.selectedByQuestion = raw.selectedByQuestion.map((selection) =>
          Array.isArray(selection)
            ? selection.filter((item) => Number.isInteger(item)).map((item) => Number(item))
            : []
        );
      }

      if (Array.isArray(raw.questionCorrectness)) {
        parsedItem.questionCorrectness = raw.questionCorrectness.map((value) => value === true);
      }

      return parsedItem;
    })
    .filter((item): item is AttemptHistoryItem => item !== null);
}

export function areSelectionsCorrect(correctAnswers: number[], selected: number[]): boolean {
  if (correctAnswers.length !== selected.length) {
    return false;
  }

  const sortedCorrect = [...correctAnswers].sort((a, b) => a - b);
  const sortedSelected = [...selected].sort((a, b) => a - b);
  return sortedCorrect.every((item, index) => item === sortedSelected[index]);
}
