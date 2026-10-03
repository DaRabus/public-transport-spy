import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { AbstractEntity } from '../../shared-modules/abstract/lib';
import { User } from '../../auth/entities/user.entity';
import { DeviceMetric } from './device-metric.entity';
import type { DisplayProfile, Theme } from '../screens/screen-composer';

@Entity({ name: 'device' })
export class Device extends AbstractEntity {
  @Index('IDX_device_deviceUuid', { unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceUuid!: string | null;

  @Column({ type: 'varchar', length: 128, default: 'ESP32 Departure Board' })
  name!: string;

  @Column({ type: 'varchar', length: 128, default: 'Zürich HB' })
  stationName!: string;

  /** IANA zone (see timezones/timezones.ts); converted to POSIX for the firmware. */
  @Column({ type: 'varchar', length: 64, default: 'Europe/Zurich' })
  timezone!: string;

  @Column({ type: 'varchar', length: 32, default: 'standard' })
  theme!: Theme;

  @Column({ type: 'int', default: 300000 })
  apiInterval!: number; // 5 minutes in ms

  @Column({ type: 'int', default: 15000 })
  screenInterval!: number; // 15 seconds in ms

  @Column({ type: 'int', default: 600000 })
  metricsInterval!: number; // 10 minutes in ms

  /** false = the owner switched the display off (device gets 403 and blanks the panel). */
  @Column({ type: 'boolean', default: true })
  isConfigured!: boolean;

  /** Optional daily on/off window (local time). */
  @Column({ type: 'boolean', default: false })
  scheduleEnabled!: boolean;

  @Column({ type: 'smallint', default: 360 })
  scheduleOn!: number;

  @Column({ type: 'smallint', default: 1380 })
  scheduleOff!: number;

  /** Weekday bits the window starts on: bit 0 = Sunday ... bit 6 = Saturday. */
  @Column({ type: 'smallint', default: 127 })
  scheduleDays!: number;

  /** Owner's screen pages (see screens/screen-composer.ts); null = default departures board. */
  @Column({ type: 'jsonb', nullable: true })
  display!: DisplayProfile | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastIp!: string | null;

  @Index('IDX_device_deviceToken', { unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceToken!: string | null;

  @Column({ type: 'boolean', default: false })
  isPaired!: boolean;

  @Index('IDX_device_pairingCode', { unique: true })
  @Column({ type: 'varchar', length: 16, nullable: true })
  pairingCode!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  pairingCodeExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  /** FK to `user.id` (owner). Nulled when the owner is deleted or the device is unpaired. */
  @Index('IDX_device_userId')
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.devices, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_device_userId' })
  user?: Relation<User> | null;

  @OneToMany(() => DeviceMetric, (metric) => metric.device)
  metrics?: Relation<DeviceMetric[]>;
}

/**
 * A display handed back (owner deleted their account): no owner, not paired, personal settings
 * cleared so the next owner sees nothing of the previous one. The device keeps its token and shows
 * a fresh backend-issued pairing code on its next config poll, so anyone holding it can claim it.
 */
export const RELEASED_DEVICE_RESET: Partial<Device> = {
  userId: null,
  isPaired: false,
  pairingCode: null,
  pairingCodeExpiresAt: null,
  claimedAt: null,
  name: 'ESP32 Departure Board',
  display: null,
  isConfigured: true,
  scheduleEnabled: false
};
