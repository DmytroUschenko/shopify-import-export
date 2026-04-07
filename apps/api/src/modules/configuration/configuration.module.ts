import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ShopConfigEntity } from '../../entities/shop-config.entity';
import { ShopEntity } from '../../entities/shop.entity';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { ShopConfigRegistry } from './shop-config-registry.service';
import { ShopConfigService } from './shop-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShopConfigEntity, ShopEntity])],
  providers: [ShopConfigRegistry, ShopConfigService, ConfigurationService],
  controllers: [ConfigurationController],
  exports: [ShopConfigRegistry, ShopConfigService, ConfigurationService],
})
export class ConfigurationModule {}
