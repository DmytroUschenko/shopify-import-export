import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ShopEntity } from './shop.entity';

@Entity('shop_config')
@Index(['shopId', 'configPath'], { unique: true })
export class ShopConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shopId!: string;

  @ManyToOne(() => ShopEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop!: ShopEntity;

  @Column({ name: 'config_path', type: 'varchar' })
  configPath!: string;

  @Column({ name: 'config_value', type: 'text', nullable: true })
  configValue!: string | null;
}
