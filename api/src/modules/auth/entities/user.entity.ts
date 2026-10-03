import { Column, Entity, Index, OneToMany, Relation } from 'typeorm';
import { AbstractEntity } from '../../shared-modules/abstract/lib';
import { Device } from '../../device/entities/device.entity';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

@Entity({ name: 'user' })
export class User extends AbstractEntity {
  @Index('IDX_user_userName', { unique: true })
  @Column({ type: 'varchar', length: 128 })
  userName!: string;

  @Column({ type: 'varchar', length: 256 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 32, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'varchar', length: 512, nullable: true })
  socialUrl?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatarUrl?: string | null;

  @OneToMany(() => Device, (device) => device.user)
  devices?: Relation<Device[]>;
}
