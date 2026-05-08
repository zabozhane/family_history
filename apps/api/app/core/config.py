"""Application settings loaded from environment variables.

Single source of truth for env-driven configuration consumed by the FastAPI
app, the SQLAlchemy engine, and Alembic migrations.
"""
from __future__ import annotations

from functools import lru_cache

from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
    )

    # --- API ---
    API_ENV: str = Field(default="development")
    API_SECRET_KEY: str = Field(default="change-me")
    API_JWT_ALGORITHM: str = Field(default="HS256")
    API_JWT_ACCESS_TTL_SECONDS: int = Field(default=900)
    API_JWT_REFRESH_TTL_SECONDS: int = Field(default=2592000)

    # --- PostgreSQL ---
    POSTGRES_HOST: str = Field(default="postgres")
    POSTGRES_PORT: int = Field(default=5432)
    POSTGRES_DB: str = Field(default="family_media")
    POSTGRES_USER: str = Field(default="family")
    POSTGRES_PASSWORD: str = Field(default="family")

    # --- CORS (dev) ---
    CORS_ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # --- S3-compatible storage (MinIO locally) ---
    S3_ENDPOINT_URL: str = Field(default="http://minio:9000")
    S3_ACCESS_KEY: str = Field(default="minioadmin")
    S3_SECRET_KEY: str = Field(default="minioadmin")
    S3_BUCKET: str = Field(default="family-media")
    S3_REGION: str = Field(default="us-east-1")
    S3_USE_SSL: bool = Field(default=False)

    # Upload limits (skeleton — tighten per env in prod).
    API_UPLOAD_MAX_BYTES: int = Field(default=102_400_000)

    @property
    def database_url_async(self) -> str:
        """asyncpg DSN used by the application + Alembic env.py."""
        user = quote_plus(self.POSTGRES_USER)
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
