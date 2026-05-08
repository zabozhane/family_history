"""Dramatiq worker entrypoint for the Family Media System.

Minimal at T2: configure a Redis broker and register a no-op ``ping`` actor so
``dramatiq app.main`` discovers something runnable. Real media-processing
actors are added in T7/T8.
"""
from __future__ import annotations

import os

import dramatiq
from dramatiq.brokers.redis import RedisBroker


def _redis_url() -> str:
    host = os.getenv("REDIS_HOST", "redis")
    port = os.getenv("REDIS_PORT", "6379")
    db = os.getenv("REDIS_DB", "0")
    return f"redis://{host}:{port}/{db}"


broker: RedisBroker = RedisBroker(url=_redis_url())
dramatiq.set_broker(broker)


@dramatiq.actor(max_retries=3)
def ping(message: str = "pong") -> None:
    """Smoke-test actor; replaced by metadata-extraction actors in T8."""
    print(f"[worker] ping: {message}", flush=True)
