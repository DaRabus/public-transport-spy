import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { AbstractEntity } from '../../shared-modules/abstract/lib';
import { Device } from './device.entity';

@Entity({ name: 'device_metric' })
export class DeviceMetric extends AbstractEntity {
  /** FK to `device.id`; metrics are deleted together with their device. */
  @Index('IDX_device_metric_deviceId')
  @Column({ type: 'uuid' })
  deviceId!: string;

  @ManyToOne(() => Device, (device) => device.metrics, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId', foreignKeyConstraintName: 'FK_device_metric_deviceId' })
  device?: Relation<Device>;

  @Column({ type: 'varchar', length: 128 })
  stationName!: string;

  @Column({ type: 'integer' })
  uptimeSeconds!: number;

  @Column({ type: 'int' })
  resetReason!: number;

  @Column({ type: 'int' })
  cpuFreqMHz!: number;

  @Column({ type: 'integer' })
  ramFreeBytes!: number;

  @Column({ type: 'integer' })
  ramTotalBytes!: number;

  @Column({ type: 'integer' })
  ramMinFreeEver!: number;

  @Column({ type: 'integer' })
  ramMaxAllocBlock!: number;

  @Column({ type: 'integer' })
  fsTotalBytes!: number;

  @Column({ type: 'integer' })
  fsUsedBytes!: number;

  @Column({ type: 'int' })
  wifiSignalRssi!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  wifiBssid!: string | null;

  @Column({ type: 'int' })
  wifiChannel!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  firmwareVersion!: string | null;
}
