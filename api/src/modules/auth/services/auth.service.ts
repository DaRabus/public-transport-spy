import { toAbstractDto } from '../../shared-modules/abstract/lib';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Device, RELEASED_DEVICE_RESET } from '../../device/entities/device.entity';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import {
  AccountDeletedDto,
  LoginUserDto,
  RegisterUserDto,
  UpdateUserDto,
  UserResponseDto
} from '../dto/auth.dto';

const BCRYPT_ROUNDS = 10;

function toUserDto(user: User): UserResponseDto {
  return {
    ...toAbstractDto(user),
    userName: user.userName,
    role: user.role,
    socialUrl: user.socialUrl ?? null,
    avatarUrl: user.avatarUrl ?? null
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Compared against when the user does not exist so response time does not reveal valid usernames. */
  private dummyHash?: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource
  ) {}

  async register(dto: RegisterUserDto): Promise<UserResponseDto> {
    const userName = dto.userName.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { userName } });
    if (existing) {
      throw new ConflictException(`Username '${userName}' is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      userName,
      passwordHash,
      role: UserRole.USER
    });

    const saved = await this.userRepo.save(user);
    this.logger.log({ userName: saved.userName }, 'New user registered');
    return toUserDto(saved);
  }

  async login(dto: LoginUserDto): Promise<UserResponseDto> {
    const userName = dto.userName.trim().toLowerCase();

    const user = await this.userRepo.findOne({ where: { userName } });
    const hash =
      user?.passwordHash ?? (this.dummyHash ??= await bcrypt.hash('dummy', BCRYPT_ROUNDS));
    const isValid = await bcrypt.compare(dto.password, hash);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    this.logger.log({ userName: user.userName }, 'User logged in successfully');
    return toUserDto(user);
  }

  async findByUsername(userName: string): Promise<UserResponseDto | null> {
    const user = await this.userRepo.findOne({
      where: { userName: userName.trim().toLowerCase() }
    });
    return user ? toUserDto(user) : null;
  }

  /**
   * Deletes the account after checking the password. In one transaction: pending pairing requests are
   * dropped and every display is released (RELEASED_DEVICE_RESET), so its hardware UUID can be claimed
   * by another account. The UUID itself never moves: it stays on the same device row.
   */
  async deleteAccount(userName: string, currentPassword: string): Promise<AccountDeletedDto> {
    const user = await this.userRepo.findOne({
      where: { userName: userName.trim().toLowerCase() }
    });
    if (!user) {
      throw new NotFoundException(`User '${userName}' not found`);
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password does not match');
    }

    const releasedDevices = await this.dataSource.transaction(async (em) => {
      await em.delete(Device, { userId: user.id, deviceUuid: IsNull() });
      const released = await em.update(Device, { userId: user.id }, RELEASED_DEVICE_RESET);
      await em.delete(User, { id: user.id });
      return released.affected ?? 0;
    });

    this.logger.log(
      { userName: user.userName, releasedDevices },
      'Account deleted, displays released'
    );
    return { releasedDevices };
  }

  async updateUser(userName: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({
      where: { userName: userName.trim().toLowerCase() }
    });
    if (!user) {
      throw new NotFoundException(`User '${userName}' not found`);
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Current password is required to change the password');
      }
      const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedException('Current password does not match');
      }
      user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    }

    if (dto.socialUrl !== undefined) {
      user.socialUrl = dto.socialUrl ? dto.socialUrl : null;
    }

    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl ? dto.avatarUrl : null;
    }

    const saved = await this.userRepo.save(user);
    this.logger.log({ userName: saved.userName }, 'User profile updated');
    return toUserDto(saved);
  }
}
