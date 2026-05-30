from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy.orm import Session

from source_index.db import get_session
from source_index.models import IndexedSource, SourceCorpusRun
from source_index.schemas import IndexedSourceCreate, IndexedSourceRead, SourceCorpusRunCreate, SourceCorpusRunRead
from source_index.service import corpus_run_payload, create_corpus_run, list_sources, source_payload, upsert_source


def register(app: FastAPI) -> None:
    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "source-index"}

    @app.post("/v1/index/sources", response_model=IndexedSourceRead, status_code=status.HTTP_201_CREATED)
    def create_indexed_source(payload: IndexedSourceCreate, session: Session = Depends(get_session)) -> dict:
        source = upsert_source(
            session,
            url=str(payload.url),
            title=payload.title,
            source_type=payload.source_type,
            license=payload.license,
            is_free=payload.is_free,
        )
        session.commit()
        session.refresh(source)
        return source_payload(source)

    @app.get("/v1/index/sources", response_model=list[IndexedSourceRead])
    def read_sources(
        query: str | None = Query(default=None),
        domain: str | None = Query(default=None),
        source_type: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ) -> list[dict]:
        return [
            source_payload(source)
            for source in list_sources(
                session,
                query=query,
                domain=domain,
                source_type=source_type,
                limit=limit,
            )
        ]

    @app.get("/v1/index/sources/{source_id}", response_model=IndexedSourceRead)
    def read_source(source_id: int, session: Session = Depends(get_session)) -> dict:
        source = session.get(IndexedSource, source_id)
        if source is None:
            raise HTTPException(status_code=404, detail="Indexed source not found.")
        return source_payload(source)

    @app.post("/v1/index/corpus-runs", response_model=SourceCorpusRunRead, status_code=status.HTTP_201_CREATED)
    def create_index_corpus_run(payload: SourceCorpusRunCreate, session: Session = Depends(get_session)) -> dict:
        run = create_corpus_run(
            session,
            consumer=payload.consumer,
            context_id=payload.context_id,
            prompt=payload.prompt,
            source_urls=[str(url) for url in payload.source_urls],
            fetch_sources=payload.fetch_sources,
        )
        session.commit()
        session.refresh(run)
        return corpus_run_payload(run)

    @app.get("/v1/index/corpus-runs/{run_id}", response_model=SourceCorpusRunRead)
    def read_corpus_run(run_id: int, session: Session = Depends(get_session)) -> dict:
        run = session.get(SourceCorpusRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Source corpus run not found.")
        return corpus_run_payload(run)
