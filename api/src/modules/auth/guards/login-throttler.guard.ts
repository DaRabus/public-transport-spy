import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Header the BFF sets to the browser's IP (the API only sees the BFF's own address). */
const CLIENT_IP_HEADER = 'x-client-ip';

/** Name of the per-IP-and-username throttler (see shared-modules/config/throttling.ts). */
export const LOGIN_USER_THROTTLER = 'login';

/**
 * Login throttling that an attacker cannot use to lock someone else out:
 * - `default` throttler: all logins from one client IP.
 * - `login` throttler: logins for one username from one client IP, so guessing a password is capped
 *   per IP without blocking the real owner who logs in from a different address.
 * The client IP is trusted because AdminApiKeyGuard already ran: only the BFF holds the API key.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const header = req.headers?.[CLIENT_IP_HEADER];
    return Promise.resolve((typeof header === 'string' && header.trim()) || req.ip || 'unknown');
  }

  protected override generateKey(
    context: ExecutionContext,
    tracker: string,
    throttlerName: string
  ): string {
    if (throttlerName !== LOGIN_USER_THROTTLER) {
      return super.generateKey(context, tracker, throttlerName);
    }
    const userName = context.switchToHttp().getRequest().body?.userName;
    const name = typeof userName === 'string' ? userName.trim().toLowerCase() : '';
    return super.generateKey(context, `${tracker}:${name}`, throttlerName);
  }
}
