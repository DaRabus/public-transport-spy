import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import { configureApp } from './app.setup';
import type { Env } from './modules/shared-modules/config/env.validation';

function setupSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Public Transport Spy API')
    .setDescription(
      'Backend API for Public Transport Spy.\n\n' +
        'All endpoints are versioned via URI. The current version is **v1**; ' +
        'every business path is prefixed with `/v1/`. ' +
        'Liveness (`/healthz`) is unversioned; hardware endpoints carry the version in their path (`/api/v1/device/*`).\n\n' +
        'Administrative endpoints require an `X-Api-Key` header.'
    )
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'X-Api-Key')
    .addTag('device-client', 'Endpoints called directly by ESP32 runner.cpp firmware')
    .addTag('devices', 'Device management and administration (Protected by X-Api-Key)')
    .addTag('transit', 'Public transport station search and departure boards')
    .addTag('health', 'Liveness check')
    .build();

  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, doc, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { displayRequestDuration: true }
  });
}

function printBanner(port: number, env: string, apiKeyEnabled: boolean): void {
  const W = 60;
  const line = '═'.repeat(W);
  const sep = '─'.repeat(W - 2);
  const auth = apiKeyEnabled ? 'X-Api-Key required' : '⚠  unauthenticated';
  const row = (label: string, value: string) => `  ${label.padEnd(14)}${value}`;

  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      `\x1b[35m${line}\x1b[0m`,
      `\x1b[1;35m  Public Transport Spy — API\x1b[0m`,
      `  ${sep}`,
      row('API:', `http://localhost:${port}`),
      row('Swagger UI:', `http://localhost:${port}/docs`),
      row('Swagger JSON:', `http://localhost:${port}/docs-json`),
      row('Health:', `http://localhost:${port}/healthz`),
      `  ${sep}`,
      row('Admin Auth:', auth),
      row('Environment:', env),
      `\x1b[35m${line}\x1b[0m`,
      ''
    ].join('\n')
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const env = config.get('NODE_ENV', { infer: true });
  const apiKey = config.get('ADMIN_API_KEY', { infer: true });

  configureApp(app, { trustProxy: config.get('TRUST_PROXY', { infer: true }) });

  app.enableShutdownHooks();

  // The API surface is not advertised in production unless explicitly enabled.
  const swaggerFlag = config.get('ENABLE_SWAGGER', { infer: true });
  if (swaggerFlag ? swaggerFlag === 'true' : env !== 'production') {
    setupSwagger(app);
  }

  await app.listen(port, '0.0.0.0');

  printBanner(port, env, !!apiKey);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('bootstrap failed', err);
  process.exit(1);
});
