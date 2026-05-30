from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from source_index.db import init_db
from source_index.routes import register


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db()
        yield

    app = FastAPI(
        title="Protheus Source Index API",
        version="0.1.0",
        summary="Standalone source reference index for Protheus AI systems.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register(app)
    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("source_index.main:app", host="0.0.0.0", port=8100, reload=True)
