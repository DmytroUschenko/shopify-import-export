import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DbHistoryEntity } from './entities/db-history.entity';
import { DbImportEntity } from './entities/db-import.entity';
import { EntityExportEntity } from './entities/entity-export.entity';
import { ShopConfigEntity } from './entities/shop-config.entity';
import { ShopEntity } from './entities/shop.entity';
import { EntitiesModule } from './modules/entities/entities.module';
import { ExportModule } from './modules/export/export.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { HealthModule } from './modules/health/health.module';
import { ImportModule } from './modules/import/import.module';
import { parseRedisConnection } from './modules/common/redis-config';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [ShopEntity, DbImportEntity, DbHistoryEntity, EntityExportEntity, ShopConfigEntity],
        synchronize:
          configService.get<string>('TYPEORM_SYNCHRONIZE', 'true') === 'true',
        autoLoadEntities: true,
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: parseRedisConnection(
          configService.getOrThrow<string>('REDIS_URL')
        ),
      }),
    }),
    HealthModule,
    EntitiesModule,
    ImportModule,
    WebhookModule,
    ExportModule,
    ConfigurationModule,
  ],
})
export class AppModule {}
