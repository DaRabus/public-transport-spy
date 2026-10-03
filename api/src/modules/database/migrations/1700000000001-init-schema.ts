import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Complete schema. Requires PostgreSQL 18+ for the native uuidv7() primary-key default
 * (see AbstractEntity). New changes go into new, additive migrations from here on.
 */
export class InitSchema1700000000001 implements MigrationInterface {
  name = 'InitSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userName" varchar(128) NOT NULL,
        "passwordHash" varchar(256) NOT NULL,
        "role" varchar(32) NOT NULL DEFAULT 'USER',
        "socialUrl" varchar(512),
        "avatarUrl" varchar(512),
        CONSTRAINT "PK_user" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_userName" ON "user" ("userName")`);

    await queryRunner.query(`
      CREATE TABLE "device" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deviceUuid" varchar(64),
        "name" varchar(128) NOT NULL DEFAULT 'ESP32 Departure Board',
        "stationName" varchar(128) NOT NULL DEFAULT 'Zürich HB',
        "timezone" varchar(64) NOT NULL DEFAULT 'Europe/Zurich',
        "theme" varchar(32) NOT NULL DEFAULT 'standard',
        "apiInterval" integer NOT NULL DEFAULT 300000,
        "screenInterval" integer NOT NULL DEFAULT 15000,
        "metricsInterval" integer NOT NULL DEFAULT 600000,
        "isConfigured" boolean NOT NULL DEFAULT true,
        "scheduleEnabled" boolean NOT NULL DEFAULT false,
        "scheduleOn" smallint NOT NULL DEFAULT 360,
        "scheduleOff" smallint NOT NULL DEFAULT 1380,
        "scheduleDays" smallint NOT NULL DEFAULT 127,
        "display" jsonb,
        "lastSeenAt" timestamptz,
        "lastIp" varchar(64),
        "deviceToken" varchar(64),
        "isPaired" boolean NOT NULL DEFAULT false,
        "pairingCode" varchar(16),
        "pairingCodeExpiresAt" timestamptz,
        "claimedAt" timestamptz,
        "userId" uuid,
        CONSTRAINT "PK_device" PRIMARY KEY ("id"),
        CONSTRAINT "FK_device_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_device_deviceUuid" ON "device" ("deviceUuid")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_device_deviceToken" ON "device" ("deviceToken")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_device_pairingCode" ON "device" ("pairingCode")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_device_userId" ON "device" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "device_metric" (
        "id" uuid NOT NULL DEFAULT uuidv7(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deviceId" uuid NOT NULL,
        "stationName" varchar(128) NOT NULL,
        "uptimeSeconds" integer NOT NULL,
        "resetReason" integer NOT NULL,
        "cpuFreqMHz" integer NOT NULL,
        "ramFreeBytes" integer NOT NULL,
        "ramTotalBytes" integer NOT NULL,
        "ramMinFreeEver" integer NOT NULL,
        "ramMaxAllocBlock" integer NOT NULL,
        "fsTotalBytes" integer NOT NULL,
        "fsUsedBytes" integer NOT NULL,
        "wifiSignalRssi" integer NOT NULL,
        "wifiBssid" varchar(32),
        "wifiChannel" integer NOT NULL,
        "firmwareVersion" varchar(32),
        CONSTRAINT "PK_device_metric" PRIMARY KEY ("id"),
        CONSTRAINT "FK_device_metric_deviceId" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_device_metric_deviceId" ON "device_metric" ("deviceId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "device_metric"`);
    await queryRunner.query(`DROP TABLE "device"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
