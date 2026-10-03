import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Application-wide HTTP configuration shared by `main.ts` and the e2e tests,
 * so tests exercise exactly the same pipes/versioning as production.
 */
export function configureApp(app: INestApplication, opts: { trustProxy?: boolean } = {}): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Strip, don't reject: devices in the field run older/newer firmware than the backend, and an
      // extra property must never knock them offline. whitelist still drops it before any handler sees it.
      forbidNonWhitelisted: false
    })
  );

  app.enableVersioning({ type: VersioningType.URI });

  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  // Only trust X-Forwarded-For when explicitly running behind ONE reverse proxy that overwrites it
  // (docs/deployment.md section 5); otherwise clients could spoof their IP and dodge per-IP limits.
  express.set('trust proxy', opts.trustProxy ? 1 : false);
}
