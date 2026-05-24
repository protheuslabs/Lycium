from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.config import SETTINGS


LOGGER = logging.getLogger("lycium.api")
PUBLIC_PATHS = {"/healthz", "/docs", "/openapi.json", "/redoc"}


def _is_public_path(path: str) -> bool:
    return path in PUBLIC_PATHS or path.startswith("/docs/") or path.startswith("/redoc/")


def _is_authorized(request: Request) -> bool:
    if request.method == "OPTIONS" or not SETTINGS.api_token or _is_public_path(request.url.path):
        return True

    auth_header = request.headers.get("authorization", "")
    return auth_header == f"Bearer {SETTINGS.api_token}"


async def request_context_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()

    if not _is_authorized(request):
        response: Response = JSONResponse({"detail": "Unauthorized"}, status_code=401)
    else:
        response = await call_next(request)

    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["x-request-id"] = request_id
    response.headers["x-lycium-runtime"] = SETTINGS.app_env

    LOGGER.info(
        json.dumps(
            {
                "event": "http_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
            separators=(",", ":"),
        )
    )
    return response
