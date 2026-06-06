import type { NormalizedQuestion } from "./quizTypes";
import { DeleteBlockButton, EditPencilButton, promptForText } from "../ContentView/CourseEditControls";

type QuizQuestionListProps = {
  name: string;
  questions: NormalizedQuestion[];
  selectedByQuestion: number[][];
  questionCorrectness: boolean[];
  questionMarked: boolean[];
  hasMultipleQuestions: boolean;
  submitted: boolean;
  isEditMode: boolean;
  isReviewingPastAttempt: boolean;
  shouldRevealAnswers: boolean;
  onToggleQuestionMarker: (questionIndex: number) => void;
  onOptionSelect: (questionIndex: number, optionIndex: number, multiple: boolean) => void;
  onQuestionEdit: (questionIndex: number, prompt: string) => void;
  onQuestionDelete: (questionIndex: number) => void;
  onQuestionAdd: () => void;
  onAnswerEdit: (questionIndex: number, optionIndex: number, value: string) => void;
  onAnswerDelete: (questionIndex: number, optionIndex: number) => void;
  onAnswerAdd: (questionIndex: number) => void;
  onQuestionMultipleChange: (questionIndex: number, isMultiple: boolean) => void;
  onCorrectAnswerChange: (questionIndex: number, optionIndex: number, isMultiple: boolean) => void;
};

export default function QuizQuestionList({
  name,
  questions,
  selectedByQuestion,
  questionCorrectness,
  questionMarked,
  hasMultipleQuestions,
  submitted,
  isEditMode,
  isReviewingPastAttempt,
  shouldRevealAnswers,
  onToggleQuestionMarker,
  onOptionSelect,
  onQuestionEdit,
  onQuestionDelete,
  onQuestionAdd,
  onAnswerEdit,
  onAnswerDelete,
  onAnswerAdd,
  onQuestionMultipleChange,
  onCorrectAnswerChange,
}: QuizQuestionListProps) {
  return (
    <>
      {questions.map((question, questionIndex) => {
        const selectedForQuestion = selectedByQuestion[questionIndex] ?? [];
        const result = questionCorrectness[questionIndex];

        return (
          <div key={`${name}-${questionIndex}`} className="quiz-question-block">
            <div className="quiz-question-header">
              {!isEditMode && (
                <button
                  type="button"
                  className={`quiz-question-marker ${questionMarked[questionIndex] ? "quiz-marker-marked" : ""}`}
                  aria-label={
                    questionMarked[questionIndex]
                      ? "Unmark this question for review"
                      : "Mark this question for review"
                  }
                  onClick={() => onToggleQuestionMarker(questionIndex)}
                />
              )}

              <h4 className="quiz-question">
                {hasMultipleQuestions ? `${questionIndex + 1}. ` : ""}
                {question.prompt}
              </h4>
              {isEditMode && (
                <span className="quiz-edit-inline-actions">
                  <DeleteBlockButton
                    label="Delete question"
                    onClick={() => onQuestionDelete(questionIndex)}
                  />
                  <EditPencilButton
                    label="Edit question"
                    onClick={() => promptForText("Edit question", question.prompt, (prompt) => onQuestionEdit(questionIndex, prompt))}
                  />
                </span>
              )}
            </div>

            {isEditMode && (
              <div className="quiz-question-type-row" aria-label="Question answer type">
                <button
                  type="button"
                  className={`quiz-question-type-option ${!question.isMultiple ? "quiz-question-type-option--active" : ""}`}
                  onClick={() => onQuestionMultipleChange(questionIndex, false)}
                >
                  <span className="quiz-question-type-radio" aria-hidden="true" />
                  <span>Single answer</span>
                </button>
                <button
                  type="button"
                  className={`quiz-question-type-option ${question.isMultiple ? "quiz-question-type-option--active" : ""}`}
                  onClick={() => onQuestionMultipleChange(questionIndex, true)}
                >
                  <span className="quiz-question-type-checkbox" aria-hidden="true">✓</span>
                  <span>Multiple choice</span>
                </button>
              </div>
            )}

            <div className="quiz-options" data-result={result === undefined ? "pending" : result ? "correct" : "incorrect"}>
              {question.options.map((option, optionIndex) => {
                const isSelectedOption = selectedForQuestion.includes(optionIndex);
                const isCorrectOption = question.correctAnswers.includes(optionIndex);
                const showCorrectIndicator = shouldRevealAnswers && isCorrectOption;
                const showIncorrectIndicator = shouldRevealAnswers && isSelectedOption && !isCorrectOption;
                const isChecked = isEditMode
                  ? isCorrectOption
                  : question.isMultiple
                    ? isSelectedOption
                    : selectedForQuestion[0] === optionIndex;

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
                        checked={isChecked}
                        onChange={() => {
                          if (isEditMode) {
                            onCorrectAnswerChange(questionIndex, optionIndex, question.isMultiple);
                            return;
                          }
                          onOptionSelect(questionIndex, optionIndex, question.isMultiple);
                        }}
                        disabled={submitted || isReviewingPastAttempt}
                      />
                      {showCorrectIndicator && <span className="quiz-answer-indicator quiz-answer-indicator--correct">✓</span>}
                      {showIncorrectIndicator && <span className="quiz-answer-indicator quiz-answer-indicator--incorrect">×</span>}
                    </span>
                    <span>{option}</span>
                    {isEditMode && (
                      <span className="quiz-edit-inline-actions">
                        <DeleteBlockButton
                          label="Delete answer"
                          onClick={() => onAnswerDelete(questionIndex, optionIndex)}
                        />
                        <EditPencilButton
                          label="Edit answer"
                          onClick={() => promptForText("Edit answer", option, (value) => onAnswerEdit(questionIndex, optionIndex, value))}
                        />
                      </span>
                    )}
                  </label>
                );
              })}
              {isEditMode && (
                <button type="button" className="quiz-add-answer-button" onClick={() => onAnswerAdd(questionIndex)}>
                  <span aria-hidden="true">+</span>
                  Add answer
                </button>
              )}
            </div>
          </div>
        );
      })}
      {isEditMode && (
        <button type="button" className="quiz-add-question-button" onClick={onQuestionAdd}>
          <span aria-hidden="true">+</span>
          Add question
        </button>
      )}
    </>
  );
}
