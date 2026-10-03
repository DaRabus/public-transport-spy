import type { ThrottlerOptions } from '@nestjs/throttler';
import { LOGIN_USER_THROTTLER } from '../../auth/guards/login-throttler.guard';

/**
 * Throttlers every ThrottlerGuard evaluates. `default` is overridden per endpoint with @Throttle;
 * `login` only runs for the login handler (10 attempts per client IP and username per 15 minutes).
 */
export const THROTTLERS: ThrottlerOptions[] = [
  { name: 'default', ttl: 60_000, limit: 60 },
  {
    name: LOGIN_USER_THROTTLER,
    ttl: 15 * 60_000,
    limit: 10,
    skipIf: (context) => context.getHandler().name !== 'login'
  }
];
