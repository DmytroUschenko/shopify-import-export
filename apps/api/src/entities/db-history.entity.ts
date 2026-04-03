import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  CustomerPayload,
  EntityType,
  FulfillmentPayload,
  OrderPayload,
  ProductPayload,
} from '@shopify-import/shared';

import { ShopEntity } from './shop.entity';

type HistoryPayload =
  | OrderPayload
  | CustomerPayload
  | ProductPayload
  | FulfillmentPayload
  | Record<string, unknown>;

@Entity('db_import_history')
export class DbHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shopId!: string;

  @ManyToOne(() => ShopEntity, (shop) => shop.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop!: ShopEntity;

  @Column({ name: 'entity_id', type: 'varchar' })
  entityId!: string;

  @Column({ name: 'entity_type', type: 'enum', enum: EntityType })
  entityType!: EntityType;

  @Column({ type: 'jsonb' })
  data!: HistoryPayload;

  @Column({ type: 'varchar' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
