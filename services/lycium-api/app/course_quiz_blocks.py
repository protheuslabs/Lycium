from __future__ import annotations

from typing import Any


def normalize_quiz_block(block: dict[str, Any]) -> dict[str, Any]:
    questions = block.get("questions") or block.get("questionBank") or []
    if not questions and block.get("question"):
        answer = block.get("answer")
        answers = block.get("answers")
        questions = [
            {
                "question": block.get("question"),
                "options": block.get("options", []),
                "answers": answers if isinstance(answers, list) else ([answer] if isinstance(answer, int) else []),
                "timed": block.get("timed", False),
            }
        ]
        block = {key: value for key, value in block.items() if key not in {"question", "options", "answer", "answers"}}
        block["questions"] = questions
    if isinstance(questions, list):
        normalized_questions = []
        for question in questions:
            if not isinstance(question, dict):
                normalized_questions.append(question)
                continue
            if "answers" not in question and "answer" in question:
                question = {**question, "answers": [question["answer"]]}
            normalized_questions.append(question)
        if "questions" in block:
            block = {**block, "questions": normalized_questions}
        elif "questionBank" in block:
            block = {**block, "questionBank": normalized_questions}
    return block
