import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { BulkImportProcessor } from './processors/bulk-import.processor';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'bulk-import' })],
  controllers: [ImportController],
  providers: [ImportService, BulkImportProcessor],
})
export class ImportModule {}
