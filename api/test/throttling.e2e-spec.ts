import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { DeviceClientController } from '../src/modules/device/controllers/device-client.controller';
import { DeviceAdminController } from '../src/modules/device/controllers/device-admin.controller';
import { DeviceService } from '../src/modules/device/services/device.service';
import { THROTTLERS } from '../src/modules/shared-modules/config/throttling';
import { configureApp } from '../src/app.setup';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  const authService = {
    register: jest.fn().mockResolvedValue({}),
    login: jest.fn().mockRejectedValue(new Error('unused'))
  };
  const deviceService = {
    claimDevice: jest.fn().mockResolvedValue({}),
    pairDevice: jest.fn().mockResolvedValue({})
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLERS)],
      controllers: [AuthController, DeviceClientController, DeviceAdminController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: DeviceService, useValue: deviceService }
      ]
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Fires `limit` requests that must pass, then one more that must be rejected with 429. */
  async function expectLimit(send: () => request.Test, limit: number): Promise<void> {
    for (let i = 0; i < limit; i++) {
      expect((await send()).status).not.toBe(429);
    }
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  }

  it('limits POST /api/v1/device/claim to 10 per minute', async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/device/claim')
        .send({ pairingCode: 'ABC234', deviceUuid: 'd3b07384-d113-3660-84cf-3b999cd46903' });
    await expectLimit(send, 10);
  });

  it('limits POST /v1/auth/register to 20 per hour', async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ userName: 'alice', password: 'correct-horse-battery' });
    await expectLimit(send, 20);
  });

  it('limits POST /v1/devices/pair to 30 per minute', async () => {
    const send = () => request(app.getHttpServer()).post('/v1/devices/pair').send({});
    await expectLimit(send, 30);
  });

  describe('login', () => {
    const login = (userName: string, ip: string) =>
      request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Client-Ip', ip)
        .send({ userName, password: 'x' });

    it('blocks guessing for one username from one IP after 10 attempts, case-insensitively', async () => {
      for (let i = 0; i < 10; i++) {
        expect((await login(i % 2 ? 'Bob' : 'bob', '10.0.0.1')).status).not.toBe(429);
      }
      expect((await login(' BOB ', '10.0.0.1')).status).toBe(429);
    });

    it('does not let an attacker lock the owner out: other IPs and other usernames still work', async () => {
      expect((await login('bob', '10.0.0.1')).status).toBe(429); // attacker, from the test above
      expect((await login('bob', '10.0.0.2')).status).not.toBe(429); // owner, different IP
      expect((await login('carol', '10.0.0.1')).status).not.toBe(429); // same IP, other account
    });

    it('limits one IP to 30 logins per 15 minutes across usernames (password spraying)', async () => {
      for (let i = 0; i < 30; i++) {
        expect((await login(`user${i}`, '10.0.0.9')).status).not.toBe(429);
      }
      expect((await login('another', '10.0.0.9')).status).toBe(429);
    });
  });
});
