import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';

import { EntitiesService } from './entities.service';

@Controller('api/entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get('stats')
  async getStats() {
    return this.entitiesService.getStats();
  }

  @Get()
  async listEntities(
    @Query('type') entityType: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number
  ) {
    return this.entitiesService.listEntities(entityType, page, limit);
  }
}
