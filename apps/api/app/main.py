"""FastAPI entrypoint for the Family Media System API."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

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
