import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceAndMetricsTables1700000000002 implements MigrationInterface {
  name = 'CreateDeviceAndMetricsTables1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "device" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deviceUuid" varchar(64) NOT NULL,
        "name" varchar(128) NOT NULL DEFAULT 'ESP32 Departure Board',
        "stationName" varchar(128) NOT NULL DEFAULT 'Zürich HB',
        "stationId" varchar(64) NULL,
        "timezone" varchar(64) NOT NULL DEFAULT 'CET-1CEST,M3.5.0,M10.5.0/3',
        "theme" varchar(32) NOT NULL DEFAULT 'standard',
        "apiInterval" int NOT NULL DEFAULT 300000,
        "screenInterval" int NOT NULL DEFAULT 15000,
        "metricsInterval" int NOT NULL DEFAULT 600000,
        "isConfigured" boolean NOT NULL DEFAULT true,
        "lastSeenAt" timestamptz NULL,
        "lastIp" varchar(64) NULL
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_device_deviceUuid" ON "device" ("deviceUuid")`);

    await queryRunner.query(`
      CREATE TABLE "device_metric" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deviceUuid" varchar(64) NOT NULL,
        "stationName" varchar(128) NOT NULL,
        "uptimeSeconds" bigint NOT NULL,
        "resetReason" int NOT NULL,
        "cpuFreqMHz" int NOT NULL,
        "ramFreeBytes" bigint NOT NULL,
        "ramTotalBytes" bigint NOT NULL,
        "ramMinFreeEver" bigint NOT NULL,
        "ramMaxAllocBlock" bigint NOT NULL,
        "fsTotalBytes" bigint NOT NULL,
        "fsUsedBytes" bigint NOT NULL,
        "wifiSignalRssi" int NOT NULL,
        "wifiBssid" varchar(32) NULL,
        "wifiChannel" int NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_device_metric_deviceUuid" ON "device_metric" ("deviceUuid")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_device_metric_deviceUuid"`);
    await queryRunner.query(`DROP TABLE "device_metric"`);
    await queryRunner.query(`DROP INDEX "IDX_device_deviceUuid"`);
    await queryRunner.query(`DROP TABLE "device"`);
  }
}
