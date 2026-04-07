import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ShopEntity } from '../../entities/shop.entity';
import { ShopConfigRegistry } from './shop-config-registry.service';
import { ShopConfigService } from './shop-config.service';

export interface ConfigItemResponse {
  path: string;
  group: string;
  groupLabel: string;
  label: string;
  type: 'string' | 'boolean' | 'password';
  description?: string;
  writeOnly: boolean;
  /** Null when the path is write-only or has no value */
  value: string | null;
}

export interface GroupedConfigResponse {
  group: string;
  label: string;
  items: ConfigItemResponse[];
}

@Injectable()
export class ConfigurationService {
  constructor(
    private readonly shopConfigService: ShopConfigService,
    private readonly shopConfigRegistry: ShopConfigRegistry,
    @InjectRepository(ShopEntity)
    private readonly shopRepo: Repository<ShopEntity>
  ) {}

  async getGroupedConfig(shopDomain: string): Promise<GroupedConfigResponse[]> {
    const shop = await this.resolveShop(shopDomain);
    const groups = this.shopConfigRegistry.getGroupedDefinitions();

    return Promise.all(
      groups.map(async (group) => ({
        group: group.group,
        label: group.label,
        items: await Promise.all(
          group.items.map(async (def) => {
            const value = def.writeOnly
              ? null
              : await this.shopConfigService.get(shop.id, def.path);
            return {
              path: def.path,
              group: def.group,
              groupLabel: def.groupLabel,
              label: def.label,
              type: def.type,
              description: def.description,
              writeOnly: def.writeOnly ?? false,
              value,
            };
          })
        ),
      }))
    );
  }

  async getOne(shopDomain: string, configPath: string): Promise<ConfigItemResponse> {
    const shop = await this.resolveShop(shopDomain);
    const def = this.shopConfigRegistry.getDefinition(configPath);
    if (!def) {
      throw new NotFoundException(`Unknown config path: ${configPath}`);
    }

    const value = def.writeOnly
      ? null
      : await this.shopConfigService.get(shop.id, configPath);

    return {
      path: def.path,
      group: def.group,
      groupLabel: def.groupLabel,
      label: def.label,
      type: def.type,
      description: def.description,
      writeOnly: def.writeOnly ?? false,
      value,
    };
  }

  async upsertConfigs(
    shopDomain: string,
    updates: Record<string, string | null>
  ): Promise<void> {
    const shop = await this.resolveShop(shopDomain);
    await this.shopConfigService.setMany(shop.id, updates);
  }

  async upsertOne(
    shopDomain: string,
    configPath: string,
    value: string | null
  ): Promise<ConfigItemResponse> {
    const shop = await this.resolveShop(shopDomain);
    const def = this.shopConfigRegistry.getDefinition(configPath);
    if (!def) {
      throw new NotFoundException(`Unknown config path: ${configPath}`);
    }

    await this.shopConfigService.set(shop.id, configPath, value);

    return this.getOne(shopDomain, configPath);
  }

  private async resolveShop(shopDomain: string): Promise<ShopEntity> {
    const shop = await this.shopRepo.findOneBy({ domain: shopDomain });
    if (!shop) {
      throw new NotFoundException(`Shop not found: ${shopDomain}`);
    }
    return shop;
  }
}
