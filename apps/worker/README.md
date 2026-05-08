# apps/worker

Background task processing service (Dramatiq + Redis) for asynchronous media work.

## Responsibilities
- Process uploaded media (Pillow, mutagen, ffmpeg) for metadata, thumbnails, durations.
- Update AssetVersion records and report processing status to the API.
- Fault-tolerant task execution with structured logging.

## Status
Skeleton placeholder. Worker bootstrap lands in T7 / T8.
