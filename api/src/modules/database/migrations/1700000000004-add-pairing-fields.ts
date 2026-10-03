import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPairingFields1700000000004 implements MigrationInterface {
  name = 'AddPairingFields1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device" ADD COLUMN "isPaired" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "device" ADD COLUMN "pairingCode" varchar(16) NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "device" ADD COLUMN "pairingCodeExpiresAt" timestamptz NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "device" ADD COLUMN "claimedAt" timestamptz NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_device_pairingCode" ON "device" ("pairingCode")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_device_pairingCode"`);
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "claimedAt"`);
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "pairingCodeExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "pairingCode"`);
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "isPaired"`);
  }
}
