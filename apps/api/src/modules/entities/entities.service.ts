import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityType } from '@shopify-import/shared';
import { Repository } from 'typeorm';

import { DbImportEntity } from '../../entities/db-import.entity';

@Injectable()
export class EntitiesService {
  constructor(
    @InjectRepository(DbImportEntity)
    private readonly dbImportRepository: Repository<DbImportEntity>
  ) {}

  async getStats() {
    const [orders, customers, products] = await Promise.all([
      this.dbImportRepository.countBy({ entityType: EntityType.Order }),
      this.dbImportRepository.countBy({ entityType: EntityType.Customer }),
      this.dbImportRepository.countBy({ entityType: EntityType.Product }),
    ]);

    return { orders, customers, products };
  }

  async listEntities(entityTypeInput: string, page: number, limit: number) {
    const entityType = this.parseEntityType(entityTypeInput);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const [items, total] = await this.dbImportRepository.findAndCount({
      where: { entityType },
      order: { updatedAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        entityId: item.entityId,
        entityType: item.entityType,
        status: item.status,
        updatedAt: item.updatedAt.toISOString(),
      })),
      total,
    };
  }

  private parseEntityType(entityTypeInput: string): EntityType {
    const entityType = entityTypeInput as EntityType;
    if (!Object.values(EntityType).includes(entityType)) {
      throw new BadRequestException(`Unsupported entity type: ${entityTypeInput}`);
    }

    return entityType;
  }
}
