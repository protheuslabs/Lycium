/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserStorageRepository } from "@lycium/data-access";
import { promptForDeleteBlock, promptForText } from "../ContentView/CourseEditControls";
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

const browserStorage = createBrowserStorageRepository();

export default function QuizBlock({
  data,
  name,
  isEditMode = false,
  onDataChange,
  onSubmissionChange,
  onProgressChange,
}: {
  data: QuizPayload;
  name: string;
  isEditMode?: boolean;
  onDataChange?: (data: QuizPayload) => void;
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

  useEffect(() => {
    if (isEditMode) {
      const editorAttemptOrder = questionBank.map((question, questionIndex) => ({
        questionIndex,
        optionOrder: question.options.map((_, optionIndex) => optionIndex),
      }));
      setAttemptOrder(editorAttemptOrder);
      setSelectedByQuestion(editorAttemptOrder.map(() => []));
      setQuestionCorrectness([]);
      setSubmitted(false);
      setQuestionMarked(Array(editorAttemptOrder.length).fill(false));
      setReviewAttemptNumber(null);
      setStartedAtMs(Date.now());
      setAttemptCount(0);
      setAttemptHistory([]);
      setElapsedSeconds(0);
      onSubmissionChange?.(name, false);
      return;
    }

    let nextAttemptOrder: AttemptOrderItem[] = [];
    let nextSelectedByQuestion: number[][] = [];
    let nextQuestionCorrectness: boolean[] = [];
    let nextSubmitted = false;
    let nextStartedAtMs = Date.now();
    let nextAttemptCount = 0;
    let nextAttemptHistory: AttemptHistoryItem[] = [];
    let nextElapsedSeconds = 0;

    try {
      const parsed = browserStorage.readQuizProgress(name);
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
        nextAttemptCount = Math.max(0, Math.floor(Number(parsed?.attemptCount)));
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
              submittedAt: typeof parsed?.submittedAt === "string" ? parsed.submittedAt : new Date().toISOString(),
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
      browserStorage.writeQuizProgress(
        name,
        {
          startedAt: new Date(nextStartedAtMs).toISOString(),
          attemptCount: nextAttemptCount,
          attemptHistory: nextAttemptHistory,
          submitted: false,
          attemptOrder: nextAttemptOrder,
          attemptSignature: attemptSignature(nextAttemptOrder),
        }
      );
    }

    onSubmissionChange?.(name, nextSubmitted);
  }, [isEditMode, name, onSubmissionChange, questionBank, questionsPerAttempt, timerDuration]);

  useEffect(() => {
    if (isEditMode) {
      setQuestionMarked(Array(questionsWithTiming.length).fill(false));
      return;
    }

    const stored = browserStorage.readQuizMarkers(name);
    if (!stored) {
      setQuestionMarked(Array(questionsWithTiming.length).fill(false));
      return;
    }

    if (Array.isArray(stored)) {
      const normalized = stored.slice(0, questionsWithTiming.length).map((value) => value === true);
      const padded = normalized.concat(Array(Math.max(0, questionsWithTiming.length - normalized.length)).fill(false));
      setQuestionMarked(padded);
      return;
    }

    setQuestionMarked(Array(questionsWithTiming.length).fill(false));
  }, [isEditMode, name, questionsWithTiming.length]);

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
    browserStorage.writeQuizProgress(
      name,
      {
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
      }
    );
    onSubmissionChange?.(name, true);
  }, [attemptCount, attemptHistory, attemptOrder, name, onSubmissionChange, questionsWithTiming, selectedByQuestion, startedAtMs, timerDuration]);

  useEffect(() => {
    if (isEditMode || submitted) {
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
  }, [isEditMode, timerDuration, elapsedSeconds, submitted, handleSubmit, startedAtMs]);

  const allQuestionsAnswered = questionsWithTiming.every((_, idx) => (selectedByQuestion[idx] ?? []).length > 0);
  const hasMultipleQuestions = questionsWithTiming.length > 1;
  const attemptLimitReached = maxAttempts !== null && attemptCount >= maxAttempts;
  const canTryAgain = submitted && !attemptLimitReached;
  const canSubmit = !isEditMode && !submitted && !attemptLimitReached && allQuestionsAnswered;
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

  const rawQuestions = useMemo(() => editableQuestionsFromPayload(data, questionBank), [data, questionBank]);
  const editorDisplayedQuestions = useMemo(
    () =>
      rawQuestions.map((question) => ({
        prompt: question.question,
        options: question.options,
        correctAnswers: question.answers,
        isMultiple: question.multiple,
        timed: false,
      })),
    [rawQuestions],
  );
  const activeDisplayedQuestions = isEditMode ? editorDisplayedQuestions : displayedQuestions;
  const updateQuizData = useCallback((nextData: QuizPayload) => onDataChange?.(nextData), [onDataChange]);

  const updateRawQuestions = useCallback(
    (questions: EditableQuizQuestion[]) => {
      updateQuizData({
        ...data,
        questions: questions.map((question) => ({
          question: question.question,
          options: question.options,
          multiple: question.multiple,
          ...(question.answers.length > 1 ? { answers: question.answers } : { answer: question.answers[0] ?? 0 }),
        })),
      });
    },
    [data, updateQuizData],
  );

  const editQuestion = useCallback(
    (questionIndex: number, question: string) => {
      updateRawQuestions(rawQuestions.map((currentQuestion, index) => (index === questionIndex ? { ...currentQuestion, question } : currentQuestion)));
    },
    [rawQuestions, updateRawQuestions],
  );

  const deleteQuestion = useCallback(
    (questionIndex: number) => {
      promptForDeleteBlock(
        () => updateRawQuestions(rawQuestions.filter((_, index) => index !== questionIndex)),
        "Delete question",
        "Are you sure you want to delete this question?",
      );
    },
    [rawQuestions, updateRawQuestions],
  );

  const addQuestion = useCallback((questionText: string) => {
    const questionNumber = rawQuestions.length + 1;
    updateRawQuestions([
      ...rawQuestions,
      {
        question: `Question ${questionNumber}: ${questionText.trim() || "Enter question"}`,
        options: ["Answer option A", "Answer option B"],
        answers: [0],
        multiple: false,
      },
    ]);
  }, [rawQuestions, updateRawQuestions]);

  const editAnswer = useCallback(
    (questionIndex: number, answerIndex: number, value: string) => {
      updateRawQuestions(
        rawQuestions.map((question, index) =>
          index === questionIndex
            ? {
                ...question,
                options: question.options.map((option, optionIndex) => (optionIndex === answerIndex ? value : option)),
              }
            : question,
        ),
      );
    },
    [rawQuestions, updateRawQuestions],
  );

  const deleteAnswer = useCallback(
    (questionIndex: number, answerIndex: number) => {
      promptForDeleteBlock(
        () =>
          updateRawQuestions(
            rawQuestions.map((question, index) => {
              if (index !== questionIndex) {
                return question;
              }

              const nextOptions = question.options.filter((_, optionIndex) => optionIndex !== answerIndex);
              const nextAnswers = question.answers
                .filter((answer) => answer !== answerIndex)
                .map((answer) => (answer > answerIndex ? answer - 1 : answer))
                .filter((answer) => answer >= 0 && answer < nextOptions.length);

              return {
                ...question,
                options: nextOptions,
                answers: nextAnswers.length > 0 ? nextAnswers : [0],
              };
            }),
          ),
        "Delete answer",
        "Are you sure you want to delete this answer?",
      );
    },
    [rawQuestions, updateRawQuestions],
  );

  const addAnswer = useCallback(
    (questionIndex: number) => {
      updateRawQuestions(
        rawQuestions.map((question, index) =>
          index === questionIndex
            ? {
                ...question,
                options: [...question.options, `Answer option ${question.options.length + 1}`],
              }
            : question,
        ),
      );
    },
    [rawQuestions, updateRawQuestions],
  );

  const toggleQuestionMultiple = useCallback(
    (questionIndex: number, isMultiple: boolean) => {
      updateRawQuestions(
        rawQuestions.map((question, index) =>
          index === questionIndex
            ? {
                ...question,
                multiple: isMultiple,
                answers: isMultiple ? question.answers : [question.answers[0] ?? 0],
              }
            : question,
        ),
      );
    },
    [rawQuestions, updateRawQuestions],
  );

  const setCorrectAnswer = useCallback(
    (questionIndex: number, optionIndex: number, isMultiple: boolean) => {
      updateRawQuestions(
        rawQuestions.map((question, index) => {
          if (index !== questionIndex) {
            return question;
          }

          if (!isMultiple) {
            return { ...question, answers: [optionIndex], multiple: false };
          }

          const answers = question.answers.includes(optionIndex)
            ? question.answers.filter((answer) => answer !== optionIndex)
            : [...question.answers, optionIndex];

          return {
            ...question,
            multiple: true,
            answers: answers.length > 0 ? answers : [optionIndex],
          };
        }),
      );
    },
    [rawQuestions, updateRawQuestions],
  );

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
      browserStorage.writeQuizMarkers(name, nextState);
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
    browserStorage.removeQuizMarkers(name);
    browserStorage.writeQuizProgress(
      name,
      {
        startedAt: new Date(nextStartedAtMs).toISOString(),
        attemptCount,
        attemptHistory,
        submitted: false,
        attemptOrder: nextAttemptOrder,
        attemptSignature: attemptSignature(nextAttemptOrder),
        previousAttemptSignature,
      }
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
        displayedQuestionCount={activeDisplayedQuestions.length}
        isEditMode={isEditMode}
        onMaxAttemptsChange={(value) => updateQuizData({ ...data, maxAttempts: value })}
        onTimeLimitChange={(value) => updateQuizData({ ...data, timeLimit: value })}
        onPassPercentageChange={(value) => updateQuizData({ ...data, passPercentage: value })}
        onReviewAttemptChange={setReviewAttemptNumber}
      />

      <QuizQuestionList
        name={name}
        questions={activeDisplayedQuestions}
        selectedByQuestion={displayedSelectedByQuestion}
        questionCorrectness={displayedQuestionCorrectness}
        questionMarked={questionMarked}
        hasMultipleQuestions={activeDisplayedQuestions.length > 1}
        submitted={submitted}
        isEditMode={isEditMode}
        isReviewingPastAttempt={isReviewingPastAttempt}
        shouldRevealAnswers={shouldRevealAnswers}
        onToggleQuestionMarker={toggleQuestionMarker}
        onOptionSelect={handleOptionSelect}
        onQuestionEdit={(questionIndex, prompt) => editQuestion(questionIndex, prompt)}
        onQuestionDelete={deleteQuestion}
        onQuestionAdd={() => promptForText("Add question", "", addQuestion)}
        onAnswerEdit={editAnswer}
        onAnswerDelete={deleteAnswer}
        onAnswerAdd={addAnswer}
        onQuestionMultipleChange={toggleQuestionMultiple}
        onCorrectAnswerChange={setCorrectAnswer}
      />

      <div className="quiz-actions">
        <button
          type="button"
          className="quiz-button"
          onClick={handlePrimaryButton}
          disabled={isEditMode || (!isReviewingPastAttempt && !canSubmit && !canTryAgain)}
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

type EditableQuizQuestion = {
  question: string;
  options: string[];
  answers: number[];
  multiple: boolean;
};

function editableQuestionsFromPayload(payload: QuizPayload, fallbackQuestions: Array<{ prompt: string; options: string[]; correctAnswers: number[] }>): EditableQuizQuestion[] {
  const rawBank = Array.isArray(payload.questionBank)
    ? payload.questionBank
    : Array.isArray(payload.question_bank)
      ? payload.question_bank
      : Array.isArray(payload.bank)
        ? payload.bank
        : Array.isArray(payload.questions)
          ? payload.questions
          : null;

  if (rawBank) {
    return rawBank.map((rawQuestion, index) => normalizeEditableQuestion(rawQuestion, fallbackQuestions[index]));
  }

  if (typeof payload.question === "string") {
    return [normalizeEditableQuestion(payload, fallbackQuestions[0])];
  }

  return fallbackQuestions.map((question) => ({
    question: question.prompt,
    options: question.options,
    answers: question.correctAnswers,
    multiple: question.correctAnswers.length > 1,
  }));
}

function normalizeEditableQuestion(rawQuestion: unknown, fallbackQuestion?: { prompt: string; options: string[]; correctAnswers: number[] }): EditableQuizQuestion {
  const record = rawQuestion && typeof rawQuestion === "object" ? rawQuestion as Record<string, unknown> : {};
  const question = typeof record.question === "string" ? record.question : fallbackQuestion?.prompt ?? "Enter question";
  const options = Array.isArray(record.options)
    ? record.options.map((option) => String(option))
    : fallbackQuestion?.options ?? ["Answer option A", "Answer option B"];
  const rawAnswers = Array.isArray(record.answers)
    ? record.answers
    : record.answer !== undefined
      ? [record.answer]
      : fallbackQuestion?.correctAnswers ?? [0];
  const answers = rawAnswers
    .map((answer) => Number(answer))
    .filter((answer) => Number.isInteger(answer) && answer >= 0 && answer < options.length);

  return {
    question,
    options,
    answers: answers.length > 0 ? answers : [0],
    multiple:
      record.multiple === true ||
      record.isMultiple === true ||
      (typeof record.questionType === "string" && record.questionType.trim().toLowerCase() === "multiple") ||
      (answers.length > 1),
  };
}
