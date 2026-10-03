import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1700000000006 implements MigrationInterface {
  name = 'AddUserProfileFields1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "socialUrl" varchar(512) NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "avatarUrl" varchar(512) NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bannedTimestamp" bigint NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "bannedTimestamp"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "socialUrl"`);
  }
}
