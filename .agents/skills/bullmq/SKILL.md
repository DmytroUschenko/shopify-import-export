---
name: bullmq
description: BullMQ queue and worker patterns for NestJS — @Processor/WorkerHost setup, job progress, retry policy, cleanup config, and graceful shutdown. Use when editing any file with @Processor, InjectQueue, WorkerHost, or BullModule.
license: MIT
metadata:
  author: project
  version: "1.0.0"
---

# BullMQ

Patterns for working with BullMQ queues in NestJS. Canonical reference implementation: `apps/api/src/modules/import/processors/bulk-import.processor.ts`.

## When to Apply

Reference these guidelines when:

- Creating or modifying a BullMQ `@Processor` / `WorkerHost` class
- Registering a queue with `BullModule.registerQueue()`
- Adding `@InjectQueue()` to a service
- Configuring job retry, backoff, or cleanup policies
- Writing tests that involve queues or workers
- Handling graceful shutdown for workers

## Key Rules

| Rule | Priority | Summary |
|------|----------|---------|
| `register-in-feature-module` | CRITICAL | Register queues with `BullModule.registerQueue()` in the feature module, not `AppModule` |
| `throw-to-retry` | CRITICAL | Throw an error to trigger BullMQ retry — never swallow exceptions silently |
| `cleanup-policy` | HIGH | Set `removeOnComplete: 25, removeOnFail: 50` to prevent unbounded Redis growth |
| `progress-updates` | HIGH | Call `job.updateProgress(n)` at meaningful milestones so the UI can show real progress |
| `no-request-state-in-processor` | HIGH | Processors are singletons — never store per-job state as class properties |
| `mock-in-tests` | MEDIUM | In unit tests, mock `Queue` and `Worker` — do not connect to real Redis |
| `graceful-shutdown` | MEDIUM | NestJS shutdown hooks close workers automatically; enable `app.enableShutdownHooks()` in `main.ts` |

## Queue Name Registry

| Queue name | Module | Purpose |
|-----------|--------|---------|
| `bulk-import` | `modules/import/` | Cursor-paginated Shopify entity import |
| `export-entity` | `modules/export/` | Per-entity export to external system (planned) |

## Quick Reference — Processor Pattern

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('bulk-import')
export class BulkImportProcessor extends WorkerHost {
  async process(job: Job<{ entityType: string }>) {
    await job.updateProgress(15);
    // ... do work ...
    await job.updateProgress(100);
    return { imported: 0, entityType: job.data.entityType };
  }
}
```

See `AGENTS.md` for module registration, `@InjectQueue` usage, and test patterns.
