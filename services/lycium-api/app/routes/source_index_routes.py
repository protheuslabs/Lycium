from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas import (
    BulkSourceImportCreate,
    BulkSourceImportRead,
    IndexedSourceCreate,
    IndexedSourceRead,
    SourceCorpusRunCreate,
    SourceCorpusRunRead,
    SourceFitCreate,
    SourceFitRead,
    SourceIndexSearchCreate,
    SourceIndexSearchRead,
    SourcePacketCreate,
    SourcePacketRead,
)
from app.source_index_client import SourceIndexClientError
from app.source_index import (
    create_indexed_source_response,
    create_source_corpus_run_response,
    get_indexed_source_response,
    get_source_corpus_run_response,
    list_indexed_source_responses,
)
from app.source_index_packets import create_source_packet_response, get_source_packet_response, import_source_batch_response
from app.source_index_search import analyze_source_fit_response, search_index_response


def register(app: FastAPI) -> None:
    @app.post("/v1/index/sources", response_model=IndexedSourceRead, status_code=status.HTTP_201_CREATED)
    def create_indexed_source(payload: IndexedSourceCreate, session: Session = Depends(get_session)) -> dict:
        try:
            return create_indexed_source_response(
                session,
                url=str(payload.url),
                title=payload.title,
                source_type=payload.source_type,
                license=payload.license,
                is_free=payload.is_free,
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.get("/v1/index/sources", response_model=list[IndexedSourceRead])
    def list_sources(
        query: str | None = Query(default=None),
        domain: str | None = Query(default=None),
        source_type: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ) -> list[dict]:
        try:
            return list_indexed_source_responses(
                session,
                query=query,
                domain=domain,
                source_type=source_type,
                limit=limit,
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.get("/v1/index/sources/{source_id}", response_model=IndexedSourceRead)
    def get_indexed_source(source_id: int, session: Session = Depends(get_session)) -> dict:
        try:
            source = get_indexed_source_response(session, source_id=source_id)
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if source is None:
            raise HTTPException(status_code=404, detail="Indexed source not found.")
        return source

    @app.post("/v1/index/source-imports", response_model=BulkSourceImportRead, status_code=status.HTTP_201_CREATED)
    def import_sources(payload: BulkSourceImportCreate, session: Session = Depends(get_session)) -> dict:
        try:
            return import_source_batch_response(
                session,
                batch_id=payload.batch_id,
                sources=[source.model_dump(mode="json") for source in payload.sources],
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.post("/v1/index/search", response_model=SourceIndexSearchRead)
    def search_index_sources(payload: SourceIndexSearchCreate, session: Session = Depends(get_session)) -> dict:
        try:
            return search_index_response(
                session,
                query=payload.query,
                filters=payload.filters.model_dump(mode="json"),
                limit=payload.limit,
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.post("/v1/index/source-fit", response_model=SourceFitRead)
    def analyze_index_source_fit(payload: SourceFitCreate, session: Session = Depends(get_session)) -> dict:
        try:
            return analyze_source_fit_response(
                session,
                sources=[source.model_dump(mode="json") for source in payload.sources],
                targets=[target.model_dump(mode="json") for target in payload.targets],
                limit=payload.limit,
                minimum_score=payload.minimum_score,
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.post("/v1/index/corpus-runs", response_model=SourceCorpusRunRead, status_code=status.HTTP_201_CREATED)
    def create_corpus_run(payload: SourceCorpusRunCreate, session: Session = Depends(get_session)) -> dict:
        try:
            return create_source_corpus_run_response(
                session,
                consumer=payload.consumer,
                context_id=payload.context_id,
                prompt=payload.prompt,
                source_urls=[str(url) for url in payload.source_urls],
                fetch_sources=payload.fetch_sources,
                source_documents=payload.source_documents,
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.get("/v1/index/corpus-runs/{run_id}", response_model=SourceCorpusRunRead)
    def get_corpus_run(run_id: int, session: Session = Depends(get_session)) -> dict:
        try:
            run = get_source_corpus_run_response(session, run_id=run_id)
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if run is None:
            raise HTTPException(status_code=404, detail="Source corpus run not found.")
        return run

    @app.post("/v1/index/source-packets", response_model=SourcePacketRead, status_code=status.HTTP_201_CREATED)
    def create_source_packet(payload: SourcePacketCreate, session: Session = Depends(get_session)) -> dict:
        try:
            return create_source_packet_response(
                session,
                consumer=payload.consumer,
                context_id=payload.context_id,
                prompt=payload.prompt,
                source_urls=[str(url) for url in payload.source_urls],
                fetch_sources=payload.fetch_sources,
                source_documents=payload.source_documents,
                snapshot_limit=payload.snapshot_limit,
            )
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.get("/v1/index/source-packets/{packet_id}", response_model=SourcePacketRead)
    def get_source_packet(packet_id: int, session: Session = Depends(get_session)) -> dict:
        try:
            packet = get_source_packet_response(session, packet_id=packet_id)
        except SourceIndexClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if packet is None:
            raise HTTPException(status_code=404, detail="Source packet not found.")
        return packet
