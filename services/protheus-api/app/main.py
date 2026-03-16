from fastapi import FastAPI


app = FastAPI(
    title="Protheus API",
    version="0.1.0",
    summary="Knowledge-platform control plane for Lyceum.",
)


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/system/boundary")
def system_boundary() -> dict[str, str]:
    return {
        "lyceum": "learner-facing web application",
        "protheus": "knowledge platform services",
    }


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
