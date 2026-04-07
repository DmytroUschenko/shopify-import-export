import { EntityExportEntity } from '../../../entities/entity-export.entity';

export interface EntityProcessor {
  process(exportRecord: EntityExportEntity): Promise<void>;
}

export const ENTITY_PROCESSOR = 'ENTITY_PROCESSOR';
