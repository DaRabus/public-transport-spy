import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceToken1700000000003 implements MigrationInterface {
  name = 'AddDeviceToken1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "deviceToken" varchar(64) NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_device_deviceToken" ON "device" ("deviceToken")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_device_deviceToken"`);
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "deviceToken"`);
  }
}
