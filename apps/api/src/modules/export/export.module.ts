import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EntityExportEntity } from '../../entities/entity-export.entity';
import { ConfigurationModule } from '../configuration/configuration.module';
import { ShopConfigRegistry } from '../configuration/shop-config-registry.service';
import { EXPORT_CONFIG_DEFINITIONS } from './export.config-paths';
import { EntityExportRepository } from './entity-export.repository';
import { ProcessorListService } from './processor-list.service';
import { OrderProcessor } from './processors/order.processor';

@Module({
  imports: [TypeOrmModule.forFeature([EntityExportEntity]), ConfigurationModule],
  providers: [EntityExportRepository, ProcessorListService, OrderProcessor],
  exports: [EntityExportRepository, ProcessorListService],
})
export class ExportModule implements OnModuleInit {
  constructor(private readonly shopConfigRegistry: ShopConfigRegistry) {}

  onModuleInit(): void {
    this.shopConfigRegistry.register(EXPORT_CONFIG_DEFINITIONS);
  }
}
