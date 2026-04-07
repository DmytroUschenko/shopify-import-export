import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ExportStatus } from '@shopify-import/shared';

import { ShopEntity } from './shop.entity';

@Entity('entity_export')
@Index(['shopId', 'entityId', 'entityType'], { unique: true })
export class EntityExportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shopId!: string;

  @ManyToOne(() => ShopEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop!: ShopEntity;

  @Column({ name: 'entity_type', type: 'varchar' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar' })
  entityId!: string;

  @Column({
    type: 'enum',
    enum: ExportStatus,
    default: ExportStatus.Pending,
  })
  status!: ExportStatus;

  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
