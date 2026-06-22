from __future__ import annotations

from fastapi import FastAPI

from app.schemas import ProjectSubmissionGradeRead, ProjectSubmissionGradeRequest
from app.submission_grading import grade_project_submission


def register(app: FastAPI) -> None:
    @app.post("/v1/submissions/grade", response_model=ProjectSubmissionGradeRead)
    def grade_project_submission_endpoint(payload: ProjectSubmissionGradeRequest) -> dict:
        return grade_project_submission(payload.model_dump(mode="json"))
