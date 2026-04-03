import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('bulk-import')
export class BulkImportProcessor extends WorkerHost {
  async process(job: Job<{ entityType: string }>) {
    await job.updateProgress(15);
    await new Promise((resolve) => setTimeout(resolve, 400));

    await job.updateProgress(65);
    await new Promise((resolve) => setTimeout(resolve, 600));

    await job.updateProgress(100);

    return { imported: 0, entityType: job.data.entityType };
  }
}
