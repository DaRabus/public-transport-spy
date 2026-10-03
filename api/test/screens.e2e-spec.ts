import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { DeviceClientController } from '../src/modules/device/controllers/device-client.controller';
import { DeviceAdminController } from '../src/modules/device/controllers/device-admin.controller';
import { DeviceService } from '../src/modules/device/services/device.service';
import { Device } from '../src/modules/device/entities/device.entity';
import { DeviceMetric } from '../src/modules/device/entities/device-metric.entity';
import { User } from '../src/modules/auth/entities/user.entity';
import { TransitService } from '../src/modules/transit/services/transit.service';
import { AdminApiKeyGuard } from '../src/modules/shared-modules/guards/admin-api-key.guard';

/**
 * End-to-end: owner edits the display profile through the admin API (what the web app's BFF calls),
 * and the device fetches the composed widget layout through the real guard, validation, service and
 * composer. Only the database and the upstream timetable are faked.
 */
describe('Customizable screens (e2e)', () => {
  const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const TOKEN = 'a'.repeat(32);
  const API_KEY = 'e2e-admin-key-0123456789abcdef';
  const nowSec = () => Math.floor(Date.now() / 1000);

  let app: INestApplication;
  let rows: Device[];
  const transitMock = {
    getDepartures: jest.fn(async (station: string) =>
      (boards[station] ?? []).map((d, i) => ({ ...d, timestamp: nowSec() + (i + 2) * 300 }))
    )
  };

  const boards: Record<string, Array<Record<string, unknown>>> = {
    'Zürich HB': [
      {
        line: 'S2',
        destination: 'Zürich Flughafen',
        category: 'S',
        platform: '31',
        delayMinutes: 0
      },
      { line: 'IR 36', destination: 'Basel SBB', category: 'IR', platform: '7', delayMinutes: 4 }
    ],
    Bern: [
      {
        line: 'IC 1',
        destination: 'Genève-Aéroport',
        category: 'IC',
        platform: '5',
        delayMinutes: 0
      }
    ]
  };

  // Minimal in-memory stand-in for the TypeORM repository: enough for the device service's queries.
  const matches = (row: Device, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v);
  const deviceRepo = {
    findOne: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((r) => matches(r, where)) ?? null
    ),
    save: jest.fn(async (entity: Device) => {
      const i = rows.findIndex((r) => r.id === entity.id);
      if (i >= 0) rows[i] = entity;
      else rows.push(entity);
      return entity;
    }),
    create: jest.fn((dto: Partial<Device>) => dto),
    find: jest.fn(async () => rows),
    remove: jest.fn(),
    delete: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])],
      controllers: [DeviceClientController, DeviceAdminController],
      providers: [
        DeviceService,
        { provide: APP_GUARD, useClass: AdminApiKeyGuard },
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
        {
          provide: getRepositoryToken(DeviceMetric),
          useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn() }
        },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: TransitService, useValue: transitMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                ADMIN_API_KEY: API_KEY,
                PUBLIC_APP_URL: 'https://app.example.test',
                NODE_ENV: 'test'
              })[key]
          }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    rows = [
      {
        id: 'row-1',
        deviceUuid: UUID,
        deviceToken: TOKEN,
        isPaired: true,
        isConfigured: true,
        name: 'Kitchen',
        stationName: 'Zürich HB',
        timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
        theme: 'standard',
        apiInterval: 300000,
        screenInterval: 15000,
        metricsInterval: 600000,
        display: null,
        user: null
      } as unknown as Device
    ];
  });

  afterAll(async () => {
    await app.close();
  });

  const screens = () =>
    request(app.getHttpServer())
      .get('/api/v1/device/screens')
      .set('X-Device-ID', UUID)
      .set('X-Device-Token', TOKEN);
  const patchDisplay = (display: unknown) =>
    request(app.getHttpServer())
      .patch(`/v1/devices/${UUID}`)
      .set('X-Api-Key', API_KEY)
      .send({ display });

  it('rejects a device without its token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/device/screens')
      .set('X-Device-ID', UUID)
      .expect(401);
  });

  it('serves the default departures board when no profile is set', async () => {
    const res = await screens().expect(200);
    expect(res.body.pages).toHaveLength(1);
    const list = res.body.pages[0].widgets.find((w: { t: string }) => w.t === 'list');
    expect(list.maxRows).toBe(3);
    expect(list.items.map((i: { cells: string[] }) => i.cells[0])).toEqual(['S2', 'IR 36']);
    expect(res.body.pages[0].widgets).toContainEqual(
      expect.objectContaining({ t: 'text', text: 'Zürich HB' })
    );
  });

  it('applies a profile saved through the admin API to what the device receives', async () => {
    const saved = await patchDisplay({
      pages: [
        { type: 'departures', station: 'Bern', rows: 2, showPlatform: true, durationSec: 20 },
        { type: 'departures', categories: ['IR'], showDelay: true },
        { type: 'clock', showDate: true },
        { type: 'message', text: 'Gone fishing\nBack Monday' }
      ]
    }).expect(200);
    expect(saved.body.display.pages).toHaveLength(4);

    const res = await screens().expect(200);
    const [bern, filtered, clock, message] = res.body.pages;

    expect(bern.durationMs).toBe(20000);
    const bernList = bern.widgets.find((w: { t: string }) => w.t === 'list');
    expect(bernList.maxRows).toBe(2);
    expect(bernList.items[0].cells).toEqual(['IC 1', '5', 'Genève-Aéroport']);

    const irList = filtered.widgets.find((w: { t: string }) => w.t === 'list');
    expect(irList.items.map((i: { cells: string[] }) => i.cells)).toEqual([
      ['IR 36', 'Basel SBB', '+4']
    ]);

    expect(clock.widgets).toContainEqual(expect.objectContaining({ t: 'clock', font: 'xl' }));
    expect(
      message.widgets
        .filter((w: { t: string }) => w.t === 'text')
        .map((w: { text: string }) => w.text)
    ).toEqual(['Gone fishing', 'Back Monday']);
    expect(JSON.stringify(res.body).length).toBeLessThan(8192);
  });

  it.each([
    ['more than 6 pages', { pages: Array.from({ length: 7 }, () => ({ type: 'clock' })) }],
    ['an empty page list', { pages: [] }],
    ['an unknown page type', { pages: [{ type: 'weather' }] }],
    ['a message page without text', { pages: [{ type: 'message' }] }],
    ['an out-of-range row count', { pages: [{ type: 'departures', rows: 9 }] }],
    ['an over-long walking time', { pages: [{ type: 'departures', walkMinutes: 500 }] }],
    ['a whitespace-only message', { pages: [{ type: 'message', text: '   \n  ' }] }],
    [
      'non-string text smuggled onto a departures page',
      { pages: [{ type: 'departures', text: { big: 'x'.repeat(5000) } }] }
    ],
    ['an over-long text on a clock page', { pages: [{ type: 'clock', text: 'x'.repeat(500) }] }]
  ])('rejects %s', async (_label, display) => {
    await patchDisplay(display).expect(400);
    expect(rows[0].display).toBeNull();
  });

  it.each([
    ['an unknown time zone', { timezone: 'Mars/Olympus_Mons' }],
    ['a raw POSIX string instead of a zone', { timezone: 'CET-1CEST,M3.5.0,M10.5.0/3' }],
    ['a schedule minute past midnight', { scheduleOn: 1440 }],
    ['an empty weekday set', { scheduleDays: 0 }],
    ['weekday bits beyond Saturday', { scheduleDays: 128 }]
  ])('rejects %s', (_label, body) =>
    request(app.getHttpServer())
      .patch(`/v1/devices/${UUID}`)
      .set('X-Api-Key', API_KEY)
      .send(body)
      .expect(400)
  );

  it('lists the supported time zones for the picker (not mistaken for a device id)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/devices/timezones')
      .set('X-Api-Key', API_KEY)
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining(['Europe/Zurich', 'Europe/London', 'America/New_York'])
    );
  });

  it('stores a supported time zone and an on/off schedule', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/devices/${UUID}`)
      .set('X-Api-Key', API_KEY)
      .send({
        timezone: 'Europe/London',
        scheduleEnabled: true,
        scheduleOn: 390,
        scheduleOff: 1410,
        scheduleDays: 62
      })
      .expect(200);
    expect(res.body).toMatchObject({
      timezone: 'Europe/London',
      scheduleEnabled: true,
      scheduleOn: 390,
      scheduleOff: 1410,
      scheduleDays: 62
    });
  });

  it('shows an honest message when the timetable provider is down', async () => {
    transitMock.getDepartures.mockRejectedValueOnce(new Error('upstream down'));
    const res = await screens().expect(200);
    const list = res.body.pages[0].widgets.find((w: { t: string }) => w.t === 'list');
    expect(list).toMatchObject({ items: [], empty: 'Timetable temporarily unavailable' });
  });

  describe('cancelling a pending pairing', () => {
    const cancel = (id: string, userId?: string) => {
      const req = request(app.getHttpServer())
        .delete(`/v1/devices/pending/${id}${userId ? `?userId=${userId}` : ''}`)
        .set('X-Api-Key', API_KEY);
      return req;
    };

    it('rejects ids that are not UUIDs', () => cancel('not-a-uuid', 'alice').expect(400));
    it('requires the owner', () => cancel('01a110ef-0000-7000-8000-000000000001').expect(400));
    it('answers 404 when there is no matching pending request', () =>
      cancel('01a110ef-0000-7000-8000-000000000001', 'alice').expect(404));
    it('is not reachable without the admin key', () =>
      request(app.getHttpServer())
        .delete('/v1/devices/pending/01a110ef-0000-7000-8000-000000000001?userId=alice')
        .expect(401));
  });

  it('falls back to the default board when the profile is cleared', async () => {
    await patchDisplay({ pages: [{ type: 'clock' }] }).expect(200);
    await patchDisplay(null).expect(200);
    const res = await screens().expect(200);
    expect(res.body.pages[0].widgets.some((w: { t: string }) => w.t === 'list')).toBe(true);
  });

  describe('preview of unsaved settings (web app live preview)', () => {
    const preview = (body: unknown, key: string | null = API_KEY) => {
      const req = request(app.getHttpServer()).post(`/v1/devices/${UUID}/screens/preview`);
      return (key ? req.set('X-Api-Key', key) : req).send(body as object);
    };

    it('requires the admin key', () => preview({}, null).expect(401));

    it('composes the unsaved profile, station and theme without saving anything', async () => {
      const res = await preview({
        stationName: 'Bern',
        theme: 'retro',
        display: {
          pages: [
            { type: 'departures', rows: 2 },
            { type: 'message', text: 'Draft' }
          ]
        }
      }).expect(200);

      expect(res.body.pages).toHaveLength(2);
      expect(res.body.pages[0].widgets).toContainEqual(
        expect.objectContaining({ t: 'text', font: 'retro', text: 'Bern' })
      );
      const list = res.body.pages[0].widgets.find((w: { t: string }) => w.t === 'list');
      expect(list.items[0].cells).toEqual(['IC 1', 'Genève-Aéroport']);
      expect(rows[0].display).toBeNull();
      expect(rows[0].stationName).toBe('Zürich HB');
    });

    it('falls back to the stored settings for fields the form did not send', async () => {
      const res = await preview({}).expect(200);
      expect(res.body.pages[0].widgets).toContainEqual(
        expect.objectContaining({ t: 'text', text: 'Zürich HB' })
      );
    });

    it('validates the draft like a save would', () =>
      preview({ display: { pages: [{ type: 'weather' }] } }).expect(400));

    it('returns 404 for an unknown device', () =>
      request(app.getHttpServer())
        .post('/v1/devices/11111111-2222-4333-8444-555555555555/screens/preview')
        .set('X-Api-Key', API_KEY)
        .send({})
        .expect(404));
  });
});
