import { IsEnum } from 'class-validator';

import { EntityType } from '@shopify-import/shared';

export class BulkImportRequestDto {
  @IsEnum(EntityType)
  entityType!: EntityType;
}
