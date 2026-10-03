import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DeviceService } from './device.service';
import { Device } from '../entities/device.entity';
import { DeviceMetric } from '../entities/device-metric.entity';
import { User } from '../../auth/entities/user.entity';
import { TransitService } from '../../transit/services/transit.service';
import { ConfigService } from '@nestjs/config';
import { IsNull } from 'typeorm';

describe('DeviceService', () => {
  let service: DeviceService;
  let mockDeviceRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    delete: jest.Mock;
  };
  let mockMetricRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let mockUserRepo: {
    findOne: jest.Mock;
  };
  let mockTransitService: {
    getDepartures: jest.Mock;
  };
  let configValues: Record<string, string | undefined>;

  beforeEach(async () => {
    configValues = { PUBLIC_APP_URL: 'https://app.example.test', DEVICE_BACKEND_URL: undefined };

    mockDeviceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'device-id-1', ...entity })),
      remove: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 0 })
    };

    mockMetricRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'metric-id-1', ...entity })),
      find: jest.fn(),
      delete: jest.fn()
    };

    mockUserRepo = {
      findOne: jest.fn(({ where }: { where: { userName: string } }) =>
        Promise.resolve({ id: `${where.userName}-uuid`, userName: where.userName })
      )
    };

    mockTransitService = {
      getDepartures: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        {
          provide: getRepositoryToken(Device),
          useValue: mockDeviceRepo
        },
        {
          provide: getRepositoryToken(DeviceMetric),
          useValue: mockMetricRepo
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo
        },
        {
          provide: TransitService,
          useValue: mockTransitService
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => configValues[key]) }
        }
      ]
    }).compile();

    service = module.get<DeviceService>(DeviceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDeviceConfig', () => {
    it('returns config and normal interval for paired device when token matches', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        stationName: 'Bern',
        timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
        theme: 'retro',
        apiInterval: 120000,
        screenInterval: 10000,
        metricsInterval: 300000,
        isConfigured: true,
        isPaired: true,
        deviceToken: 'token-1234',
        lastSeenAt: null
      });

      const config = await service.getDeviceConfig('esp32-1234', '192.168.1.50', 'token-1234');
      expect(config).toEqual({
        stationName: 'Bern',
        timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
        theme: 'retro',
        apiInterval: 120000,
        screenInterval: 10000,
        metricsInterval: 300000,
        deviceToken: 'token-1234',
        isPaired: true,
        pairingCode: undefined,
        pairingUrl: undefined
      });
      expect(mockDeviceRepo.save).toHaveBeenCalled();
    });

    it('rejects config request if device exists and token is missing or invalid', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        deviceToken: 'token-1234'
      });

      await expect(service.getDeviceConfig('esp32-1234', '192.168.1.50')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(
        service.getDeviceConfig('esp32-1234', '192.168.1.50', 'wrong-token')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('generates pairing code and fast poll interval for unpaired device', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        stationName: 'Bern',
        timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
        theme: 'standard',
        apiInterval: 300000,
        screenInterval: 15000,
        metricsInterval: 600000,
        isConfigured: true,
        isPaired: false,
        pairingCode: null,
        pairingCodeExpiresAt: null,
        deviceToken: 'token-1234',
        lastSeenAt: null
      });

      const config = await service.getDeviceConfig('esp32-1234', '192.168.1.50', 'token-1234');
      expect(config?.isPaired).toBe(false);
      expect(config?.apiInterval).toBe(5000);
      expect(config?.pairingCode).toHaveLength(6);
      expect(config?.pairingUrl).toBe(`https://app.example.test/pair?code=${config?.pairingCode}`);
      expect(mockDeviceRepo.save).toHaveBeenCalled();
    });

    it('tells the device to move when DEVICE_BACKEND_URL is configured', async () => {
      configValues.DEVICE_BACKEND_URL = 'https://api.new.example.test';
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        stationName: 'Bern',
        timezone: 'CET-1CEST,M3.5.0,M10.5.0/3',
        theme: 'standard',
        apiInterval: 300000,
        screenInterval: 15000,
        metricsInterval: 600000,
        isConfigured: true,
        isPaired: true,
        deviceToken: 'token-1234',
        lastSeenAt: null
      });

      const config = await service.getDeviceConfig('esp32-1234', undefined, 'token-1234');
      expect(config?.backendBaseUrl).toBe('https://api.new.example.test');
    });

    it('clears the pairing code on the first authenticated call after a claim', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        isConfigured: true,
        isPaired: true,
        deviceToken: 'token-1234',
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      });

      await service.getDeviceConfig('esp32-1234', undefined, 'token-1234');
      expect(mockDeviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ pairingCode: null, pairingCodeExpiresAt: null })
      );
    });

    it('sends the POSIX form of the device time zone and the schedule only when enabled', async () => {
      const base = {
        id: '1',
        deviceUuid: 'esp32-1234',
        isConfigured: true,
        isPaired: true,
        deviceToken: 'token-1234',
        timezone: 'Europe/London',
        scheduleOn: 360,
        scheduleOff: 1380,
        scheduleDays: 62
      };
      mockDeviceRepo.findOne.mockResolvedValue({ ...base, scheduleEnabled: true });
      const on = await service.getDeviceConfig('esp32-1234', undefined, 'token-1234');
      expect(on?.timezone).toBe('GMT0BST,M3.5.0/1,M10.5.0');
      expect(on?.schedule).toEqual({ on: 360, off: 1380, days: 62 });

      mockDeviceRepo.findOne.mockResolvedValue({ ...base, scheduleEnabled: false });
      const off = await service.getDeviceConfig('esp32-1234', undefined, 'token-1234');
      expect(off?.schedule).toBeUndefined();
    });

    it('returns null if device is marked isConfigured: false', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '2',
        deviceUuid: 'esp32-unclaimed',
        isConfigured: false,
        deviceToken: 'token-123'
      });

      const config = await service.getDeviceConfig('esp32-unclaimed', undefined, 'token-123');
      expect(config).toBeNull();
    });

    it('rejects an unrecognized UUID instead of auto-registering it (closes the TOFU race)', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(null);

      await expect(service.getDeviceConfig('esp32-new')).rejects.toThrow(NotFoundException);
      expect(mockDeviceRepo.create).not.toHaveBeenCalled();
    });

    it('rejects invalid device UUID formats', async () => {
      await expect(service.getDeviceConfig('bad/uuid')).rejects.toThrow(BadRequestException);
      await expect(service.getDeviceConfig('ab')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getHello', () => {
    it('returns the absolute pairing page base URL for unclaimed devices', () => {
      expect(service.getHello()).toEqual({ pairBaseUrl: 'https://app.example.test/pair' });
    });
  });

  describe('getDeviceData', () => {
    it('fetches departures for the device station when token is valid', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        stationName: 'Basel SBB',
        deviceToken: 'token-1234'
      });

      mockTransitService.getDepartures.mockResolvedValue([
        { timestamp: 1717200000, line: 'S3', destination: 'Olten' }
      ]);

      const res = await service.getDeviceData('esp32-1234', undefined, 'token-1234');
      expect(res.station).toBe('Basel SBB');
      expect(res.departures).toHaveLength(1);
      expect(mockTransitService.getDepartures).toHaveBeenCalledWith('Basel SBB', 8);
    });

    it('rejects getDeviceData if token is missing or mismatched', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        stationName: 'Basel SBB',
        deviceToken: 'token-1234'
      });

      await expect(service.getDeviceData('esp32-1234')).rejects.toThrow(UnauthorizedException);
      await expect(service.getDeviceData('esp32-1234', undefined, 'wrong-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('recordMetrics', () => {
    it('creates metric entry and updates device lastSeenAt when token matches', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        deviceToken: 'token-1234'
      });

      await service.recordMetrics(
        {
          deviceId: 'esp32-1234',
          stationName: 'Basel SBB',
          uptimeSeconds: 60,
          resetReason: 1,
          cpuFreqMHz: 240,
          ramFreeBytes: 200000,
          ramTotalBytes: 320000,
          ramMinFreeEver: 180000,
          ramMaxAllocBlock: 100000,
          fsTotalBytes: 1500000,
          fsUsedBytes: 50000,
          wifiSignalRssi: -70,
          wifiBssid: '11:22:33:44:55:66',
          wifiChannel: 1,
          firmwareVersion: '1.0.0'
        },
        '192.168.1.100',
        'token-1234'
      );

      expect(mockMetricRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ firmwareVersion: '1.0.0' })
      );
      expect(mockMetricRepo.save).toHaveBeenCalled();
      expect(mockDeviceRepo.save).toHaveBeenCalled();
    });

    it('rejects metrics if device is not registered', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.recordMetrics(
          {
            deviceId: 'esp32-unknown',
            stationName: 'Basel SBB',
            uptimeSeconds: 60,
            resetReason: 1,
            cpuFreqMHz: 240,
            ramFreeBytes: 200000,
            ramTotalBytes: 320000,
            ramMinFreeEver: 180000,
            ramMaxAllocBlock: 100000,
            fsTotalBytes: 1500000,
            fsUsedBytes: 50000,
            wifiSignalRssi: -70,
            wifiBssid: undefined,
            wifiChannel: 1
          },
          '192.168.1.100'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects metrics if token is invalid', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        deviceToken: 'token-1234'
      });

      await expect(
        service.recordMetrics(
          {
            deviceId: 'esp32-1234',
            stationName: 'Basel SBB',
            uptimeSeconds: 60,
            resetReason: 1,
            cpuFreqMHz: 240,
            ramFreeBytes: 200000,
            ramTotalBytes: 320000,
            ramMinFreeEver: 180000,
            ramMaxAllocBlock: 100000,
            fsTotalBytes: 1500000,
            fsUsedBytes: 50000,
            wifiSignalRssi: -70,
            wifiBssid: undefined,
            wifiChannel: 1
          },
          '192.168.1.100',
          'bad-token'
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMetrics', () => {
    it('returns DTOs, never the entity with its relations', async () => {
      const at = new Date('2026-10-06T10:00:00Z');
      mockMetricRepo.find.mockResolvedValue([
        {
          id: 'm1',
          deviceId: 'd1',
          device: { deviceToken: 'must-not-leak' },
          stationName: 'Bern',
          uptimeSeconds: 120,
          resetReason: 1,
          cpuFreqMHz: 240,
          ramFreeBytes: 200000,
          ramTotalBytes: 320000,
          ramMinFreeEver: 180000,
          ramMaxAllocBlock: 100000,
          fsTotalBytes: 1500000,
          fsUsedBytes: 50000,
          wifiSignalRssi: -70,
          wifiBssid: null,
          wifiChannel: 6,
          firmwareVersion: '1.0.0',
          createdAt: at,
          updatedAt: at
        }
      ]);

      const [metric] = await service.getMetrics('esp32-1234', 10);
      expect(metric).toEqual({
        id: 'm1',
        deviceId: 'd1',
        stationName: 'Bern',
        uptimeSeconds: 120,
        resetReason: 1,
        cpuFreqMHz: 240,
        ramFreeBytes: 200000,
        ramTotalBytes: 320000,
        ramMinFreeEver: 180000,
        ramMaxAllocBlock: 100000,
        fsTotalBytes: 1500000,
        fsUsedBytes: 50000,
        wifiSignalRssi: -70,
        wifiBssid: null,
        wifiChannel: 6,
        firmwareVersion: '1.0.0',
        createdAt: '2026-10-06T10:00:00.000Z',
        updatedAt: '2026-10-06T10:00:00.000Z'
      });
      expect(metric).not.toHaveProperty('device');
    });
  });

  describe('listAll', () => {
    it('removes expired pending claims before listing, so typos do not linger as "Pending"', async () => {
      mockDeviceRepo.find.mockResolvedValue([]);
      await service.listAll('alice');
      expect(mockDeviceRepo.delete).toHaveBeenCalledWith({
        deviceUuid: IsNull(),
        pairingCodeExpiresAt: expect.anything()
      });
    });
  });

  describe('transferDevice', () => {
    const owned = () => ({
      id: '1',
      deviceUuid: 'esp32-1234',
      isPaired: true,
      userId: 'alice-uuid',
      user: { id: 'alice-uuid', userName: 'alice' }
    });

    it('moves a display to another account by username, keeping it paired', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(owned());
      const res = await service.transferDevice('esp32-1234', {
        toUserName: ' Bob ',
        fromUserName: 'alice'
      });
      expect(res.userId).toBe('bob');
      expect(res.isPaired).toBe(true);
      expect(mockDeviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'bob-uuid' })
      );
    });

    it('rejects unknown usernames, the current owner as target and callers who do not own the display', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(owned());
      mockUserRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.transferDevice('esp32-1234', { toUserName: 'ghost', fromUserName: 'alice' })
      ).rejects.toThrow(/No account with the username/);
      await expect(
        service.transferDevice('esp32-1234', { toUserName: 'alice', fromUserName: 'alice' })
      ).rejects.toThrow(/already belongs/);
      await expect(
        service.transferDevice('esp32-1234', { toUserName: 'carol', fromUserName: 'mallory' })
      ).rejects.toThrow(NotFoundException);
      expect(mockDeviceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelPendingClaim', () => {
    it('deletes only a pending (unclaimed) row owned by the requesting user', async () => {
      const pending = {
        id: '01a110ef-0000-7000-8000-000000000001',
        deviceUuid: null,
        isPaired: false
      };
      mockDeviceRepo.findOne.mockResolvedValue(pending);

      await service.cancelPendingClaim(pending.id, 'Alice');
      expect(mockDeviceRepo.findOne).toHaveBeenCalledWith({
        where: { id: pending.id, deviceUuid: IsNull(), user: { userName: 'alice' } }
      });
      expect(mockDeviceRepo.remove).toHaveBeenCalledWith(pending);
    });

    it("answers 404 for claimed devices, other users' rows and unknown ids", async () => {
      mockDeviceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.cancelPendingClaim('01a110ef-0000-7000-8000-000000000001', 'bob')
      ).rejects.toThrow(NotFoundException);
      expect(mockDeviceRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('pairDevice', () => {
    it('successfully pairs device with valid pairing code and sets userId', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        name: 'ESP32-1234',
        stationName: 'Zürich HB',
        isPaired: false,
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      });

      const res = await service.pairDevice({
        pairingCode: 'abc-9p2',
        name: 'Office Display',
        stationName: 'Winterthur',
        userId: 'alice'
      });

      expect(res.isPaired).toBe(true);
      expect(res.name).toBe('Office Display');
      expect(res.stationName).toBe('Winterthur');
      expect(mockDeviceRepo.save).toHaveBeenCalled();
    });

    it('throws notFound if the owning user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.pairDevice({ pairingCode: 'ABC9P2', userId: 'ghost' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws badRequest if pairing code is expired', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        isPaired: false,
        pairingCode: 'EXP123',
        pairingCodeExpiresAt: new Date(Date.now() - 60000)
      });

      await expect(service.pairDevice({ pairingCode: 'EXP123', userId: 'alice' })).rejects.toThrow(
        /Pairing code has expired/
      );
    });

    it('refuses a pending code that another user is already pairing', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: 'pending-1',
        deviceUuid: null,
        isPaired: false,
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000),
        userId: 'alice-uuid',
        user: { id: 'alice-uuid', userName: 'alice' }
      });

      await expect(service.pairDevice({ pairingCode: 'ABC9P2', userId: 'bob' })).rejects.toThrow(
        /already being paired/
      );
      expect(mockDeviceRepo.save).not.toHaveBeenCalled();
    });

    it('lets the same user re-enter their own pending code', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: 'pending-1',
        deviceUuid: null,
        isPaired: false,
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000),
        userId: 'alice-uuid',
        user: { id: 'alice-uuid', userName: 'alice' }
      });

      const res = await service.pairDevice({
        pairingCode: 'ABC9P2',
        userId: 'alice',
        name: 'Kitchen'
      });
      expect(res.name).toBe('Kitchen');
    });

    it('deletes abandoned pending claims before handling a new code', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(null);

      await service.pairDevice({ pairingCode: 'NOPE00', userId: 'alice' });
      expect(mockDeviceRepo.delete).toHaveBeenCalledWith({
        deviceUuid: IsNull(),
        pairingCodeExpiresAt: expect.anything()
      });
    });

    it('creates a pending claim awaiting hardware confirmation when the code is unknown', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(null);

      const res = await service.pairDevice({ pairingCode: 'NOPE00', userId: 'alice' });
      expect(res.isPaired).toBe(false);
      expect(res.deviceUuid).toBeNull();
      expect(res.userId).toBe('alice');
      expect(mockDeviceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pairingCode: 'NOPE00', userId: 'alice-uuid', deviceUuid: null })
      );
    });

    it('immediately pairs an already-known device re-entering pairing mode after an unpair', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        name: 'ESP32-1234',
        stationName: 'Zürich HB',
        isPaired: false,
        pairingCode: 'REPAIR',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      });

      const res = await service.pairDevice({ pairingCode: 'REPAIR', userId: 'bob' });
      expect(res.isPaired).toBe(true);
      expect(res.deviceUuid).toBe('esp32-1234');
      expect(res.userId).toBe('bob');
    });
  });

  describe('claimDevice', () => {
    it('binds the hardware UUID once the pairing code has been claimed by a user', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: null,
        name: 'ESP32 Departure Board',
        stationName: 'Zürich HB',
        isPaired: false,
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000),
        userId: 'alice'
      });

      const config = await service.claimDevice({
        pairingCode: 'abc-9p2',
        deviceUuid: 'real-esp32-uuid'
      });
      expect(config.isPaired).toBe(true);
      expect(config.deviceToken).toBeDefined();
      expect(mockDeviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceUuid: 'real-esp32-uuid',
          isPaired: true,
          pairingCode: 'ABC9P2'
        })
      );
    });

    it('returns the same token when the device retries after a lost response', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'real-esp32-uuid',
        isPaired: true,
        deviceToken: 'issued-token',
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      });

      const config = await service.claimDevice({
        pairingCode: 'ABC9P2',
        deviceUuid: 'real-esp32-uuid'
      });
      expect(config.deviceToken).toBe('issued-token');
      expect(mockDeviceRepo.save).not.toHaveBeenCalled();
    });

    it('still rejects the code for a different device UUID', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'real-esp32-uuid',
        isPaired: true,
        deviceToken: 'issued-token',
        pairingCode: 'ABC9P2',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      });

      await expect(
        service.claimDevice({ pairingCode: 'ABC9P2', deviceUuid: 'someone-else' })
      ).rejects.toThrow(/different device/);
    });

    it('replaces a stale row that still holds this device UUID', async () => {
      const pending = {
        id: 'new-row',
        deviceUuid: null,
        isPaired: false,
        pairingCode: 'NEW123',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      };
      const stale = { id: 'old-row', deviceUuid: 'real-esp32-uuid', isPaired: true };
      mockDeviceRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(stale);

      await service.claimDevice({ pairingCode: 'NEW123', deviceUuid: 'real-esp32-uuid' });
      expect(mockDeviceRepo.remove).toHaveBeenCalledWith(stale);
      expect(mockDeviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-row', deviceUuid: 'real-esp32-uuid' })
      );
    });

    it('refuses a hardware UUID that is registered to another account', async () => {
      const pending = {
        id: 'new-row',
        deviceUuid: null,
        isPaired: false,
        pairingCode: 'NEW123',
        userId: 'bob-uuid',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      };
      const owned = {
        id: 'alice-row',
        deviceUuid: 'real-esp32-uuid',
        isPaired: true,
        userId: 'alice-uuid'
      };
      mockDeviceRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(owned);

      await expect(
        service.claimDevice({ pairingCode: 'NEW123', deviceUuid: 'real-esp32-uuid' })
      ).rejects.toThrow(/registered to another account/);
      expect(mockDeviceRepo.remove).not.toHaveBeenCalled();
      expect(mockDeviceRepo.save).not.toHaveBeenCalled();
    });

    it('lets the same account re-claim its own leftover row for that UUID', async () => {
      const pending = {
        id: 'new-row',
        deviceUuid: null,
        isPaired: false,
        pairingCode: 'NEW123',
        userId: 'alice-uuid',
        pairingCodeExpiresAt: new Date(Date.now() + 600000)
      };
      const leftover = {
        id: 'old-row',
        deviceUuid: 'real-esp32-uuid',
        isPaired: true,
        userId: 'alice-uuid'
      };
      mockDeviceRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(leftover);

      await service.claimDevice({ pairingCode: 'NEW123', deviceUuid: 'real-esp32-uuid' });
      expect(mockDeviceRepo.remove).toHaveBeenCalledWith(leftover);
    });

    it('throws notFound if nobody has claimed this pairing code yet', async () => {
      mockDeviceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.claimDevice({ pairingCode: 'NOPE00', deviceUuid: 'real-esp32-uuid' })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws badRequest if the pairing code expired before the device confirmed', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: null,
        pairingCode: 'EXP123',
        pairingCodeExpiresAt: new Date(Date.now() - 60000)
      });

      await expect(
        service.claimDevice({ pairingCode: 'EXP123', deviceUuid: 'real-esp32-uuid' })
      ).rejects.toThrow(/expired/);
    });
  });

  describe('unpairDevice', () => {
    it('resets paired state on unpair', async () => {
      mockDeviceRepo.findOne.mockResolvedValue({
        id: '1',
        deviceUuid: 'esp32-1234',
        isPaired: true
      });

      const res = await service.unpairDevice('esp32-1234');
      expect(res.isPaired).toBe(false);
      expect(mockDeviceRepo.save).toHaveBeenCalled();
    });
  });
});
