import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DeviceClientController } from './device-client.controller';
import { DeviceService } from '../services/device.service';

describe('DeviceClientController', () => {
  let controller: DeviceClientController;
  let mockService: {
    getDeviceConfig: jest.Mock;
    getDeviceData: jest.Mock;
    recordMetrics: jest.Mock;
    claimDevice: jest.Mock;
    getHello: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      getDeviceConfig: jest.fn(),
      getDeviceData: jest.fn(),
      recordMetrics: jest.fn(),
      claimDevice: jest.fn(),
      getHello: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])],
      controllers: [DeviceClientController],
      providers: [
        {
          provide: DeviceService,
          useValue: mockService
        }
      ]
    }).compile();

    controller = module.get<DeviceClientController>(DeviceClientController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('claim', () => {
    it('binds the hardware UUID to a claimed pairing code', async () => {
      const config = { isPaired: true, deviceToken: 'abc123' };
      mockService.claimDevice.mockResolvedValue(config);

      const res = await controller.claim({ pairingCode: 'KV79P2', deviceUuid: 'real-uuid' });
      expect(res).toBe(config);
      expect(mockService.claimDevice).toHaveBeenCalledWith({
        pairingCode: 'KV79P2',
        deviceUuid: 'real-uuid'
      });
    });
  });

  describe('hello', () => {
    it('returns bootstrap info from the service', () => {
      mockService.getHello.mockReturnValue({ pairBaseUrl: 'https://app.example.test/pair' });
      expect(controller.hello()).toEqual({ pairBaseUrl: 'https://app.example.test/pair' });
    });
  });

  describe('getConfig', () => {
    it('returns config when device is configured', async () => {
      const config = {
        stationName: 'Zürich HB',
        timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
        theme: 'standard',
        apiInterval: 300000,
        screenInterval: 15000,
        metricsInterval: 600000
      };
      mockService.getDeviceConfig.mockResolvedValue(config);

      const res = await controller.getConfig('test-uuid');
      expect(res).toBe(config);
      expect(mockService.getDeviceConfig).toHaveBeenCalledWith('test-uuid', undefined, undefined);
    });

    it('throws ForbiddenException when the owner disabled the device', async () => {
      mockService.getDeviceConfig.mockResolvedValue(null);

      await expect(controller.getConfig('unconfigured-uuid')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getData', () => {
    it('returns transit departures', async () => {
      const data = {
        station: 'Zürich HB',
        departures: [{ timestamp: 1717200000, line: 'S2', destination: 'Zürich Flughafen' }]
      };
      mockService.getDeviceData.mockResolvedValue(data);

      const res = await controller.getData('test-uuid');
      expect(res).toBe(data);
      expect(mockService.getDeviceData).toHaveBeenCalledWith('test-uuid', undefined, undefined);
    });
  });

  describe('postMetrics', () => {
    it('records metrics and returns { ok: true }', async () => {
      mockService.recordMetrics.mockResolvedValue(undefined);

      const metricsInput = {
        deviceId: 'test-uuid',
        stationName: 'Zürich HB',
        uptimeSeconds: 120,
        resetReason: 1,
        cpuFreqMHz: 240,
        ramFreeBytes: 150000,
        ramTotalBytes: 320000,
        ramMinFreeEver: 140000,
        ramMaxAllocBlock: 90000,
        fsTotalBytes: 1500000,
        fsUsedBytes: 40000,
        wifiSignalRssi: -65,
        wifiBssid: 'aa:bb:cc:dd:ee:ff',
        wifiChannel: 6
      };

      const res = await controller.postMetrics(metricsInput, 'test-uuid');
      expect(res).toEqual({ ok: true });
      expect(mockService.recordMetrics).toHaveBeenCalledWith(metricsInput, undefined, undefined);
    });
  });
});
