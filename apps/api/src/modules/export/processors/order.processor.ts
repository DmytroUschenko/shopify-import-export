import { Injectable, Logger } from '@nestjs/common';

import { EntityExportEntity } from '../../../entities/entity-export.entity';
import { EntityProcessor } from './entity-processor.interface';

@Injectable()
export class OrderProcessor implements EntityProcessor {
  private readonly logger = new Logger(OrderProcessor.name);

  async process(exportRecord: EntityExportEntity): Promise<void> {
    this.logger.log(`Processing order export: entityId=${exportRecord.entityId}, exportId=${exportRecord.id}`);
    // TODO: implement actual order export logic (call external API, etc.)
  }
}
