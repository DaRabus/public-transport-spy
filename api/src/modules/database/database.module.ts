import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../shared-modules/config/env.validation';
import { ALL_ENTITIES } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        entities: ALL_ENTITIES,
        synchronize: false,
        migrationsRun: config.get('NODE_ENV', { infer: true }) !== 'test',
        migrations: [__dirname + '/migrations/*.{js,ts}'],
        logging: ['error', 'warn']
      })
    })
  ]
})
export class DatabaseModule {}
