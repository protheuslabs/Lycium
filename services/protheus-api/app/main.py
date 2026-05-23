from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.local_store import ensure_local_data_dirs
from app.routes import course_routes, learning_routes, local_routes, portfolio_job_routes


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        ensure_local_data_dirs()
        init_db()
        yield

    app = FastAPI(
        title="Protheus API",
        version="0.2.0",
        summary="Knowledge-platform control plane for Lyceum.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    local_routes.register(app)
    learning_routes.register(app)
    course_routes.register(app)
    portfolio_job_routes.register(app)
    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
