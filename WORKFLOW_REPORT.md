# Workflow Report

## Quality Score
- Score: 80/100

## Inputs
- Idea: # PROJECT: FAMILY MEDIA SYSTEM / DIGITAL MEMORY PLATFORM

Ты — senior staff engineer и system architect.
Твоя задача — помочь построить production-grade personal/family media platform.

Проект НЕ является:
- Spotify clone
- Google Photos clone
- Dropbox clone

Проект является:
- личной семейной медиатекой;
- digital memory system;
- unified timeline platform;
- private cloud ecosystem;
- AI-ready media archive.

---

# CORE IDEA

Система должна хранить и организовывать:

- музыку;
- фото;
- видео;
- заметки;
- идеи;
- voice notes;
- документы;
- события;
- плейлисты;
- коллекции;
- timeline activities.

Ключевая концепция:

# EVERYTHING IS AN ASSET
и
# EVERYTHING HAPPENS IN TIME

---

# MAIN PRODUCT VISION

Главный интерфейс системы — unified timeline.

Timeline должен отображать:
- фото;
- музыку;
- видео;
- заметки;
- события;
- семейные активности;
- AI-generated memories;
- uploads;
- playlists;
- listening history.

Система должна ощущаться как:
- personal operating system;
- digital memory archive;
- family cloud;
- media intelligence platform.

---

# USERS

Система multi-user.

Пользователи:
- admin
- family member
- child
- guest

---

# PERMISSIONS

Поддержать:
- private
- family
- shared
- public-link

---

# TECH STACK

Frontend:
- Next.js
- TypeScript
- Tailwind
- shadcn/ui

Backend:
- Python
- FastAPI

Database:
- PostgreSQL

Cache / Queue:
- Redis

Background jobs:
- Celery or Dramatiq

Storage:
- S3-compatible storage
- preferably MinIO locally
- support Cloudflare R2 later

ORM:
- SQLAlchemy

Auth:
- JWT + refresh tokens
- secure session handling

Media processing:
- ffmpeg
- Pillow
- mutagen
- librosa

AI-ready architecture:
- embeddings
- semantic search
- OCR
- speech-to-text
- image understanding
- vector database support later

Containerization:
- Docker
- docker-compose

---

# ARCHITECTURAL REQUIREMENTS

Система должна быть:
- modular;
- scalable;
- event-driven where reasonable;
- AI-ready;
- mobile-first;
- self-hostable;
- extensible.

НЕ использовать:
- microservices initially;
- kubernetes;
- overengineering.

---

# CORE DOMAIN MODEL

Основные сущности:

User
Asset
AssetVersion
Collection
Playlist
Event
TimelineEntry
Tag
Comment
Activity
Permission
UploadSession

---

# ASSET TYPES

Поддержать:
- image
- video
- audio
- note
- document
- voice_note
- link
- archive

---

# TIMELINE CONCEPT

Timeline — core feature.

Timeline НЕ хранится отдельно как flat list.

Timeline строится из:
- events;
- activities;
- assets;
- relationships.

Timeline должен поддерживать:
- daily grouping;
- monthly grouping;
- family timeline;
- personal timeline;
- media-type filtering;
- smart memories later;
- AI summaries later.

---

# MEDIA FEATURES

Music:
- upload
- streaming
- playlists
- waveform later
- metadata extraction
- listening history

Photos:
- gallery
- albums
- EXIF extraction
- thumbnails
- timeline view

Videos:
- previews
- thumbnails
- streaming support
- transcoding later

Notes:
- markdown support
- linking later
- timeline integration

---

# UPLOAD PIPELINE

После upload:

Image:
- thumbnail generation
- EXIF extraction
- compression

Audio:
- metadata extraction
- duration extraction
- waveform later

Video:
- preview generation
- thumbnail extraction
- transcoding later

Все тяжёлые операции:
- async background jobs.

---

# API REQUIREMENTS

API должен быть:
- REST-first;
- typed;
- documented;
- versionable.

Использовать:
- Pydantic
- OpenAPI
- clean schemas

---

# FRONTEND REQUIREMENTS

Frontend должен ощущаться как modern application.

UX inspiration:
- Apple Photos
- Notion
- Plex
- Spotify
- Immich
- Arc Browser

Поддержать:
- dark mode
- responsive UI
- drag & drop uploads
- command palette later
- sidebar navigation
- timeline-first navigation

---

# SEARCH

Сначала:
- text search
- tags
- metadata search

Позже:
- semantic search
- embeddings
- natural language queries

---

# SECURITY

Поддержать:
- secure uploads
- file validation
- private asset protection
- role-based access
- rate limiting
- signed URLs later

---

# STORAGE STRATEGY

НЕ хранить файлы в PostgreSQL.

Использовать:
- object storage
- metadata in DB

---

# DEVELOPMENT PHILOSOPHY

Приоритеты:

1. Clean architecture
2. Developer experience
3. Extensibility
4. Stability
5. UX quality

НЕ пытаться:
- сделать enterprise system;
- сделать Spotify competitor;
- сделать social network.

---

# MVP GOAL

Первый MVP должен поддерживать:

- authentication;
- upload;
- asset storage;
- timeline;
- media browsing;
- music playback;
- photo gallery;
- search;
- permissions;
- family accounts.

---

# PROJECT STRUCTURE

Разделить проект логически:

apps/
  web/
  api/
  worker/

infrastructure/
  docker/
  nginx/
  scripts/

packages/
  shared-types/
  shared-utils/

---

# CODING REQUIREMENTS

- strict typing everywhere
- clean naming
- scalable folder structure
- avoid magic values
- reusable services
- repository/service separation where appropriate
- environment-based config
- structured logging

---

# DOCUMENTATION REQUIREMENTS

Сгенерируй:

- README.md
- ARCHITECTURE.md
- TASKS.md
- MCP.md
- CURSOR_CONTEXT.md
- SESSION_PROMPT.md
- SESSION_HANDOFF.md
- WORKFLOW_REPORT.md
- SKILLS.md
- CURSOR_EXECUTION_MODE.md

---

# IMPORTANT

Не писать toy-example architecture.

Нужен:
- realistic production-ready foundation;
- but still lean and practical for solo development.

---

# INITIAL IMPLEMENTATION PRIORITY

Сначала создать foundation architecture:
- folders;
- services;
- docker setup;
- db setup;
- auth skeleton;
- upload pipeline skeleton;
- asset model;
- timeline model;
- API structure;
- frontend shell.

НЕ пытаться реализовать все фичи сразу.

---

# OUTPUT STYLE

Действуй как:
- experienced architect;
- pragmatic startup CTO;
- senior platform engineer.

Решения должны быть:
- practical;
- extensible;
- maintainable;
- realistic for one developer using Cursor.
- Preferred stack: python
- Constraints:
- minimal mvp

## Checks
- component_task_coverage: FAIL — No explicit task coverage for components: infrastructure
- task_dependency_integrity: PASS — All task dependencies reference known task IDs.
- constraint_signal: PASS — Constraints are represented in architecture/tasks text.
- overengineering_guard: PASS — No overengineering terms detected outside requested scope.

## Warnings
- None

## Output Summary
- Components: 4
- Tasks: 15
- Skills: 1