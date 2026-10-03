import { ThrottlerGuard } from '@nestjs/throttler';
import { LoginThrottlerGuard } from '../../src/modules/auth/guards/login-throttler.guard';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';

/**
 * Database-to-API integration harness: the real AppModule (guard, validation, services, TypeORM) on a
 * real PostgreSQL 18 database with the real migrations. Only the external timetable provider is
 * stubbed so results are deterministic.
 *
 * Database: INTEGRATION_DATABASE_URL, default = a dedicated "public_transport_spy_test" database on
 * the local pts-postgres container (created if missing). Never the development database.
 */
export const ADMIN_KEY = 'integration-admin-key-0123456789abcdef';
export const PASSWORD = 'Integration-Test-1234!';
export const TEST_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:4700/public_transport_spy_test';

export interface TransitStub {
  getDepartures: jest.Mock;
  searchStations: jest.Mock;
}

export interface IntegrationContext {
  app: INestApplication;
  dataSource: DataSource;
  transit: TransitStub;
}

async function ensureDatabase(url: string): Promise<void> {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unexpected test database name '${name}'`);
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const admin = await new DataSource({
    type: 'postgres',
    url: maintenance.toString()
  }).initialize();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!exists.length) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.destroy();
  }
}

export async function createIntegrationApp(): Promise<IntegrationContext> {
  await ensureDatabase(TEST_DATABASE_URL);

  // The config module validates the environment when AppModule is imported, so set it first.
  // Runtime env vars take precedence over api/.env, which keeps the dev database out of reach.
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    ADMIN_API_KEY: ADMIN_KEY,
    PUBLIC_APP_URL: 'https://app.example.test',
    DEVICE_BACKEND_URL: ''
  });
  const { AppModule } = await import('../../src/modules/app.module');
  const { TransitService } = await import('../../src/modules/transit/services/transit.service');
  const { configureApp } = await import('../../src/app.setup');

  const transit: TransitStub = {
    getDepartures: jest.fn(async () => []),
    searchStations: jest.fn(async () => [])
  };
  // Tests register many accounts in one run; the limits themselves are covered by test/throttling.e2e-spec.ts.
  const allowAll = { canActivate: () => true };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowAll)
    .overrideGuard(LoginThrottlerGuard)
    .useValue(allowAll)
    .overrideProvider(TransitService)
    .useValue(transit)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  await dataSource.runMigrations(); // migrationsRun is off for NODE_ENV=test
  return { app, dataSource, transit };
}

/** Empties all tables between tests (schema and migrations stay). */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE "device_metric", "device", "user" CASCADE');
}

/** Small HTTP helpers shared by the integration specs. */
export function apiClient(app: INestApplication) {
  const http = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(req: T) => req.set('X-Api-Key', ADMIN_KEY);

  return {
    http,
    asAdmin,
    register: (userName: string) =>
      http().post('/v1/auth/register').send({ userName, password: PASSWORD }).expect(201),
    /** Owner enters the code shown on a display (pending request until the device confirms). */
    pair: (userName: string, pairingCode: string) =>
      asAdmin(http().post('/v1/devices/pair')).send({ pairingCode, userId: userName }),
    /** The display confirms its code with its hardware UUID; returns the response (token on 200). */
    claim: (pairingCode: string, deviceUuid: string) =>
      http().post('/api/v1/device/claim').send({ pairingCode, deviceUuid }),
    /** Pairs + claims in one go and returns the device token. */
    async adoptDevice(userName: string, pairingCode: string, deviceUuid: string): Promise<string> {
      await asAdmin(http().post('/v1/devices/pair'))
        .send({ pairingCode, userId: userName })
        .expect(200);
      const res = await http()
        .post('/api/v1/device/claim')
        .send({ pairingCode, deviceUuid })
        .expect(200);
      return res.body.deviceToken as string;
    },
    deviceConfig: (deviceUuid: string, token: string) =>
      http()
        .get('/api/v1/device/config')
        .set('X-Device-ID', deviceUuid)
        .set('X-Device-Token', token),
    devicesOf: async (userName: string) =>
      (await asAdmin(http().get(`/v1/devices?userId=${userName}`)).expect(200)).body as Array<
        Record<string, unknown>
      >
  };
}
