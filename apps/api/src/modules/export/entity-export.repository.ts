import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExportStatus } from '@shopify-import/shared';
import { Repository } from 'typeorm';

import { EntityExportEntity } from '../../entities/entity-export.entity';

@Injectable()
export class EntityExportRepository {
  constructor(
    @InjectRepository(EntityExportEntity)
    private readonly repo: Repository<EntityExportEntity>
  ) {}

  async upsert(
    shopId: string,
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    status: ExportStatus = ExportStatus.Pending
  ): Promise<EntityExportEntity> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(EntityExportEntity)
      .values({ shopId, entityType, entityId, data, status })
      .orUpdate(['status', 'data', 'updated_at'], ['shop_id', 'entity_id', 'entity_type'])
      .execute();

    return this.repo.findOneOrFail({ where: { shopId, entityType, entityId } });
  }

  async updateStatus(id: string, status: ExportStatus): Promise<void> {
    await this.repo.update({ id }, { status });
  }

  async findPendingByShop(shopId: string): Promise<EntityExportEntity[]> {
    return this.repo.find({
      where: { shopId, status: ExportStatus.Pending },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<EntityExportEntity | null> {
    return this.repo.findOneBy({ id });
  }
}
