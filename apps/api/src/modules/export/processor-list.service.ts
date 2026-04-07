import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';

import { EntityExportEntity } from '../../entities/entity-export.entity';
import { EntityProcessor } from './processors/entity-processor.interface';
import { OrderProcessor } from './processors/order.processor';

@Injectable()
export class ProcessorListService implements OnModuleInit {
  private readonly logger = new Logger(ProcessorListService.name);
  private readonly processors = new Map<string, EntityProcessor>();

  constructor(private readonly orderProcessor: OrderProcessor) {}

  onModuleInit(): void {
    this.register('order', this.orderProcessor);
    this.logger.log(`ProcessorList initialized with processors: [${[...this.processors.keys()].join(', ')}]`);
  }

  register(entityType: string, processor: EntityProcessor): void {
    this.processors.set(entityType, processor);
  }

  getProcessor(entityType: string): EntityProcessor {
    const processor = this.processors.get(entityType);
    if (!processor) {
      throw new NotFoundException(`No processor registered for entity type: ${entityType}`);
    }

    return processor;
  }

  hasProcessor(entityType: string): boolean {
    return this.processors.has(entityType);
  }

  async process(exportRecord: EntityExportEntity): Promise<void> {
    const processor = this.getProcessor(exportRecord.entityType);
    await processor.process(exportRecord);
  }
}
