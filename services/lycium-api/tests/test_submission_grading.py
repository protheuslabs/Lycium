from __future__ import annotations

from app.submission_grading import grade_project_submission


def _project_block() -> dict:
    return {
        "type": "project",
        "title": "Project: Explain function boundaries",
        "instructions": "Explain function boundaries using a task tracker example. Name functions, inputs, outputs, and how boundaries help testing and review.",
        "requiredEvidence": [
            "A plain-language definition of function boundary.",
            "One task tracker example with at least two named functions.",
            "One explanation of how function boundaries help testing or review.",
            "One sentence naming a possible weak function boundary and how to improve it.",
        ],
        "rubric": {
            "id": "function-boundaries-rubric",
            "title": "Function boundaries rubric",
            "criteria": [
                {
                    "id": "concept-accuracy",
                    "title": "Concept accuracy",
                    "description": "Defines function boundaries accurately and connects them to inputs, behavior, and outputs.",
                    "points": 4,
                },
                {
                    "id": "example-quality",
                    "title": "Example quality",
                    "description": "Uses a task tracker example with named functions or reusable boundaries.",
                    "points": 4,
                },
                {
                    "id": "review-reasoning",
                    "title": "Review reasoning",
                    "description": "Explains how boundaries help testing, review, or future revision.",
                    "points": 3,
                },
            ],
        },
        "graderWorkflow": {"grader": "agent", "passPercentage": 70},
    }


def _grade(text: str) -> dict:
    return grade_project_submission(
        {
            "courseTitle": "Project-Based Coding: Web App Studio",
            "sectionId": "coding-studio-m01-project-01",
            "sectionTitle": "Project: Explain function boundaries",
            "projectBlock": _project_block(),
            "submission": {"submissionType": "text", "text": text},
            "sourceRecords": [],
        },
    )


def test_gibberish_submission_is_not_awarded_partial_credit() -> None:
    report = _grade("xqzv brtq nmpx zkrr vbnm qtplm xqzv brtq nmpx")

    assert report["status"] == "needs_review"
    assert report["grader"] == "native_text_grader"
    assert report["score"] == 0
    assert report["scorePercentage"] == 0
    assert report["errors"]
    assert report["errors"][0]["code"] == "unreadable_submission_text"
    assert all(result["score"] == 0 for result in report["criterionResults"])
    assert "could not grade" in report["summary"]


def test_relevant_text_submission_uses_whole_point_scores() -> None:
    report = _grade(
        "A function boundary is the contract around what a function accepts, what behavior it owns, "
        "and what it returns. In a task tracker, addTask(title) can validate one input and return a "
        "task record, while toggleTaskComplete(taskId) changes completion state without formatting the UI. "
        "Those named functions make testing easier because each input and output can be checked directly. "
        "A weak boundary would be a saveAndRenderEverything function because it mixes storage, state, and display; "
        "I would improve it by splitting persistence from rendering so review and revision are safer."
    )

    assert report["status"] == "graded"
    assert report["grader"] == "native_text_grader"
    assert report["trace"]["requestedGrader"] == "agent"
    assert report["score"] >= 1
    assert all(float(result["score"]).is_integer() for result in report["criterionResults"])
    assert all(float(result["maxScore"]).is_integer() for result in report["criterionResults"])

import base64
from io import BytesIO
from zipfile import ZipFile


def _grade_file(file_name: str, file_bytes: bytes, mime_type: str = "application/octet-stream") -> dict:
    return grade_project_submission(
        {
            "courseTitle": "Project-Based Coding: Web App Studio",
            "sectionId": "coding-studio-m04-project",
            "sectionTitle": "Project: Portfolio-ready coding submission",
            "projectBlock": _project_block(),
            "submission": {
                "submissionType": "doc",
                "fileName": file_name,
                "fileMimeType": mime_type,
                "fileDataBase64": base64.b64encode(file_bytes).decode("ascii"),
            },
            "sourceRecords": [],
        },
    )


def _docx_bytes(text: str) -> bytes:
    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body>
</w:document>'''
    output = BytesIO()
    with ZipFile(output, "w") as archive:
        archive.writestr("[Content_Types].xml", "")
        archive.writestr("word/document.xml", document_xml)
    return output.getvalue()


def test_text_file_submission_can_be_extracted_and_graded() -> None:
    report = _grade_file(
        "function-boundaries.txt",
        b"A function boundary defines inputs, behavior, and outputs. In a task tracker, addTask(title) and toggleTaskComplete(taskId) are named functions with clear responsibilities. That makes testing and review easier because each boundary can be checked directly. A weak function boundary mixes storage and rendering, so I would split those responsibilities.",
        "text/plain",
    )

    assert report["status"] == "graded"
    assert report["score"] > 0
    assert report["trace"]["toolCalls"][0]["status"] == "ok"
    assert report["trace"]["toolCalls"][0]["extractedFileWordCount"] > 20


def test_docx_file_submission_can_be_extracted_and_graded() -> None:
    report = _grade_file(
        "function-boundaries.docx",
        _docx_bytes(
            "A function boundary defines the inputs, behavior, and outputs of a function. "
            "For a task tracker, addTask title and toggleTaskComplete taskId are named functions. "
            "The boundary helps testing and review because each function can be checked separately. "
            "A weak boundary mixes storage, state, and rendering, so I would split those responsibilities."
        ),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    assert report["status"] == "graded"
    assert report["score"] > 0
    assert report["trace"]["toolCalls"][0]["status"] == "ok"
    assert report["trace"]["toolCalls"][0]["extractedFileWordCount"] > 20


def test_unsupported_file_submission_returns_clear_error() -> None:
    report = _grade_file("diagram.png", b"not an inspectable image", "image/png")

    assert report["status"] == "needs_review"
    assert report["score"] == 0
    assert report["errors"][0]["code"] == "unsupported_file_type"
    assert "TXT, PDF, and DOCX" in report["errors"][0]["message"]
