import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('bulk-import') private readonly bulkImportQueue: Queue
  ) {}

  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      const redisClient = await this.bulkImportQueue.client;
      await redisClient.ping();
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded' });
    }

    return {
      status: 'ok',
      checks: {
        database: 'up',
        redis: 'up',
      },
    };
  }
}
