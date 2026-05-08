"""FastAPI entrypoint for the Family Media System API."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

# Broker + actor declarations must load before routes import ``tasks_media``
# transitively via upload handlers.
from app import dramatiq_broker  # noqa: F401
from app import tasks_media  # noqa: F401

from app.api.v1.router import api_router

app: FastAPI = FastAPI(
    title="Family Media System API",
    version="0.1.0",
    description="Private family media + digital memory platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {
        "service": "family-media-api",
        "version": app.version,
        "docs": "/docs",
        "api_v1": "/api/v1",
    }
