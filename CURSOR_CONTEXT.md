# Cursor Context

## Project
- Name: Family Media System / Digital Memory Platform
- Stack: Frontend: Next.js, TypeScript, Tailwind, shadcn/ui; Backend: Python, FastAPI; Database: PostgreSQL; Cache/Queue: Redis; Background Jobs: Dramatiq or Celery; Storage: S3-compatible (MinIO for local); ORM: SQLAlchemy; Auth: JWT + refresh tokens; Media Processing: ffmpeg, Pillow, mutagen; Containerization: Docker, docker-compose

## Architecture Summary
A modular monolith architecture for a private family media system enabling secure multi-user media asset management and timeline aggregation. The system comprises frontend, API backend, and asynchronous worker modules with tight integration and explicit responsibilities, adhering to minimal MVP constraints and preferred stack.

## Applied Skills
- python_async (local_pack): Reusable engineering context pack with: pitfalls, rules.

## MCP Recommendations
- Python docs MCP (asyncio section) for event-loop and coroutine references.
- Package index/search MCP to compare async-ready libraries before adoption.
- Ruff + pytest tooling context for fast local feedback loops.

## Current Task Backlog
- T1: Establish modular project directory structure
- T2: Create Dockerfiles for api, web, and worker apps
- T3: Set up docker-compose with PostgreSQL, Redis, and MinIO
- T4: Implement core database schemas with SQLAlchemy and Alembic migrations
- T5: Implement JWT authentication with user roles in FastAPI backend
- T6: Create upload pipeline skeleton for media assets
- T7: Set up Dramatiq task queue using Redis broker
- T8: Implement media metadata extraction background jobs
- T9: Develop permission system for private, family, shared scopes
- T10: Build typed, versioned FastAPI RESTful API with OpenAPI docs
- T11: Implement foundational timeline aggregation model
- T12: Create Next.js frontend shell with authentication integration
- T13: Implement basic photo gallery and music playback
- T14: Implement timeline navigation and filtering UI
- T15: Implement environment configuration and strict typing across codebase
