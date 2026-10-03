import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAndDeviceUserId1700000000005 implements MigrationInterface {
  name = 'CreateUserAndDeviceUserId1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userName" varchar(128) NOT NULL,
        "passwordHash" varchar(256) NOT NULL,
        "role" varchar(32) NOT NULL DEFAULT 'USER',
        CONSTRAINT "PK_user_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_userName" ON "user" ("userName")`);
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN IF NOT EXISTS "userId" varchar(128) NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_device_userId" ON "device" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_device_userId"`);
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_userName"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
  }
}
