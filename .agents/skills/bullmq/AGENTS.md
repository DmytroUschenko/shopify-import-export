# BullMQ — Expanded Guide

## Queue Registration

Register queues in the **feature module**, never in `AppModule`:

```typescript
// modules/import/import.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: 'bulk-import' }),
  ],
  providers: [BulkImportService, BulkImportProcessor],
})
export class ImportModule {}
```

If multiple modules need to enqueue to the same queue, re-register the queue in each module — BullMQ/NestJS deduplicates the underlying connection.

---

## Processor Pattern

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('bulk-import')
export class BulkImportProcessor extends WorkerHost {
  async process(job: Job<{ entityType: string }>) {
    await job.updateProgress(15);
    // do first chunk of work
    await job.updateProgress(65);
    // do second chunk of work
    await job.updateProgress(100);

    return { imported: 0, entityType: job.data.entityType };
  }
}
```

**Key points:**
- Extend `WorkerHost`, not `Worker` directly.
- The `@Processor('queue-name')` decorator binds this class to the named queue.
- Call `job.updateProgress(n)` (0–100) at meaningful milestones for UI feedback.
- Throw any unhandled error — BullMQ will catch it, mark the job `failed`, and retry according to the job's `attempts` setting.

---

## Enqueueing Jobs

```typescript
// In a service
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BulkImportService {
  constructor(
    @InjectQueue('bulk-import') private readonly queue: Queue,
  ) {}

  async startImport(entityType: string): Promise<{ jobId: string }> {
    const job = await this.queue.add(
      'import',
      { entityType },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 25,
        removeOnFail: 50,
      },
    );
    return { jobId: job.id! };
  }
}
```

---

## Cleanup Policy

Always set `removeOnComplete` and `removeOnFail` to avoid unbounded Redis growth:

```typescript
removeOnComplete: 25,   // keep last 25 completed jobs for status polling
removeOnFail: 50,       // keep last 50 failed jobs for debugging
```

The existing `bulk-import` queue uses `removeOnComplete: 25` — match this for new queues unless there is a specific reason to keep more history.

---

## Retry and Backoff

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,  // 1s, 2s, 4s
  },
}
```

Throw from `process()` to trigger retry. Never catch-and-swallow errors inside a processor — BullMQ cannot know the job failed if no exception propagates.

---

## Graceful Shutdown

Enable shutdown hooks in `main.ts`:

```typescript
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(3001);
```

NestJS will call `onApplicationShutdown()` on the BullMQ worker, which drains in-flight jobs and closes the Redis connection cleanly.

---

## Testing

Mock the `Queue` provider — do not connect to real Redis in unit tests:

```typescript
const module = await Test.createTestingModule({
  providers: [
    BulkImportService,
    {
      provide: getQueueToken('bulk-import'),
      useValue: { add: jest.fn().mockResolvedValue({ id: 'test-job-id' }) },
    },
  ],
}).compile();
```

For integration tests that do need Redis, use a `testcontainers` Redis container and register it in `beforeAll`.

---

## Progress Polling

The API exposes job progress via:

```typescript
const job = await this.queue.getJob(jobId);
const state = await job.getState();   // 'active' | 'completed' | 'failed' | 'waiting'
const progress = job.progress;        // 0–100
```

Map these to Polaris `ProgressBar` in the frontend.
