from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Query, status
from httpx import HTTPError
from sqlalchemy.orm import Session

from source_index.db import get_session
from source_index.contracts import source_index_service_contract
from source_index.models import CrawlPolicyRecord, CrawlRun, IndexedSource, SourceCorpusRun
from source_index.schemas import (
    BulkSourceImportCreate,
    BulkSourceImportRead,
    CrawlPolicyCreate,
    CrawlPolicyRead,
    CrawlRunCreate,
    CrawlRunRead,
    CrawlTaskRead,
    IndexedSourceCreate,
    IndexedSourceRead,
    SourceCorpusRunCreate,
    SourceCorpusRunRead,
    SourceIndexServiceContractRead,
    SourcePacketCreate,
    SourcePacketImportCreate,
    SourcePacketImportRead,
    SourcePacketRead,
    SourceSnapshotCreate,
    SourceSnapshotRead,
)
from source_index.packet_service import create_source_packet, import_source_batch, import_source_packet, source_packet_payload
from source_index.service import (
    corpus_run_payload,
    create_corpus_run,
    create_crawl_policy,
    create_crawl_run,
    create_source_snapshot,
    crawl_policy_payload,
    crawl_run_payload,
    list_crawl_policies,
    list_crawl_run_seed_tasks,
    list_source_snapshots,
    list_sources,
    snapshot_payload,
    source_payload,
    upsert_source,
)


def register(app: FastAPI) -> None:
    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "source-index"}

    @app.get("/v1/index/service-contract", response_model=SourceIndexServiceContractRead)
    def read_service_contract() -> dict:
        return source_index_service_contract()

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

    @app.post("/v1/index/source-imports", response_model=BulkSourceImportRead, status_code=status.HTTP_201_CREATED)
    def create_source_import(payload: BulkSourceImportCreate, session: Session = Depends(get_session)) -> dict:
        report = import_source_batch(
            session,
            batch_id=payload.batch_id,
            sources=[source.model_dump(mode="json") for source in payload.sources],
        )
        session.commit()
        return report

    @app.post("/v1/index/crawl-policies", response_model=CrawlPolicyRead, status_code=status.HTTP_201_CREATED)
    def create_index_crawl_policy(payload: CrawlPolicyCreate, session: Session = Depends(get_session)) -> dict:
        policy = create_crawl_policy(
            session,
            name=payload.name,
            version=payload.version,
            description=payload.description,
            payload=payload.payload,
        )
        session.commit()
        session.refresh(policy)
        return crawl_policy_payload(policy)

    @app.get("/v1/index/crawl-policies", response_model=list[CrawlPolicyRead])
    def read_index_crawl_policies(
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ) -> list[dict]:
        return [crawl_policy_payload(policy) for policy in list_crawl_policies(session, limit=limit)]

    @app.get("/v1/index/crawl-policies/{policy_id}", response_model=CrawlPolicyRead)
    def read_index_crawl_policy(policy_id: int, session: Session = Depends(get_session)) -> dict:
        policy = session.get(CrawlPolicyRecord, policy_id)
        if policy is None:
            raise HTTPException(status_code=404, detail="Crawl policy not found.")
        return crawl_policy_payload(policy)

    @app.post("/v1/index/crawl-runs", response_model=CrawlRunRead, status_code=status.HTTP_201_CREATED)
    def create_index_crawl_run(payload: CrawlRunCreate, session: Session = Depends(get_session)) -> dict:
        try:
            run = create_crawl_run(
                session,
                policy_id=payload.policy_id,
                seed_urls=[str(url) for url in payload.seed_urls],
                max_pages=payload.max_pages,
                payload=payload.payload,
            )
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        session.commit()
        session.refresh(run)
        return crawl_run_payload(run)

    @app.get("/v1/index/crawl-runs/{run_id}", response_model=CrawlRunRead)
    def read_index_crawl_run(run_id: int, session: Session = Depends(get_session)) -> dict:
        run = session.get(CrawlRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Crawl run not found.")
        return crawl_run_payload(run)

    @app.get("/v1/index/crawl-runs/{run_id}/tasks", response_model=list[CrawlTaskRead])
    def read_index_crawl_run_tasks(run_id: int, session: Session = Depends(get_session)) -> list[dict]:
        try:
            return list_crawl_run_seed_tasks(session, run_id=run_id)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post(
        "/v1/index/sources/{source_id}/snapshots",
        response_model=SourceSnapshotRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_indexed_source_snapshot(
        source_id: int,
        payload: SourceSnapshotCreate,
        session: Session = Depends(get_session),
    ) -> dict:
        try:
            snapshot = create_source_snapshot(
                session,
                source_id=source_id,
                fetch=payload.fetch,
                raw_text=payload.raw_text,
                content_type=payload.content_type,
                title=payload.title,
                raw_storage_ref=payload.raw_storage_ref,
                snapshot_metadata=payload.metadata,
            )
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Source fetch failed: {exc}") from exc
        session.commit()
        session.refresh(snapshot)
        return snapshot_payload(snapshot)

    @app.get("/v1/index/sources/{source_id}/snapshots", response_model=list[SourceSnapshotRead])
    def read_indexed_source_snapshots(
        source_id: int,
        limit: int = Query(default=50, ge=1, le=200),
        session: Session = Depends(get_session),
    ) -> list[dict]:
        source = session.get(IndexedSource, source_id)
        if source is None:
            raise HTTPException(status_code=404, detail="Indexed source not found.")
        return [snapshot_payload(snapshot) for snapshot in list_source_snapshots(session, source_id=source_id, limit=limit)]

    @app.post("/v1/index/corpus-runs", response_model=SourceCorpusRunRead, status_code=status.HTTP_201_CREATED)
    def create_index_corpus_run(payload: SourceCorpusRunCreate, session: Session = Depends(get_session)) -> dict:
        run = create_corpus_run(
            session,
            consumer=payload.consumer,
            context_id=payload.context_id,
            prompt=payload.prompt,
            source_urls=[str(url) for url in payload.source_urls],
            fetch_sources=payload.fetch_sources,
            source_documents=payload.source_documents,
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

    @app.post("/v1/index/source-packets", response_model=SourcePacketRead, status_code=status.HTTP_201_CREATED)
    def create_index_source_packet(payload: SourcePacketCreate, session: Session = Depends(get_session)) -> dict:
        packet = create_source_packet(
            session,
            consumer=payload.consumer,
            context_id=payload.context_id,
            prompt=payload.prompt,
            source_urls=[str(url) for url in payload.source_urls],
            fetch_sources=payload.fetch_sources,
            source_documents=payload.source_documents,
            snapshot_limit=payload.snapshot_limit,
        )
        session.commit()
        return packet

    @app.post("/v1/index/source-packet-imports", response_model=SourcePacketImportRead, status_code=status.HTTP_201_CREATED)
    def import_index_source_packet(payload: SourcePacketImportCreate, session: Session = Depends(get_session)) -> dict:
        report = import_source_packet(
            session,
            packet=payload.packet,
            import_snapshots=payload.import_snapshots,
            dry_run=payload.dry_run,
        )
        if report["valid"] and not payload.dry_run:
            session.commit()
        return report

    @app.get("/v1/index/source-packets/{run_id}", response_model=SourcePacketRead)
    def read_index_source_packet(run_id: int, session: Session = Depends(get_session)) -> dict:
        run = session.get(SourceCorpusRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Source packet corpus run not found.")
        return source_packet_payload(session, run=run)
