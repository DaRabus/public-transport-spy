import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Integration tests run with NODE_ENV=test: keep their output readable.
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        autoLogging: {
          ignore: (req) => req.url === '/healthz'
        },
        redact: ['req.headers.authorization']
      }
    })
  ],
  exports: [ConfigModule, LoggerModule]
})
export class CommonModule {}
