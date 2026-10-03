import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DeviceClientController } from '../src/modules/device/controllers/device-client.controller';
import { DeviceService } from '../src/modules/device/services/device.service';
import { configureApp } from '../src/app.setup';

describe('Device Client API (e2e)', () => {
  let app: INestApplication;
  const mockDeviceService = {
    getDeviceConfig: jest.fn().mockResolvedValue({
      stationName: 'Zürich HB',
      timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
      theme: 'standard',
      apiInterval: 300000,
      screenInterval: 15000,
      metricsInterval: 600000
    }),
    getDeviceData: jest.fn().mockResolvedValue({
      station: 'Zürich HB',
      departures: [{ timestamp: 1717200000, line: 'S2', destination: 'Zürich Flughafen' }]
    }),
    recordMetrics: jest.fn().mockResolvedValue(undefined),
    getHello: jest.fn().mockReturnValue({ pairBaseUrl: 'https://app.example.test/pair' })
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])],
      controllers: [DeviceClientController],
      providers: [
        {
          provide: DeviceService,
          useValue: mockDeviceService
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/device/config with X-Device-ID header', () => {
    return request(app.getHttpServer())
      .get('/api/v1/device/config')
      .set('X-Device-ID', 'd3b07384-d113-3660-84cf-3b999cd46903')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('stationName', 'Zürich HB');
        expect(res.body).toHaveProperty('timezone');
        expect(res.body).toHaveProperty('theme', 'standard');
        expect(res.body).toHaveProperty('apiInterval', 300000);
        expect(res.body).toHaveProperty('screenInterval', 15000);
        expect(res.body).toHaveProperty('metricsInterval', 600000);
      });
  });

  it('GET /api/v1/device/data returns departures array', () => {
    return request(app.getHttpServer())
      .get('/api/v1/device/data')
      .set('X-Device-ID', 'd3b07384-d113-3660-84cf-3b999cd46903')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('departures');
        expect(Array.isArray(res.body.departures)).toBe(true);
        expect(res.body.departures[0]).toHaveProperty('timestamp');
        expect(res.body.departures[0]).toHaveProperty('line');
        expect(res.body.departures[0]).toHaveProperty('destination');
      });
  });

  it('POST /api/v1/device/metrics accepts telemetry payload', () => {
    return request(app.getHttpServer())
      .post('/api/v1/device/metrics')
      .set('X-Device-ID', 'd3b07384-d113-3660-84cf-3b999cd46903')
      .send({
        deviceId: 'd3b07384-d113-3660-84cf-3b999cd46903',
        stationName: 'Zürich HB',
        uptimeSeconds: 120,
        resetReason: 1,
        cpuFreqMHz: 240,
        ramFreeBytes: 180000,
        ramTotalBytes: 320000,
        ramMinFreeEver: 160000,
        ramMaxAllocBlock: 95000,
        fsTotalBytes: 1500000,
        fsUsedBytes: 45000,
        wifiSignalRssi: -65,
        wifiBssid: 'aa:bb:cc:dd:ee:ff',
        wifiChannel: 6
      })
      .expect(200)
      .expect({ ok: true });
  });

  it('POST /api/v1/device/metrics strips unknown fields from newer firmware instead of rejecting them', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/device/metrics')
      .set('X-Device-ID', 'd3b07384-d113-3660-84cf-3b999cd46903')
      .send({
        deviceId: 'd3b07384-d113-3660-84cf-3b999cd46903',
        stationName: 'Zürich HB',
        uptimeSeconds: 1,
        resetReason: 1,
        cpuFreqMHz: 240,
        ramFreeBytes: 1,
        ramTotalBytes: 1,
        ramMinFreeEver: 1,
        ramMaxAllocBlock: 1,
        fsTotalBytes: 1,
        fsUsedBytes: 1,
        wifiSignalRssi: -60,
        wifiChannel: 6,
        firmwareVersion: '1.0.0',
        someFieldFromTheFuture: 42
      })
      .expect(200);

    const body = mockDeviceService.recordMetrics.mock.calls.at(-1)![0];
    expect(body.firmwareVersion).toBe('1.0.0');
    expect(body).not.toHaveProperty('someFieldFromTheFuture');
  });

  it('GET /api/v1/device/hello is the versioned bootstrap route', () => {
    return request(app.getHttpServer())
      .get('/api/v1/device/hello')
      .expect(200)
      .expect({ pairBaseUrl: 'https://app.example.test/pair' });
  });

  it('unversioned device routes are gone', () => {
    return request(app.getHttpServer()).get('/api/device/hello').expect(404);
  });
});
