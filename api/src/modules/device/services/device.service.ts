import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IsNull, LessThan, Repository } from 'typeorm';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from '../pairing-code';
import { Device } from '../entities/device.entity';
import { DeviceMetric } from '../entities/device-metric.entity';
import { User } from '../../auth/entities/user.entity';
import { TransitService } from '../../transit/services/transit.service';
import { DeviceConfigResponseDto } from '../dto/device-config-response.dto';
import { DeviceMetricDto, DeviceMetricsInputDto } from '../dto/device-metrics-input.dto';
import { toAbstractDto } from '../../shared-modules/abstract/lib';
import { ClaimDeviceDto } from '../dto/claim-device.dto';
import { DeviceDetailDto, UpdateDeviceDto } from '../dto/device.dto';
import { TransitDepartureDto } from '../../transit/dto/transit-departure.dto';
import type { Env } from '../../shared-modules/config/env.validation';
import { DeviceHelloResponseDto } from '../dto/device-hello-response.dto';
import {
  composeScreens,
  DisplayProfile,
  ScreensResponse,
  stationsFor,
  type Theme
} from '../screens/screen-composer';
import { PreviewScreensDto } from '../dto/display-profile.dto';
import { toPosixTimezone } from '../timezones/timezones';

const DEVICE_UUID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const WITH_OWNER = { user: true } as const;
const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

function toDetailDto(d: Device): DeviceDetailDto {
  return {
    ...toAbstractDto(d),
    deviceUuid: d.deviceUuid,
    name: d.name,
    stationName: d.stationName,
    timezone: d.timezone,
    theme: d.theme,
    apiInterval: d.apiInterval,
    screenInterval: d.screenInterval,
    metricsInterval: d.metricsInterval,
    isConfigured: d.isConfigured,
    scheduleEnabled: d.scheduleEnabled ?? false,
    scheduleOn: d.scheduleOn ?? 360,
    scheduleOff: d.scheduleOff ?? 1380,
    scheduleDays: d.scheduleDays ?? 127,
    lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
    lastIp: d.lastIp ?? null,
    isPaired: d.isPaired ?? false,
    pairingCode: d.isPaired ? null : (d.pairingCode ?? null),
    claimedAt: d.claimedAt ? d.claimedAt.toISOString() : null,
    // The public API identifies owners by username (the session identity), not the internal user UUID.
    userId: d.user?.userName ?? null,
    display: d.display ?? null
  };
}

function toMetricDto(m: DeviceMetric): DeviceMetricDto {
  return {
    ...toAbstractDto(m),
    deviceId: m.deviceId,
    stationName: m.stationName,
    uptimeSeconds: m.uptimeSeconds,
    resetReason: m.resetReason,
    cpuFreqMHz: m.cpuFreqMHz,
    ramFreeBytes: m.ramFreeBytes,
    ramTotalBytes: m.ramTotalBytes,
    ramMinFreeEver: m.ramMinFreeEver,
    ramMaxAllocBlock: m.ramMaxAllocBlock,
    fsTotalBytes: m.fsTotalBytes,
    fsUsedBytes: m.fsUsedBytes,
    wifiSignalRssi: m.wifiSignalRssi,
    wifiBssid: m.wifiBssid ?? null,
    wifiChannel: m.wifiChannel,
    firmwareVersion: m.firmwareVersion ?? null
  };
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DeviceMetric)
    private readonly metricRepo: Repository<DeviceMetric>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly transitService: TransitService,
    private readonly config: ConfigService<Env, true>
  ) {}

  private validateUuidFormat(deviceUuid: string): void {
    if (!deviceUuid || !DEVICE_UUID_PATTERN.test(deviceUuid)) {
      throw new BadRequestException('Invalid device UUID format');
    }
  }

  /**
   * Validates that the caller holds the legitimate authentication token for this device.
   */
  async validateDeviceAccess(deviceUuid: string, providedToken?: string): Promise<Device> {
    this.validateUuidFormat(deviceUuid);

    const device = await this.deviceRepo.findOne({ where: { deviceUuid }, relations: WITH_OWNER });
    if (!device) {
      throw new NotFoundException(`Device '${deviceUuid}' not found`);
    }

    if (device.deviceToken) {
      if (!providedToken) {
        throw new UnauthorizedException('Missing X-Device-Token authentication header');
      }
      const a = Buffer.from(providedToken);
      const b = Buffer.from(device.deviceToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid device authentication token');
      }
    }

    return device;
  }

  async getDeviceConfig(
    deviceUuid: string,
    clientIp?: string,
    providedToken?: string
  ): Promise<DeviceConfigResponseDto | null> {
    this.validateUuidFormat(deviceUuid);

    const device = await this.deviceRepo.findOne({ where: { deviceUuid }, relations: WITH_OWNER });
    if (!device) {
      // Unlike the old TOFU model, an unrecognized UUID is never auto-registered here:
      // the UUID only becomes known to the backend via a claimed pairing code (see claimDevice).
      throw new NotFoundException(
        `Device '${deviceUuid}' is not registered. Pair it first via /api/v1/device/claim.`
      );
    }

    if (device.deviceToken) {
      if (!providedToken) {
        throw new UnauthorizedException('Missing X-Device-Token authentication header');
      }
      const a = Buffer.from(providedToken);
      const b = Buffer.from(device.deviceToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid device authentication token');
      }
    }

    if (device.isPaired && device.pairingCode) {
      // First authenticated call after a claim: the device holds its token, the code is spent.
      device.pairingCode = null;
      device.pairingCodeExpiresAt = null;
    }

    device.lastSeenAt = new Date();
    if (clientIp) device.lastIp = clientIp;
    await this.deviceRepo.save(device);

    if (!device.isConfigured) {
      this.logger.warn({ deviceUuid }, 'Device found but marked unconfigured');
      return null;
    }

    if (!device.isPaired) {
      const now = new Date();
      if (
        !device.pairingCode ||
        !device.pairingCodeExpiresAt ||
        device.pairingCodeExpiresAt <= now
      ) {
        device.pairingCode = this.generatePairingCode();
        device.pairingCodeExpiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
        await this.deviceRepo.save(device);
      }
    }

    return this.toConfigResponse(device);
  }

  /**
   * Called by a device that is displaying a locally-generated pairing code for the first time.
   * The UUID only becomes trusted/known to the backend once it is bound to a code an admin
   * has already claimed via pairDevice() — closing the race where a guessed/guessable UUID
   * could be front-run and auto-registered before the real device ever makes contact.
   */
  async claimDevice(dto: ClaimDeviceDto): Promise<DeviceConfigResponseDto> {
    this.validateUuidFormat(dto.deviceUuid);
    const normalized = dto.pairingCode.replace(/[\s-]/g, '').toUpperCase();

    const device = await this.deviceRepo.findOne({
      where: { pairingCode: normalized },
      relations: WITH_OWNER
    });
    if (!device) {
      throw new NotFoundException('No pairing request found for this code yet');
    }
    if (device.pairingCodeExpiresAt && device.pairingCodeExpiresAt < new Date()) {
      throw new BadRequestException(
        'Pairing code has expired. Generate a new one on the device and re-enter it.'
      );
    }
    if (device.deviceUuid && device.deviceUuid !== dto.deviceUuid) {
      throw new ConflictException('This pairing code is already bound to a different device');
    }
    if (device.deviceUuid === dto.deviceUuid && device.isPaired) {
      // Retry after a lost response: same code + same UUID gets the same token back.
      return this.toConfigResponse(device);
    }

    // A hardware UUID belongs to exactly one account. Another row may still hold it: an ownerless
    // leftover or the same account's earlier claim (e.g. a lost response) is replaced; a display that is
    // registered to another account is refused until its owner unpairs, transfers or deletes it.
    const existing = await this.deviceRepo.findOne({ where: { deviceUuid: dto.deviceUuid } });
    if (existing && existing.id !== device.id) {
      if (existing.userId && existing.userId !== device.userId) {
        throw new ForbiddenException(
          'This display is registered to another account. Its owner has to unpair it, transfer it or delete their account first.'
        );
      }
      await this.deviceRepo.remove(existing);
    }

    device.deviceUuid = dto.deviceUuid;
    if (!device.deviceToken) {
      device.deviceToken = randomBytes(16).toString('hex');
    }
    device.isPaired = true;
    // The code stays until the device's first authenticated /config call (see getDeviceConfig),
    // so a retry after a lost response still finds this row.
    device.claimedAt = new Date();
    device.lastSeenAt = new Date();

    const saved = await this.deviceRepo.save(device);
    this.logger.log(
      { deviceUuid: saved.deviceUuid },
      'Device claimed hardware UUID via pairing code'
    );
    return this.toConfigResponse(saved);
  }

  /** Unauthenticated bootstrap for a device that has no token yet: where its QR code should point. */
  getHello(): DeviceHelloResponseDto {
    return { pairBaseUrl: `${this.config.get('PUBLIC_APP_URL', { infer: true })}/pair` };
  }

  private toConfigResponse(device: Device): DeviceConfigResponseDto {
    const pairingCode = !device.isPaired ? (device.pairingCode ?? undefined) : undefined;
    const appUrl = this.config.get('PUBLIC_APP_URL', { infer: true });
    const backendBaseUrl = this.config.get('DEVICE_BACKEND_URL', { infer: true });
    return {
      stationName: device.stationName,
      timezone: toPosixTimezone(device.timezone),
      theme: device.theme,
      apiInterval: device.isPaired ? device.apiInterval : 5000,
      screenInterval: device.screenInterval,
      metricsInterval: device.metricsInterval,
      deviceToken: device.deviceToken ?? undefined,
      isPaired: device.isPaired ?? false,
      pairingCode,
      pairingUrl: pairingCode ? `${appUrl}/pair?code=${pairingCode}` : undefined,
      backendBaseUrl: backendBaseUrl || undefined,
      schedule: device.scheduleEnabled
        ? { on: device.scheduleOn, off: device.scheduleOff, days: device.scheduleDays }
        : undefined
    };
  }

  async getDeviceData(
    deviceUuid: string,
    clientIp?: string,
    providedToken?: string
  ): Promise<{ station: string; departures: TransitDepartureDto[] }> {
    const device = await this.validateDeviceAccess(deviceUuid, providedToken);
    const stationName = device.stationName || 'Zürich HB';

    device.lastSeenAt = new Date();
    if (clientIp) device.lastIp = clientIp;
    await this.deviceRepo.save(device);

    const departures = await this.transitService.getDepartures(stationName, 8);
    return {
      station: stationName,
      departures
    };
  }

  /** Composes the owner's screen pages into the widget layout the firmware renders. */
  async getDeviceScreens(
    deviceUuid: string,
    clientIp?: string,
    providedToken?: string
  ): Promise<ScreensResponse> {
    const device = await this.validateDeviceAccess(deviceUuid, providedToken);

    device.lastSeenAt = new Date();
    if (clientIp) device.lastIp = clientIp;
    await this.deviceRepo.save(device);

    return this.composeFor(device.display, device.stationName, device.theme);
  }

  /** Live preview for the web app: composes unsaved form values (falling back to stored ones), saves nothing. */
  async previewScreens(deviceUuid: string, draft: PreviewScreensDto): Promise<ScreensResponse> {
    this.validateUuidFormat(deviceUuid);
    const device = await this.deviceRepo.findOne({ where: { deviceUuid } });
    if (!device) {
      throw new NotFoundException(`Device '${deviceUuid}' not found`);
    }
    return this.composeFor(
      draft.display !== undefined ? (draft.display as DisplayProfile | null) : device.display,
      draft.stationName?.trim() || device.stationName,
      draft.theme ?? device.theme
    );
  }

  private async composeFor(
    display: DisplayProfile | null,
    stationName: string,
    theme: Theme
  ): Promise<ScreensResponse> {
    const defaultStation = stationName || 'Zürich HB';
    const stations = stationsFor(display, defaultStation);
    // 40 = enough depth that filtered pages still fill up (the transit service caches per station).
    // A station whose timetable is unavailable maps to null: the composer shows an honest message.
    const boards = new Map(
      await Promise.all(
        stations.map(
          async (s) =>
            [s, await this.transitService.getDepartures(s, 40).catch(() => null)] as const
        )
      )
    );
    return composeScreens(
      display,
      { defaultStation, theme, nowSec: Math.floor(Date.now() / 1000) },
      boards
    );
  }

  async recordMetrics(
    dto: DeviceMetricsInputDto,
    clientIp?: string,
    providedToken?: string
  ): Promise<void> {
    const uuid = dto.deviceId;
    this.validateUuidFormat(uuid);

    const device = await this.deviceRepo.findOne({
      where: { deviceUuid: uuid },
      relations: WITH_OWNER
    });
    if (!device) {
      throw new NotFoundException(`Device '${uuid}' not found`);
    }

    if (device.deviceToken) {
      if (!providedToken) {
        throw new UnauthorizedException('Missing X-Device-Token header');
      }
      const a = Buffer.from(providedToken);
      const b = Buffer.from(device.deviceToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid device authentication token');
      }
    }

    device.lastSeenAt = new Date();
    if (clientIp) device.lastIp = clientIp;
    await this.deviceRepo.save(device);

    const metric = this.metricRepo.create({
      deviceId: device.id,
      stationName: dto.stationName,
      uptimeSeconds: dto.uptimeSeconds,
      resetReason: dto.resetReason,
      cpuFreqMHz: dto.cpuFreqMHz,
      ramFreeBytes: dto.ramFreeBytes,
      ramTotalBytes: dto.ramTotalBytes,
      ramMinFreeEver: dto.ramMinFreeEver,
      ramMaxAllocBlock: dto.ramMaxAllocBlock,
      fsTotalBytes: dto.fsTotalBytes,
      fsUsedBytes: dto.fsUsedBytes,
      wifiSignalRssi: dto.wifiSignalRssi,
      wifiBssid: dto.wifiBssid ?? null,
      wifiChannel: dto.wifiChannel,
      firmwareVersion: dto.firmwareVersion ?? null
    });

    await this.metricRepo.save(metric);
  }

  // Admin / Management API methods
  async listAll(userId?: string): Promise<DeviceDetailDto[]> {
    await this.deleteExpiredPendingClaims();
    const devices = await this.deviceRepo.find({
      where: userId ? { user: { userName: userId.trim().toLowerCase() } } : {},
      relations: WITH_OWNER,
      order: { updatedAt: 'DESC' }
    });
    return devices.map(toDetailDto);
  }

  async findByUuid(deviceUuid: string): Promise<DeviceDetailDto | null> {
    this.validateUuidFormat(deviceUuid);
    const device = await this.deviceRepo.findOne({ where: { deviceUuid }, relations: WITH_OWNER });
    return device ? toDetailDto(device) : null;
  }

  async update(deviceUuid: string, patch: UpdateDeviceDto): Promise<DeviceDetailDto | null> {
    this.validateUuidFormat(deviceUuid);

    const existing = await this.deviceRepo.findOne({
      where: { deviceUuid },
      relations: WITH_OWNER
    });
    if (!existing) return null;

    Object.assign(existing, patch);
    const saved = await this.deviceRepo.save(existing);
    return toDetailDto(saved);
  }

  async remove(deviceUuid: string): Promise<boolean> {
    this.validateUuidFormat(deviceUuid);

    const existing = await this.deviceRepo.findOne({
      where: { deviceUuid },
      relations: WITH_OWNER
    });
    if (!existing) return false;

    // Metrics are removed by the ON DELETE CASCADE foreign key.
    await this.deviceRepo.remove(existing);
    return true;
  }

  async getMetrics(deviceUuid: string, limit = 50): Promise<DeviceMetricDto[]> {
    this.validateUuidFormat(deviceUuid);

    const metrics = await this.metricRepo.find({
      where: { device: { deviceUuid } },
      order: { createdAt: 'DESC' },
      take: limit
    });
    return metrics.map(toMetricDto);
  }

  private generatePairingCode(): string {
    const bytes = randomBytes(PAIRING_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
      code += PAIRING_CODE_ALPHABET[bytes[i] % PAIRING_CODE_ALPHABET.length];
    }
    return code;
  }

  async pairDevice(dto: {
    pairingCode: string;
    name?: string;
    stationName?: string;
    userId: string;
  }): Promise<DeviceDetailDto> {
    const normalized = dto.pairingCode.replace(/[\s-]/g, '').toUpperCase();
    const owner = await this.userRepo.findOne({
      where: { userName: dto.userId.trim().toLowerCase() }
    });
    if (!owner) {
      throw new NotFoundException(`User '${dto.userId}' not found`);
    }
    await this.deleteExpiredPendingClaims();
    const existing = await this.deviceRepo.findOne({
      where: { pairingCode: normalized },
      relations: WITH_OWNER
    });

    if (existing) {
      if (existing.pairingCodeExpiresAt && existing.pairingCodeExpiresAt < new Date()) {
        throw new BadRequestException(
          'Pairing code has expired. Please check your device display for a new code.'
        );
      }
      if (existing.isPaired) {
        throw new ConflictException('This pairing code has already been claimed');
      }
      // A pending request (no hardware UUID yet) belongs to whoever entered the code first; another
      // user must not take it over. Unpaired devices (UUID set, owner cleared) stay claimable.
      if (!existing.deviceUuid && existing.userId && existing.userId !== owner.id) {
        throw new ConflictException('This pairing code is already being paired by another account');
      }

      existing.user = owner;
      existing.userId = owner.id!;
      if (dto.name) existing.name = dto.name;
      if (dto.stationName) existing.stationName = dto.stationName;

      if (existing.deviceUuid) {
        // Device already contacted the backend before (e.g. re-pairing after an unpair) — claim now.
        existing.isPaired = true;
        existing.pairingCode = null;
        existing.pairingCodeExpiresAt = null;
        existing.claimedAt = new Date();
      } else {
        // Still waiting for the physical device to confirm its UUID via /api/v1/device/claim.
        existing.pairingCodeExpiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
      }

      const saved = await this.deviceRepo.save(existing);
      this.logger.log({ deviceId: saved.id }, 'Pairing code claimed by user');
      return toDetailDto(saved);
    }

    // Brand-new pending claim: the device hasn't contacted the backend yet, only its
    // locally-generated pairing code is known so far.
    const created = this.deviceRepo.create({
      pairingCode: normalized,
      user: owner,
      userId: owner.id!,
      name: dto.name || 'ESP32 Departure Board',
      stationName: dto.stationName || 'Zürich HB',
      deviceUuid: null,
      isPaired: false,
      pairingCodeExpiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MS)
    });
    const saved = await this.deviceRepo.save(created);
    this.logger.log(
      { deviceId: saved.id },
      'New pending device claim created, awaiting hardware confirmation'
    );
    return toDetailDto(saved);
  }

  /**
   * Hands a display to another account (usernames are unique). It stays paired and keeps its token,
   * so it keeps running; only the owner changes. The caller must be the current owner.
   */
  async transferDevice(
    deviceUuid: string,
    dto: { toUserName: string; fromUserName: string }
  ): Promise<DeviceDetailDto> {
    this.validateUuidFormat(deviceUuid);
    const device = await this.deviceRepo.findOne({ where: { deviceUuid }, relations: WITH_OWNER });
    if (
      !device ||
      !device.isPaired ||
      device.user?.userName !== dto.fromUserName.trim().toLowerCase()
    ) {
      throw new NotFoundException(`Device '${deviceUuid}' not found`);
    }
    const toUserName = dto.toUserName.trim().toLowerCase();
    if (toUserName === device.user.userName) {
      throw new BadRequestException('This display already belongs to that account');
    }
    const target = await this.userRepo.findOne({ where: { userName: toUserName } });
    if (!target) {
      throw new NotFoundException(`No account with the username '${toUserName}'`);
    }

    device.user = target;
    device.userId = target.id!;
    const saved = await this.deviceRepo.save(device);
    this.logger.log(
      { deviceUuid, from: dto.fromUserName, to: toUserName },
      'Display transferred to another account'
    );
    return toDetailDto(saved);
  }

  /**
   * Owner cancels a pending pairing request (e.g. a mistyped code). Addressed by the row's internal id
   * because a pending request has no hardware UUID yet; claimed devices can never be deleted this way.
   */
  async cancelPendingClaim(id: string, userName: string): Promise<void> {
    const pending = await this.deviceRepo.findOne({
      where: { id, deviceUuid: IsNull(), user: { userName: userName.trim().toLowerCase() } }
    });
    if (!pending) {
      throw new NotFoundException('No pending pairing request with this id for this user');
    }
    await this.deviceRepo.remove(pending);
    this.logger.log({ deviceId: id }, 'Pending pairing request cancelled by owner');
  }

  /** Abandoned pending claims (typos, displays that never came online) expire after the pairing TTL. */
  private async deleteExpiredPendingClaims(): Promise<void> {
    await this.deviceRepo.delete({
      deviceUuid: IsNull(),
      pairingCodeExpiresAt: LessThan(new Date())
    });
  }

  async unpairDevice(deviceUuid: string): Promise<DeviceDetailDto> {
    this.validateUuidFormat(deviceUuid);

    const device = await this.deviceRepo.findOne({ where: { deviceUuid }, relations: WITH_OWNER });
    if (!device) {
      throw new NotFoundException(`Device '${deviceUuid}' not found`);
    }

    device.isPaired = false;
    device.pairingCode = null;
    device.pairingCodeExpiresAt = null;
    device.claimedAt = null;
    device.user = null;
    device.userId = null;

    const saved = await this.deviceRepo.save(device);
    this.logger.log({ deviceUuid: saved.deviceUuid }, 'Device unpaired');
    return toDetailDto(saved);
  }
}
