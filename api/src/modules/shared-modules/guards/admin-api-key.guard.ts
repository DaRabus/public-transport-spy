import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.validation';

/**
 * Routes reachable WITHOUT the admin key. Everything else is denied by default.
 *
 * - `/healthz`            liveness probe (no data)
 * - `/docs`, `/docs-json` Swagger documentation
 * - `/v1/transit`         public transport data (stations, departures)
 * - `/v1/auth/register`   new user registration (users are unauthorized at the start)
 * - `/v1/auth/login`      user authentication (users are unauthorized at the start)
 * - `/api/v1/device`      ESP32 hardware endpoints. Unclaimed devices may only call hello/claim
 *                         successfully; everything else is verified with the per-device
 *                         `X-Device-Token`. Versioned so firmware in the field keeps working
 *                         when a future /api/v2/device changes the contract.
 *
 * User profile endpoints (`/v1/auth/user/:userName`), device management (`/v1/devices/*`),
 * and pairing (`/v1/devices/pair`) are all PROTECTED and require X-Api-Key.
 */
const PUBLIC_EXACT = new Set(['/healthz', '/docs-json', '/v1/auth/register', '/v1/auth/login']);
const PUBLIC_PREFIXES = ['/docs', '/api/v1/device', '/v1/transit'];

function normalize(path: string): string {
  const urlOnly = path.split('?')[0];
  const trimmed = urlOnly.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Prefix match on path-segment boundaries (`/device` must not match `/devices`). */
function isPublicPath(rawPath: string): boolean {
  const path = normalize(rawPath);
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Global Admin API Key Guard (deny-by-default).
 * Protects user profiles, device configurations, pairing, and administration endpoints.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminApiKeyGuard.name);
  private readonly apiKey: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('ADMIN_API_KEY', { infer: true });
    if (!this.apiKey) {
      this.logger.error(
        'ADMIN_API_KEY is not set — all non-public routes (users, devices, pairing) will be rejected. Set it in your environment.'
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url;

    if (isPublicPath(path)) {
      return true;
    }

    if (!this.apiKey) {
      throw new UnauthorizedException('Unauthorized: server has no ADMIN_API_KEY configured');
    }

    const raw = req.headers['x-api-key'];
    const provided = Array.isArray(raw) ? raw[0] : (raw ?? '');

    const a = Buffer.from(provided);
    const b = Buffer.from(this.apiKey);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException(
        'Unauthorized: Missing or invalid administrative API key in X-Api-Key header'
      );
    }

    return true;
  }
}
