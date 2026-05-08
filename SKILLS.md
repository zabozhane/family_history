# Skills Context

## Selection Rationale
- Selected python_async to enforce reliable async patterns in Python services.

## Selected Skill Packs
### Python Async (`python_async`)
Reusable engineering context pack with: pitfalls, rules.

Source: local_pack | Confidence: high
Match reason: Matched by local skill keyword rules.

Rules:
- Never block the event loop with sync I/O in coroutine paths.
- Bound concurrency with semaphores or worker pools.
- Propagate cancellation and timeouts intentionally.
- Use structured retries with jitter for flaky network calls.

Conventions:
- None

Architecture guidance:
- None

Common pitfalls:
- Fire-and-forget tasks can hide exceptions and leak resources.
- Shared mutable state across coroutines causes race conditions.
- Unbounded gather() calls can overload external services.

Prompts:
- None

