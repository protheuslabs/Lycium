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
  timed?: "t" | "f" | boolean;
  timeLimit?: unknown;
  time_limit?: unknown;
  timeLimitSeconds?: unknown;
  time_limit_seconds?: unknown;
};

type NormalizedQuestion = {
  prompt: string;
  options: string[];
  correctAnswers: number[];
  isMultiple: boolean;
  timed: boolean;
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

  const options = toStringArray(payload.options);
  const correctAnswers = normalizeAnswers(payload.answers ?? payload.answer);

  return {
    prompt: questionText,
    options,
    correctAnswers,
    isMultiple: correctAnswers.length > 1,
    timed: normalizeBoolean(payload.timed),
  };
}

function normalizePayload(payload: QuizPayload): NormalizedQuestion[] {
  const nestedQuestions = Array.isArray(payload.questions)
    ? payload.questions
        .map((rawQuestion) => normalizeQuestion(rawQuestion as QuizQuestionPayload))
        .filter((question): question is NormalizedQuestion => question !== null)
    : [];

  if (nestedQuestions.length > 0) {
    return nestedQuestions;
  }

  const single = normalizeQuestion(payload);
  return single ? [single] : [];
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

function areSelectionsCorrect(correctAnswers: number[], selected: number[]): boolean {
  if (correctAnswers.length !== selected.length) {
    return false;
  }

  const sortedCorrect = [...correctAnswers].sort((a, b) => a - b);
  const sortedSelected = [...selected].sort((a, b) => a - b);

  return sortedCorrect.every((item, index) => item === sortedSelected[index]);
}

export default function QuizBlock({ data, name }: { data: QuizPayload; name: string }) {
  const normalizedQuestions = useMemo(() => normalizePayload(data), [data]);
  const questionsWithTiming = useMemo(
    () =>
      normalizedQuestions.map((question) => ({
        ...question,
        timed: question.timed || normalizeBoolean(data.timed),
      })),
    [data.timed, normalizedQuestions]
  );

  const isTimed = questionsWithTiming.some((question) => question.timed);
  const timeLimit = extractTimeLimit(data);

  const timerDuration = useMemo(() => {
    if (!isTimed || timeLimit === null) {
      return null;
    }

    return timeLimit;
  }, [isTimed, timeLimit]);

  const [selectedByQuestion, setSelectedByQuestion] = useState<number[][]>(
    questionsWithTiming.map(() => [])
  );
  const [submitted, setSubmitted] = useState(false);
  const [questionCorrectness, setQuestionCorrectness] = useState<boolean[]>([]);
  const [isMarked, setIsMarked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const markerStorageKey = useMemo(() => `lyceum-quiz-marker-${name || "quiz"}`, [name]);

  useEffect(() => {
    setSelectedByQuestion(questionsWithTiming.map(() => []));
    setQuestionCorrectness([]);
    setSubmitted(false);

    if (timerDuration === null) {
      setSecondsLeft(null);
      return;
    }

    setSecondsLeft(timerDuration);
  }, [questionsWithTiming, timerDuration]);

  useEffect(() => {
    const stored = localStorage.getItem(markerStorageKey);
    setIsMarked(stored === "true");
  }, [markerStorageKey]);

  const handleSubmit = useCallback(() => {
    const results = questionsWithTiming.map((question, idx) => {
      const selected = selectedByQuestion[idx] ?? [];
      return areSelectionsCorrect(question.correctAnswers, selected);
    });

    setQuestionCorrectness(results);
    setSubmitted(true);
    setSecondsLeft((current) => (current === null ? null : Math.max(0, current)));
  }, [questionsWithTiming, selectedByQuestion]);

  useEffect(() => {
    if (!isTimed || timerDuration === null || submitted) {
      return;
    }

    if (secondsLeft === null) {
      setSecondsLeft(timerDuration);
      return;
    }

    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current === null) {
          return null;
        }
        if (current <= 0) {
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimed, timerDuration, secondsLeft, submitted, handleSubmit]);

  const allQuestionsAnswered = questionsWithTiming.every(
    (question, idx) => (selectedByQuestion[idx] ?? []).length > 0
  );

  const allCorrect = questionCorrectness.length > 0 && questionCorrectness.every(Boolean);
  const hasMultipleQuestions = questionsWithTiming.length > 1;

  const toggleMarker = () => {
    const next = !isMarked;
    setIsMarked(next);
    localStorage.setItem(markerStorageKey, String(next));
  };

  const handleOptionSelect = (questionIndex: number, optionIndex: number, multiple: boolean) => {
    if (submitted) {
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
    setSubmitted(false);
    setQuestionCorrectness([]);
    setSelectedByQuestion(questionsWithTiming.map(() => []));

    if (timerDuration === null) {
      setSecondsLeft(null);
    } else {
      setSecondsLeft(timerDuration);
    }
  };

  const handlePrimaryButton = () => {
    if (submitted) {
      handleReset();
      return;
    }

    if (!allQuestionsAnswered) {
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
      <div className="quiz-header-row">
        <button
          type="button"
          className={`quiz-marker ${isMarked ? "quiz-marker-marked" : ""}`}
          aria-label={isMarked ? "Unmark for review" : "Mark for review"}
          onClick={toggleMarker}
        />

        {isTimed && timerDuration !== null && (
          <p className="quiz-timer">Time left: {Math.max(secondsLeft ?? 0, 0)}s</p>
        )}
      </div>

      {questionsWithTiming.map((question, questionIndex) => {
        const isQuestionAnswered = (selectedByQuestion[questionIndex] ?? []).length > 0;
        const result = questionCorrectness[questionIndex];

        return (
          <div key={`${name}-${questionIndex}`} className="quiz-question-block">
            <h4 className="quiz-question">
              {hasMultipleQuestions ? `${questionIndex + 1}. ` : ""}
              {question.prompt}
            </h4>

            <div className="quiz-options">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="quiz-option">
                  <input
                    type={question.isMultiple ? "checkbox" : "radio"}
                    name={`${name}-question-${questionIndex}`}
                    value={optionIndex}
                    checked={
                      question.isMultiple
                        ? (selectedByQuestion[questionIndex] ?? []).includes(optionIndex)
                        : (selectedByQuestion[questionIndex] ?? [])[0] === optionIndex
                    }
                    onChange={() =>
                      handleOptionSelect(questionIndex, optionIndex, question.isMultiple)
                    }
                    disabled={submitted}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>

            {submitted && (
              <p
                className={`quiz-result ${
                  result ? "quiz-correct" : "quiz-incorrect"
                }`}
              >
                {isQuestionAnswered
                  ? result
                    ? "Correct"
                    : "Not quite"
                  : "No answer submitted"}
              </p>
            )}
          </div>
        );
      })}

      <div className="quiz-actions">
        <button
          type="button"
          className="quiz-button"
          onClick={handlePrimaryButton}
          disabled={(!submitted && !allQuestionsAnswered)}
        >
          {submitted ? "Try again" : "Submit"}
        </button>
      </div>

      {submitted && (
        <p
          className={`quiz-summary ${allCorrect ? "quiz-correct" : "quiz-incorrect"}`}
        >
          {allCorrect
            ? "Great job! You answered everything correctly."
            : "Review the highlighted answers above and try again."}
        </p>
      )}
    </div>
  );
}
