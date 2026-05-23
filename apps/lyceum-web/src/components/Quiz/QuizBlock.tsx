/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import QuizMetaRows from "./QuizMetaRows";
import QuizQuestionList from "./QuizQuestionList";
import {
  areSelectionsCorrect,
  attemptSignature,
  buildAttemptQuestions,
  createAttemptOrder,
  formatDuration,
  parseAttemptHistory,
  parseAttemptOrder,
  secondsSince,
  timestampToMs,
} from "./quizAttempts";
import {
  extractMaxAttempts,
  extractPassPercentage,
  extractQuestionsPerAttempt,
  extractTimeLimit,
  normalizeBoolean,
  normalizePayload,
  shouldShowAnswersFromPayload,
} from "./quizNormalization";
import type { AttemptHistoryItem, AttemptOrderItem, QuizPayload } from "./quizTypes";
import "./quiz.css";

export default function QuizBlock({
  data,
  name,
  onSubmissionChange,
  onProgressChange,
}: {
  data: QuizPayload;
  name: string;
  onSubmissionChange?: (quizKey: string, submitted: boolean) => void;
  onProgressChange?: (
    quizKey: string,
    status: {
      submitted: boolean;
      inProgress: boolean;
      timed: boolean;
    }
  ) => void;
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

  const [selectedByQuestion, setSelectedByQuestion] = useState<number[][]>(questionsWithTiming.map(() => []));
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
          ? parsed.questionCorrectness.slice(0, nextAttemptOrder.length).map((value: unknown) => value === true)
          : [];

        if (Array.isArray(parsed?.selectedByQuestion)) {
          const restoredSelectedByQuestion = parsed.selectedByQuestion
            .slice(0, nextAttemptOrder.length)
            .map((selection: unknown) =>
              Array.isArray(selection)
                ? selection.filter((item) => Number.isInteger(item)).map((item) => Number(item))
                : []
            );
          nextSelectedByQuestion = nextAttemptOrder.map((_, index) => restoredSelectedByQuestion[index] ?? []);
        }

        if (nextAttemptHistory.length === 0) {
          const correctCount = nextQuestionCorrectness.filter(Boolean).length;
          const totalQuestions = nextAttemptOrder.length;
          const scorePercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
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
        const normalized = parsed.slice(0, questionsWithTiming.length).map((value) => value === true);
        const padded = normalized.concat(Array(Math.max(0, questionsWithTiming.length - normalized.length)).fill(false));
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
    const normalizedElapsedSeconds = timerDuration === null ? finalElapsedSeconds : Math.min(finalElapsedSeconds, timerDuration);
    const scorePercentage = questionsWithTiming.length > 0 ? (results.filter(Boolean).length / questionsWithTiming.length) * 100 : 0;
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
        return timerDuration !== null ? Math.min(next, timerDuration) : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerDuration, elapsedSeconds, submitted, handleSubmit, startedAtMs]);

  const allQuestionsAnswered = questionsWithTiming.every((_, idx) => (selectedByQuestion[idx] ?? []).length > 0);
  const hasMultipleQuestions = questionsWithTiming.length > 1;
  const attemptLimitReached = maxAttempts !== null && attemptCount >= maxAttempts;
  const canTryAgain = submitted && !attemptLimitReached;
  const canSubmit = !submitted && !attemptLimitReached && allQuestionsAnswered;
  const currentAttempt = submitted || attemptLimitReached ? attemptCount : attemptCount + 1;
  const attemptsLabel = `${currentAttempt}/${maxAttempts ?? "∞"}`;
  const timeLabel = `${formatDuration(elapsedSeconds)}/${timerDuration === null ? "∞" : formatDuration(timerDuration)}`;
  const hasQuizProgress = selectedByQuestion.some((selection) => selection.length > 0) || attemptHistory.length > 0;
  const isQuizInProgress = !submitted && hasQuizProgress;
  const reviewAttempt = attemptHistory.find((attempt) => attempt.attemptNumber === reviewAttemptNumber);
  const displayedQuestions = reviewAttempt?.attemptOrder ? buildAttemptQuestions(questionBank, reviewAttempt.attemptOrder) : questionsWithTiming;
  const displayedSelectedByQuestion = reviewAttempt?.selectedByQuestion ?? selectedByQuestion;
  const displayedQuestionCorrectness = reviewAttempt?.questionCorrectness ?? questionCorrectness;
  const isReviewingPastAttempt = Boolean(reviewAttempt);
  const displayedAttemptNumber = reviewAttempt?.attemptNumber ?? attemptCount;
  const shouldRevealAnswers =
    (submitted || isReviewingPastAttempt) &&
    (showAnswers || (maxAttempts !== null && displayedAttemptNumber >= maxAttempts));
  const historicalAttempts = submitted ? attemptHistory.slice(0, -1) : attemptHistory;
  const currentAttemptResult = submitted ? attemptHistory[attemptHistory.length - 1] : null;

  useEffect(() => {
    onProgressChange?.(name, {
      submitted,
      inProgress: isQuizInProgress,
      timed: timerDuration !== null || isTimed,
    });
  }, [isQuizInProgress, isTimed, name, onProgressChange, submitted, timerDuration]);

  const toggleQuestionMarker = (questionIndex: number) => {
    setQuestionMarked((prev) => {
      const nextState = [...prev];
      nextState[questionIndex] = !nextState[questionIndex];
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
        nextState[questionIndex] = selected.includes(optionIndex)
          ? selected.filter((item) => item !== optionIndex)
          : [...selected, optionIndex];
      } else {
        nextState[questionIndex] = [optionIndex];
      }
      return nextState;
    });
  };

  const handleReset = () => {
    const previousAttemptSignature = attemptSignature(attemptOrder);
    const nextAttemptOrder = createAttemptOrder(questionBank, questionsPerAttempt, previousAttemptSignature);
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

    if (canSubmit) {
      handleSubmit();
    }
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
      <QuizMetaRows
        name={name}
        historicalAttempts={historicalAttempts}
        currentAttemptResult={currentAttemptResult}
        reviewAttemptNumber={reviewAttemptNumber}
        maxAttempts={maxAttempts}
        passPercentage={passPercentage}
        timerDuration={timerDuration}
        attemptsLabel={attemptsLabel}
        timeLabel={timeLabel}
        isReviewingPastAttempt={isReviewingPastAttempt}
        displayedQuestionCount={displayedQuestions.length}
        onReviewAttemptChange={setReviewAttemptNumber}
      />

      <QuizQuestionList
        name={name}
        questions={displayedQuestions}
        selectedByQuestion={displayedSelectedByQuestion}
        questionCorrectness={displayedQuestionCorrectness}
        questionMarked={questionMarked}
        hasMultipleQuestions={hasMultipleQuestions}
        submitted={submitted}
        isReviewingPastAttempt={isReviewingPastAttempt}
        shouldRevealAnswers={shouldRevealAnswers}
        onToggleQuestionMarker={toggleQuestionMarker}
        onOptionSelect={handleOptionSelect}
      />

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
