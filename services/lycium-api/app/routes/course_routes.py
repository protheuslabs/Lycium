from __future__ import annotations

from fastapi import FastAPI

from app.routes import course_generation_run_routes, course_outline_routes, course_review_routes, course_snapshot_routes, course_source_gap_routes


def register(app: FastAPI) -> None:
    course_outline_routes.register(app)
    course_generation_run_routes.register(app)
    course_source_gap_routes.register(app)
    course_snapshot_routes.register(app)
    course_review_routes.register(app)
