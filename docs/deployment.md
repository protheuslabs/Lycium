# Lycium Deployment Environments

Lycium supports three practical runtime modes while the product matures.

## Local development

- Web: `NEXT_PUBLIC_LYCIUM_RUNTIME=local`
- API: `http://127.0.0.1:8000`
- Data: `.lycium-local/` and `services/lycium-api/.data/`
- Auth: unset `LYCIUM_API_TOKEN` for local-only development

## Static catalog

- Web: `NEXT_PUBLIC_LYCIUM_RUNTIME=static`
- Catalog: `NEXT_PUBLIC_LYCIUM_COURSE_CATALOG_URL`
- Course snapshots: `NEXT_PUBLIC_LYCIUM_COURSE_BASE_URL`
- Progress: browser-local until a cloud progress adapter is configured

## Hosted API

- Web: `NEXT_PUBLIC_LYCIUM_RUNTIME=cloud`
- API: `NEXT_PUBLIC_LYCIUM_API_URL`
- Auth: set `LYCIUM_API_TOKEN` and send `Authorization: Bearer <token>` from trusted clients or a backend-for-frontend
- Observability: preserve `x-request-id` headers in logs and reverse proxies

## Production hardening checklist

- Set `LYCIUM_ENV=production`.
- Use a managed Postgres database rather than local SQLite.
- Set `LYCIUM_API_TOKEN` or replace it with the production auth provider.
- Restrict CORS before exposing private endpoints publicly.
- Route structured API logs to a searchable log sink.
- Store raw source artifacts in object storage rather than repo-local paths.
- Keep generated course publication behind the quality-report gate.
