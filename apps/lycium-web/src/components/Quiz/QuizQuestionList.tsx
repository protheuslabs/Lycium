import type { NormalizedQuestion } from "./quizTypes";

type QuizQuestionListProps = {
  name: string;
  questions: NormalizedQuestion[];
  selectedByQuestion: number[][];
  questionCorrectness: boolean[];
  questionMarked: boolean[];
  hasMultipleQuestions: boolean;
  submitted: boolean;
  isReviewingPastAttempt: boolean;
  shouldRevealAnswers: boolean;
  onToggleQuestionMarker: (questionIndex: number) => void;
  onOptionSelect: (questionIndex: number, optionIndex: number, multiple: boolean) => void;
};

export default function QuizQuestionList({
  name,
  questions,
  selectedByQuestion,
  questionCorrectness,
  questionMarked,
  hasMultipleQuestions,
  submitted,
  isReviewingPastAttempt,
  shouldRevealAnswers,
  onToggleQuestionMarker,
  onOptionSelect,
}: QuizQuestionListProps) {
  return (
    <>
      {questions.map((question, questionIndex) => {
        const selectedForQuestion = selectedByQuestion[questionIndex] ?? [];
        const result = questionCorrectness[questionIndex];

        return (
          <div key={`${name}-${questionIndex}`} className="quiz-question-block">
            <div className="quiz-question-header">
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

              <h4 className="quiz-question">
                {hasMultipleQuestions ? `${questionIndex + 1}. ` : ""}
                {question.prompt}
              </h4>
            </div>

            <div className="quiz-options" data-result={result === undefined ? "pending" : result ? "correct" : "incorrect"}>
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
                        checked={question.isMultiple ? isSelectedOption : selectedForQuestion[0] === optionIndex}
                        onChange={() => onOptionSelect(questionIndex, optionIndex, question.isMultiple)}
                        disabled={submitted || isReviewingPastAttempt}
                      />
                      {showCorrectIndicator && <span className="quiz-answer-indicator quiz-answer-indicator--correct">✓</span>}
                      {showIncorrectIndicator && <span className="quiz-answer-indicator quiz-answer-indicator--incorrect">×</span>}
                    </span>
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
