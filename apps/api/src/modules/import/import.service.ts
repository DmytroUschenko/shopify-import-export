import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityType } from '@shopify-import/shared';
import { Queue } from 'bullmq';

type BulkStatus = 'waiting' | 'active' | 'completed' | 'failed';

@Injectable()
export class ImportService {
  constructor(@InjectQueue('bulk-import') private readonly bulkImportQueue: Queue) {}

  async startBulkImport(entityType: EntityType) {
    const job = await this.bulkImportQueue.add(
      'bulk-import',
      { entityType },
      {
        removeOnComplete: 25,
        removeOnFail: 25,
      }
    );

    return { jobId: job.id };
  }

  async getBulkImportStatus(jobId: string) {
    const job = await this.bulkImportQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();

    return {
      jobId,
      progress: Number(job.progress ?? 0),
      status: this.mapStatus(state),
    };
  }

  private mapStatus(state: string): BulkStatus {
    if (state === 'active' || state === 'completed' || state === 'failed') {
      return state;
    }

    return 'waiting';
  }
}
