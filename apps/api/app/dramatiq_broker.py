"""Configure Dramatiq Redis broker for the API process (message producer).

Imported from ``app.main`` before routes so ``.send()`` on actors works.
"""
from __future__ import annotations

import dramatiq
from dramatiq.brokers.redis import RedisBroker

from app.core.config import settings

broker = RedisBroker(url=settings.redis_url)
dramatiq.set_broker(broker)
