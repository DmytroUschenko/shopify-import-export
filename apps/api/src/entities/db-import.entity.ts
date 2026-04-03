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

import {
  CustomerPayload,
  EntityType,
  FulfillmentPayload,
  ImportStatus,
  OrderPayload,
  ProductPayload,
} from '@shopify-import/shared';

import { ShopEntity } from './shop.entity';

type ImportPayload =
  | OrderPayload
  | CustomerPayload
  | ProductPayload
  | FulfillmentPayload
  | Record<string, unknown>;

@Entity('db_import')
@Index(['shopId', 'entityId', 'entityType'], { unique: true })
export class DbImportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shopId!: string;

  @ManyToOne(() => ShopEntity, (shop) => shop.imports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop!: ShopEntity;

  @Column({ name: 'entity_id', type: 'varchar' })
  entityId!: string;

  @Column({ name: 'entity_type', type: 'enum', enum: EntityType })
  entityType!: EntityType;

  @Column({ type: 'jsonb' })
  data!: ImportPayload;

  @Column({ type: 'enum', enum: ImportStatus, default: ImportStatus.Received })
  status!: ImportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
