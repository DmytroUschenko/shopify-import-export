import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { DbHistoryEntity } from './db-history.entity';
import { DbImportEntity } from './db-import.entity';

@Entity('shops')
export class ShopEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  domain!: string;

  @Column({ name: 'access_token', type: 'varchar' })
  accessToken!: string;

  @CreateDateColumn({ name: 'installed_at', type: 'timestamp with time zone' })
  installedAt!: Date;

  @OneToMany(() => DbImportEntity, (dbImport) => dbImport.shop)
  imports!: DbImportEntity[];

  @OneToMany(() => DbHistoryEntity, (dbHistory) => dbHistory.shop)
  history!: DbHistoryEntity[];
}
