import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import { DeviceAdminController } from './device-admin.controller';
import { DeviceService } from '../services/device.service';

describe('DeviceAdminController', () => {
  let controller: DeviceAdminController;
  let mockService: {
    listAll: jest.Mock;
    findByUuid: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    getMetrics: jest.Mock;
    pairDevice: jest.Mock;
    unpairDevice: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      listAll: jest.fn(),
      findByUuid: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getMetrics: jest.fn(),
      pairDevice: jest.fn(),
      unpairDevice: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])],
      controllers: [DeviceAdminController],
      providers: [
        {
          provide: DeviceService,
          useValue: mockService
        }
      ]
    }).compile();

    controller = module.get<DeviceAdminController>(DeviceAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('returns list of devices', async () => {
      mockService.listAll.mockResolvedValue([]);
      const res = await controller.list();
      expect(res).toEqual([]);
    });
  });

  describe('getByUuid', () => {
    it('returns device detail', async () => {
      const dev = { id: '1', deviceUuid: 'abc', name: 'Dev 1' };
      mockService.findByUuid.mockResolvedValue(dev);
      const res = await controller.getByUuid('abc');
      expect(res).toBe(dev);
    });
  });

  describe('pair', () => {
    it('calls pairDevice with payload', async () => {
      const dev = { id: '1', deviceUuid: 'abc', isPaired: true };
      mockService.pairDevice = jest.fn().mockResolvedValue(dev);
      const res = await controller.pair({
        pairingCode: 'ABC9P2',
        name: 'My Clock',
        userId: 'user1'
      });
      expect(res).toBe(dev);
      expect(mockService.pairDevice).toHaveBeenCalledWith({
        pairingCode: 'ABC9P2',
        name: 'My Clock',
        userId: 'user1'
      });
    });
  });

  describe('unpair', () => {
    it('calls unpairDevice with uuid', async () => {
      const dev = { id: '1', deviceUuid: 'abc', isPaired: false };
      mockService.unpairDevice = jest.fn().mockResolvedValue(dev);
      const res = await controller.unpair('abc');
      expect(res).toBe(dev);
      expect(mockService.unpairDevice).toHaveBeenCalledWith('abc');
    });
  });
});
