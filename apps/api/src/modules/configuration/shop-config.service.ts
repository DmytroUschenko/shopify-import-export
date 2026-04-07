import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ShopConfigEntity } from '../../entities/shop-config.entity';
import { ShopConfigRegistry } from './shop-config-registry.service';

@Injectable()
export class ShopConfigService {
  constructor(
    @InjectRepository(ShopConfigEntity)
    private readonly repo: Repository<ShopConfigEntity>,
    private readonly registry: ShopConfigRegistry
  ) {}

  /** Returns the stored value, falling back to the registry default if no row exists. */
  async get(shopId: string, path: string): Promise<string | null> {
    const row = await this.repo.findOneBy({ shopId, configPath: path });
    if (row) return row.configValue;
    return this.registry.getDefault(path) ?? null;
  }

  /** Returns the stored value, falling back to registry default, then the supplied fallback. */
  async getWithDefault(shopId: string, path: string, fallback: string): Promise<string> {
    const value = await this.get(shopId, path);
    return value ?? fallback;
  }

  /** Upserts a single config path value. */
  async set(shopId: string, path: string, value: string | null): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ShopConfigEntity)
      .values({ shopId, configPath: path, configValue: value })
      .orUpdate(['config_value'], ['shop_id', 'config_path'])
      .execute();
  }

  /** Batch upsert — all writes happen in a single transaction. */
  async setMany(shopId: string, entries: Record<string, string | null>): Promise<void> {
    if (Object.keys(entries).length === 0) return;

    await this.repo.manager.transaction(async (em: EntityManager) => {
      for (const [path, value] of Object.entries(entries)) {
        await em
          .createQueryBuilder()
          .insert()
          .into(ShopConfigEntity)
          .values({ shopId, configPath: path, configValue: value })
          .orUpdate(['config_value'], ['shop_id', 'config_path'])
          .execute();
      }
    });
  }

  /**
   * Returns all config values whose path starts with `prefix`,
   * merged with registry defaults (DB values take precedence).
   */
  async getByPrefix(shopId: string, prefix: string): Promise<Map<string, string | null>> {
    const rows = await this.repo
      .createQueryBuilder('sc')
      .where('sc.shop_id = :shopId', { shopId })
      .andWhere('sc.config_path LIKE :prefix', { prefix: `${prefix}%` })
      .getMany();

    const result = new Map<string, string | null>();

    // Seed with registry defaults for paths under this prefix
    for (const def of this.registry.getAllDefinitions()) {
      if (def.path.startsWith(prefix)) {
        result.set(def.path, def.defaultValue ?? null);
      }
    }

    // DB values override defaults
    for (const row of rows) {
      result.set(row.configPath, row.configValue);
    }

    return result;
  }
}
