import { useCallback, useMemo } from "react";
import { promptForDeleteConfirmation, promptForText } from "../ContentView/CourseEditControls";
import type { NormalizedQuestion, QuizPayload } from "./quizTypes";

export type EditableQuizQuestion = {
  question: string;
  options: string[];
  answers: number[];
  multiple: boolean;
};

export function useQuizEditor({
  data,
  questionBank,
  onDataChange,
}: {
  data: QuizPayload;
  questionBank: NormalizedQuestion[];
  onDataChange?: (data: QuizPayload) => void;
}) {
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
  const updateQuizData = useCallback((nextData: QuizPayload) => onDataChange?.(nextData), [onDataChange]);
  const updateRawQuestions = useCallback(
    (questions: EditableQuizQuestion[]) => {
      const nextData = withAdjustedQuestionsPerAttempt(data, rawQuestions.length, questions.length);
      updateQuizData({
        ...nextData,
        questions: questions.map((question) => ({
          question: question.question,
          options: question.options,
          multiple: question.multiple,
          ...(question.answers.length > 1 ? { answers: question.answers } : { answer: question.answers[0] ?? 0 }),
        })),
      });
    },
    [data, rawQuestions.length, updateQuizData],
  );
  const editQuestion = useCallback(
    (questionIndex: number, question: string) => {
      updateRawQuestions(rawQuestions.map((currentQuestion, index) => (index === questionIndex ? { ...currentQuestion, question } : currentQuestion)));
    },
    [rawQuestions, updateRawQuestions],
  );
  const deleteQuestion = useCallback(
    (questionIndex: number) => {
      promptForDeleteConfirmation(
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
  const promptAddQuestion = useCallback(() => promptForText("Add question", "", addQuestion), [addQuestion]);
  const editAnswer = useCallback(
    (questionIndex: number, answerIndex: number, value: string) => {
      updateRawQuestions(
        rawQuestions.map((question, index) =>
          index === questionIndex
            ? { ...question, options: question.options.map((option, optionIndex) => (optionIndex === answerIndex ? value : option)) }
            : question,
        ),
      );
    },
    [rawQuestions, updateRawQuestions],
  );
  const deleteAnswer = useCallback(
    (questionIndex: number, answerIndex: number) => {
      promptForDeleteConfirmation(
        () =>
          updateRawQuestions(
            rawQuestions.map((question, index) => {
              if (index !== questionIndex) return question;
              const nextOptions = question.options.filter((_, optionIndex) => optionIndex !== answerIndex);
              const nextAnswers = question.answers
                .filter((answer) => answer !== answerIndex)
                .map((answer) => (answer > answerIndex ? answer - 1 : answer))
                .filter((answer) => answer >= 0 && answer < nextOptions.length);
              return { ...question, options: nextOptions, answers: nextAnswers.length > 0 ? nextAnswers : [0] };
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
          index === questionIndex ? { ...question, options: [...question.options, `Answer option ${question.options.length + 1}`] } : question,
        ),
      );
    },
    [rawQuestions, updateRawQuestions],
  );
  const toggleQuestionMultiple = useCallback(
    (questionIndex: number, isMultiple: boolean) => {
      updateRawQuestions(
        rawQuestions.map((question, index) =>
          index === questionIndex ? { ...question, multiple: isMultiple, answers: isMultiple ? question.answers : [question.answers[0] ?? 0] } : question,
        ),
      );
    },
    [rawQuestions, updateRawQuestions],
  );
  const setCorrectAnswer = useCallback(
    (questionIndex: number, optionIndex: number, isMultiple: boolean) => {
      updateRawQuestions(
        rawQuestions.map((question, index) => {
          if (index !== questionIndex) return question;
          if (!isMultiple) return { ...question, answers: [optionIndex], multiple: false };
          const answers = question.answers.includes(optionIndex)
            ? question.answers.filter((answer) => answer !== optionIndex)
            : [...question.answers, optionIndex];
          return { ...question, multiple: true, answers: answers.length > 0 ? answers : [optionIndex] };
        }),
      );
    },
    [rawQuestions, updateRawQuestions],
  );

  return {
    addAnswer,
    deleteAnswer,
    deleteQuestion,
    editAnswer,
    editQuestion,
    editorDisplayedQuestions,
    promptAddQuestion,
    setCorrectAnswer,
    toggleQuestionMultiple,
    updateQuizData,
  };
}

function withAdjustedQuestionsPerAttempt(payload: QuizPayload, previousCount: number, nextCount: number): QuizPayload {
  const explicitLimit = readQuestionLimit(payload);
  if (explicitLimit === null || nextCount <= 0) {
    return payload;
  }

  const nextLimit = explicitLimit >= previousCount ? nextCount : Math.min(explicitLimit, nextCount);
  return {
    ...payload,
    questionsPerAttempt: Math.max(1, nextLimit),
  };
}

function readQuestionLimit(payload: QuizPayload): number | null {
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.questionsPerAttempt,
    record.questions_per_attempt,
    record.questionCount,
    record.question_count,
    record.displayCount,
    record.display_count,
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

function editableQuestionsFromPayload(payload: QuizPayload, fallbackQuestions: NormalizedQuestion[]): EditableQuizQuestion[] {
  const rawBank = Array.isArray(payload.questionBank)
    ? payload.questionBank
    : Array.isArray(payload.question_bank)
      ? payload.question_bank
      : Array.isArray(payload.bank)
        ? payload.bank
        : Array.isArray(payload.questions)
          ? payload.questions
          : null;
  if (rawBank) return rawBank.map((rawQuestion, index) => normalizeEditableQuestion(rawQuestion, fallbackQuestions[index]));
  if (typeof payload.question === "string") return [normalizeEditableQuestion(payload, fallbackQuestions[0])];
  return fallbackQuestions.map((question) => ({
    question: question.prompt,
    options: question.options,
    answers: question.correctAnswers,
    multiple: question.correctAnswers.length > 1,
  }));
}

function normalizeEditableQuestion(rawQuestion: unknown, fallbackQuestion?: NormalizedQuestion): EditableQuizQuestion {
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
  const answers = rawAnswers.map((answer) => Number(answer)).filter((answer) => Number.isInteger(answer) && answer >= 0 && answer < options.length);
  return {
    question,
    options,
    answers: answers.length > 0 ? answers : [0],
    multiple:
      record.multiple === true ||
      record.isMultiple === true ||
      (typeof record.questionType === "string" && record.questionType.trim().toLowerCase() === "multiple") ||
      answers.length > 1,
  };
}
