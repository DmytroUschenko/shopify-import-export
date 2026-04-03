import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { BulkImportRequestDto } from './import.dto';
import { ImportService } from './import.service';

@Controller('api/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('bulk')
  async startBulkImport(@Body() body: BulkImportRequestDto) {
    return this.importService.startBulkImport(body.entityType);
  }

  @Get('bulk/status/:jobId')
  async getBulkImportStatus(@Param('jobId') jobId: string) {
    return this.importService.getBulkImportStatus(jobId);
  }
}
