from __future__ import annotations

from fastapi import FastAPI

from app.routes import course_outline_routes, course_review_routes, course_snapshot_routes


def register(app: FastAPI) -> None:
    course_outline_routes.register(app)
    course_snapshot_routes.register(app)
    course_review_routes.register(app)
