# BullMQ Skill

NestJS + BullMQ patterns for this project.

## What It Covers

- `@Processor` / `WorkerHost` setup
- `BullModule.registerQueue()` placement (feature module, not AppModule)
- Job progress (`job.updateProgress`)
- Retry and backoff configuration
- Cleanup policy (`removeOnComplete: 25`)
- Graceful shutdown
- Unit test mocking patterns

## Canonical Reference

`apps/api/src/modules/import/processors/bulk-import.processor.ts`

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Rules quick-reference table + queue name registry |
| `AGENTS.md` | Full prose guide with code examples |

## Trigger Keywords

`@Processor`, `InjectQueue`, `WorkerHost`, `BullModule`, any file in `modules/import/processors/` or a new `modules/export/` queue
