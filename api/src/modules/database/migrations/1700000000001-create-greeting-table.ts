import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGreetingTable1700000000001 implements MigrationInterface {
  name = 'CreateGreetingTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "hello_greeting" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "greeting" varchar(255) NOT NULL,
        "author" varchar(100) NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO "hello_greeting" ("greeting", "author")
      VALUES ('Hello, World!', 'System')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "hello_greeting"`);
  }
}
