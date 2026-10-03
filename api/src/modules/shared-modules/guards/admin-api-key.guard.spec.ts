import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

describe('AdminApiKeyGuard', () => {
  let guard: AdminApiKeyGuard;
  let mockConfigService: { get: jest.Mock };

  function createMockContext(
    path: string,
    headers: Record<string, string | undefined>
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          url: path,
          headers
        })
      })
    } as unknown as ExecutionContext;
  }

  describe('when ADMIN_API_KEY is configured', () => {
    beforeEach(() => {
      mockConfigService = {
        get: jest.fn().mockReturnValue('super-secret-key')
      };
      guard = new AdminApiKeyGuard(mockConfigService as unknown as ConfigService<any, true>);
    });

    it('allows access to public paths without key', () => {
      const healthContext = createMockContext('/healthz', {});
      const docsContext = createMockContext('/docs', {});
      const docsJsonContext = createMockContext('/docs-json', {});
      const deviceContext = createMockContext('/api/v1/device/config', {});
      const registerContext = createMockContext('/v1/auth/register', {});
      const loginContext = createMockContext('/v1/auth/login', {});
      const transitContext = createMockContext('/v1/transit/departures?station=Bern', {});

      expect(guard.canActivate(healthContext)).toBe(true);
      expect(guard.canActivate(docsContext)).toBe(true);
      expect(guard.canActivate(docsJsonContext)).toBe(true);
      expect(guard.canActivate(deviceContext)).toBe(true);
      expect(guard.canActivate(registerContext)).toBe(true);
      expect(guard.canActivate(loginContext)).toBe(true);
      expect(guard.canActivate(transitContext)).toBe(true);
    });

    it('protects private user routes and device admin routes', () => {
      const userProfileContext = createMockContext('/v1/auth/user/alice', {});
      const devicesContext = createMockContext('/v1/devices', {});
      const devicesQueryContext = createMockContext('/v1/devices?userId=alice', {});

      expect(() => guard.canActivate(userProfileContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(devicesContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(devicesQueryContext)).toThrow(UnauthorizedException);
    });

    it('no longer exposes the unversioned device aliases', () => {
      expect(() => guard.canActivate(createMockContext('/api/device/config', {}))).toThrow(
        UnauthorizedException
      );
      expect(() => guard.canActivate(createMockContext('/device/config', {}))).toThrow(
        UnauthorizedException
      );
      // Segment-boundary match: a lookalike prefix must not slip through.
      expect(() => guard.canActivate(createMockContext('/api/v1/devicesX', {}))).toThrow(
        UnauthorizedException
      );
    });

    it('allows access to protected paths when valid X-Api-Key is provided', () => {
      const context = createMockContext('/v1/devices', {
        'x-api-key': 'super-secret-key'
      });
      const userContext = createMockContext('/v1/auth/user/alice', {
        'x-api-key': 'super-secret-key'
      });
      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(userContext)).toBe(true);
    });

    it('throws UnauthorizedException when X-Api-Key is missing or invalid', () => {
      const missingKey = createMockContext('/v1/devices', {});
      const wrongKey = createMockContext('/v1/devices', { 'x-api-key': 'wrong-key' });

      expect(() => guard.canActivate(missingKey)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(wrongKey)).toThrow(UnauthorizedException);
    });
  });

  describe('when ADMIN_API_KEY is not set', () => {
    beforeEach(() => {
      mockConfigService = {
        get: jest.fn().mockReturnValue('')
      };
      guard = new AdminApiKeyGuard(mockConfigService as unknown as ConfigService<any, true>);
    });

    it('rejects protected routes (fail-closed)', () => {
      const context = createMockContext('/v1/devices', {});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('still allows public routes', () => {
      const healthContext = createMockContext('/healthz', {});
      const registerContext = createMockContext('/v1/auth/register', {});
      expect(guard.canActivate(healthContext)).toBe(true);
      expect(guard.canActivate(registerContext)).toBe(true);
    });
  });
});
