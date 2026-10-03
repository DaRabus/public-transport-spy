import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { Device, RELEASED_DEVICE_RESET } from '../../device/entities/device.entity';

describe('AuthService account management', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let em: { delete: jest.Mock; update: jest.Mock };
  const passwordHash = bcrypt.hashSync('correct-horse', 4);

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'alice-uuid', userName: 'alice', passwordHash }),
      create: jest.fn((u) => u),
      save: jest.fn(async (u) => ({ id: 'new-uuid', ...u }))
    };
    em = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 2 })
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn(async (work: (m: typeof em) => unknown) => work(em)) }
        }
      ]
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('keeps usernames unique (case-insensitive)', async () => {
    await expect(service.register({ userName: 'Alice', password: 'whatever123' })).rejects.toThrow(
      /already taken/
    );
  });

  it('deletes the account and releases its displays so their hardware UUIDs can be claimed again', async () => {
    const res = await service.deleteAccount('alice', 'correct-horse');

    expect(res).toEqual({ releasedDevices: 2 });
    // pending pairing requests (no hardware UUID yet) are dropped
    expect(em.delete).toHaveBeenCalledWith(Device, { userId: 'alice-uuid', deviceUuid: IsNull() });
    // claimed displays lose their owner and personal settings and show a fresh pairing code
    expect(em.update).toHaveBeenCalledWith(Device, { userId: 'alice-uuid' }, RELEASED_DEVICE_RESET);
    expect(RELEASED_DEVICE_RESET).toMatchObject({
      userId: null,
      isPaired: false,
      display: null,
      scheduleEnabled: false
    });
    expect(em.delete).toHaveBeenCalledWith(User, { id: 'alice-uuid' });
  });

  it('requires the current password and changes nothing when it is wrong', async () => {
    await expect(service.deleteAccount('alice', 'wrong')).rejects.toThrow(UnauthorizedException);
    expect(em.delete).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
  });

  it('answers 404 for unknown accounts', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.deleteAccount('ghost', 'x')).rejects.toThrow(NotFoundException);
  });
});
