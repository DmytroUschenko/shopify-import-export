import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DbHistoryEntity } from '../../entities/db-history.entity';
import { DbImportEntity } from '../../entities/db-import.entity';
import { ShopEntity } from '../../entities/shop.entity';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopEntity, DbImportEntity, DbHistoryEntity]),
    BullModule.registerQueue({ name: 'bulk-import' }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
