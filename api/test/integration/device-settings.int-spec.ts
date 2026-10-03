import { randomUUID } from 'node:crypto';
import {
  apiClient,
  createIntegrationApp,
  IntegrationContext,
  resetDatabase
} from './integration-app';

/**
 * Display settings, screens, device authentication and telemetry, database to API: the parts that
 * depend on real PostgreSQL behaviour (jsonb, smallint schedule columns, integer metrics) and on the
 * whole request pipeline (guard, validation, services).
 */
describe('Device settings & telemetry (integration, PostgreSQL)', () => {
  let ctx: IntegrationContext;
  let api: ReturnType<typeof apiClient>;
  let deviceUuid: string;
  let token: string;

  const nowSec = () => Math.floor(Date.now() / 1000);

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    api = apiClient(ctx.app);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    ctx.transit.getDepartures.mockReset().mockResolvedValue([]);
    await api.register('alice');
    deviceUuid = randomUUID();
    token = await api.adoptDevice('alice', 'ANKA22', deviceUuid);
  });

  const patch = (body: Record<string, unknown>) =>
    api.asAdmin(api.http().patch(`/v1/devices/${deviceUuid}`)).send(body);
  const screens = () =>
    api
      .http()
      .get('/api/v1/device/screens')
      .set('X-Device-ID', deviceUuid)
      .set('X-Device-Token', token)
      .expect(200);
  const firstList = (body: { pages: Array<{ widgets: Array<Record<string, unknown>> }> }) =>
    body.pages[0].widgets.find((w) => w.t === 'list') as Record<string, unknown>;

  describe('device authentication', () => {
    it('accepts the issued token and rejects wrong tokens and unknown devices', async () => {
      await api.deviceConfig(deviceUuid, token).expect(200);
      await api.deviceConfig(deviceUuid, 'x'.repeat(32)).expect(401);
      await api.deviceConfig(randomUUID(), token).expect(404);
    });

    it('answers 403 while the owner has switched the display off', async () => {
      await patch({ isConfigured: false }).expect(200);
      await api.deviceConfig(deviceUuid, token).expect(403);
    });
  });

  describe('settings round-trip through the database', () => {
    it('stores the IANA zone and schedule and sends the device POSIX + schedule', async () => {
      await patch({
        timezone: 'Europe/London',
        scheduleEnabled: true,
        scheduleOn: 1080,
        scheduleOff: 120,
        scheduleDays: 96
      }).expect(200);

      const detail = await api.asAdmin(api.http().get(`/v1/devices/${deviceUuid}`)).expect(200);
      expect(detail.body).toMatchObject({
        timezone: 'Europe/London',
        scheduleOn: 1080,
        scheduleOff: 120,
        scheduleDays: 96
      });

      const config = await api.deviceConfig(deviceUuid, token).expect(200);
      expect(config.body.timezone).toBe('GMT0BST,M3.5.0/1,M10.5.0');
      expect(config.body.schedule).toEqual({ on: 1080, off: 120, days: 96 });
    });

    it('rejects invalid settings without touching the stored ones', async () => {
      await patch({ timezone: 'CET-1CEST,M3.5.0,M10.5.0/3' }).expect(400);
      await patch({ display: { pages: [{ type: 'weather' }] } }).expect(400);
      const detail = await api.asAdmin(api.http().get(`/v1/devices/${deviceUuid}`)).expect(200);
      expect(detail.body).toMatchObject({ timezone: 'Europe/Zurich', display: null });
    });

    it('persists the jsonb screen profile and composes it for the device', async () => {
      ctx.transit.getDepartures.mockResolvedValue([
        {
          timestamp: nowSec() + 300,
          line: 'S2',
          destination: 'Zürich Flughafen',
          category: 'S',
          platform: '31',
          delayMinutes: 2
        },
        {
          timestamp: nowSec() + 600,
          line: 'IR 36',
          destination: 'Basel SBB',
          category: 'IR',
          platform: '7',
          delayMinutes: 0
        }
      ]);
      await patch({
        display: {
          pages: [
            { type: 'departures', categories: ['S'], showPlatform: true, showDelay: true, rows: 2 },
            { type: 'message', text: 'Hello\nWorld' }
          ]
        }
      }).expect(200);

      const stored = await ctx.dataSource.query(
        `SELECT display FROM device WHERE "deviceUuid" = $1`,
        [deviceUuid]
      );
      expect(stored[0].display.pages).toHaveLength(2);

      const res = await screens();
      expect(res.body.pages).toHaveLength(2);
      expect(firstList(res.body)).toMatchObject({ maxRows: 2 });
      expect((firstList(res.body).items as Array<{ cells: string[] }>).map((i) => i.cells)).toEqual(
        [['S2', '31', 'Zürich Flughafen', '+2']]
      );
    });
  });

  describe('honest empty boards', () => {
    it('says so when the station has nothing scheduled, and when the provider is down', async () => {
      ctx.transit.getDepartures.mockResolvedValueOnce([]);
      expect(firstList((await screens()).body)).toMatchObject({
        items: [],
        empty: 'No departures scheduled right now'
      });

      ctx.transit.getDepartures.mockRejectedValueOnce(new Error('upstream down'));
      expect(firstList((await screens()).body)).toMatchObject({
        items: [],
        empty: 'Timetable temporarily unavailable'
      });
    });
  });

  describe('telemetry', () => {
    it('stores metrics and returns them as numbers in a DTO without relations', async () => {
      await api
        .http()
        .post('/api/v1/device/metrics')
        .set('X-Device-ID', deviceUuid)
        .set('X-Device-Token', token)
        .send({
          deviceId: deviceUuid,
          stationName: 'Zürich HB',
          uptimeSeconds: 4_000_000,
          resetReason: 4,
          cpuFreqMHz: 240,
          ramFreeBytes: 200_000,
          ramTotalBytes: 320_000,
          ramMinFreeEver: 150_000,
          ramMaxAllocBlock: 90_000,
          fsTotalBytes: 1_500_000,
          fsUsedBytes: 50_000,
          wifiSignalRssi: -61,
          wifiChannel: 6,
          firmwareVersion: '1.2.3',
          fieldFromNewerFirmware: true
        })
        .expect(200);

      const res = await api
        .asAdmin(api.http().get(`/v1/devices/${deviceUuid}/metrics`))
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        uptimeSeconds: 4_000_000,
        ramFreeBytes: 200_000,
        firmwareVersion: '1.2.3'
      });
      expect(typeof res.body[0].uptimeSeconds).toBe('number');
      expect(res.body[0]).not.toHaveProperty('device');
      expect(res.body[0]).not.toHaveProperty('fieldFromNewerFirmware');
    });

    it('rejects metrics that do not fit an integer column with 400, not 500', async () => {
      await api
        .http()
        .post('/api/v1/device/metrics')
        .set('X-Device-ID', deviceUuid)
        .set('X-Device-Token', token)
        .send({
          deviceId: deviceUuid,
          stationName: 'Zürich HB',
          uptimeSeconds: 5_000_000_000,
          resetReason: 4,
          cpuFreqMHz: 240,
          ramFreeBytes: 200_000,
          ramTotalBytes: 320_000,
          ramMinFreeEver: 150_000,
          ramMaxAllocBlock: 90_000,
          fsTotalBytes: 1_500_000,
          fsUsedBytes: 50_000,
          wifiSignalRssi: -61,
          wifiChannel: 6
        })
        .expect(400);
    });

    it('refuses metrics from an unknown device', () =>
      api
        .http()
        .post('/api/v1/device/metrics')
        .set('X-Device-ID', randomUUID())
        .send({
          deviceId: randomUUID(),
          stationName: 'x',
          uptimeSeconds: 1,
          resetReason: 1,
          cpuFreqMHz: 1,
          ramFreeBytes: 1,
          ramTotalBytes: 1,
          ramMinFreeEver: 1,
          ramMaxAllocBlock: 1,
          fsTotalBytes: 1,
          fsUsedBytes: 1,
          wifiSignalRssi: -1,
          wifiChannel: 1
        })
        .expect(404));
  });
});
