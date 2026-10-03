/** Display font themes; keep in sync with THEMES in the API's screen-composer.ts. */
export type Theme = 'standard' | 'retro' | 'bold';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
  BANNED = 'BANNED'
}

export interface UserModel {
  id?: string;
  userName: string;
  role: UserRole;
  socialUrl?: string | null;
  avatarUrl?: string | null;
  isLoggedIn?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** One page of a device's screen rotation (mirrors the API's DisplayPageDto). */
export interface DisplayPage {
  type: 'departures' | 'clock' | 'message';
  durationSec?: number;
  station?: string;
  title?: string;
  rows?: number;
  timeFormat?: 'countdown' | 'clock';
  showPlatform?: boolean;
  showDelay?: boolean;
  lines?: string[];
  excludeLines?: string[];
  categories?: string[];
  destinationContains?: string;
  walkMinutes?: number;
  showDate?: boolean;
  text?: string;
}

export interface DisplayProfile {
  pages: DisplayPage[];
}

export interface DeviceModel {
  id: string;
  /** Null until the physical device has confirmed this pairing code with its real hardware UUID. */
  deviceUuid: string | null;
  name: string;
  stationName: string;
  theme: Theme;
  apiInterval: number;
  screenInterval: number;
  metricsInterval: number;
  /** Screen pages; null = default departures board. */
  display?: DisplayProfile | null;
  /** IANA zone, e.g. "Europe/Zurich" */
  timezone: string;
  isConfigured: boolean;
  scheduleEnabled: boolean;
  scheduleOn: number;
  scheduleOff: number;
  scheduleDays: number;
  isPaired: boolean;
  pairingCode: string | null;
  claimedAt: string | null;
  lastSeenAt: string | null;
  lastIp: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceMetricModel {
  updatedAt?: string;
  firmwareVersion?: string | null;
  id: string;
  deviceId: string;
  stationName: string;
  uptimeSeconds: number;
  resetReason: number;
  cpuFreqMHz: number;
  ramFreeBytes: number;
  ramTotalBytes: number;
  ramMinFreeEver: number;
  ramMaxAllocBlock: number;
  fsTotalBytes: number;
  fsUsedBytes: number;
  wifiSignalRssi: number;
  wifiBssid: string | null;
  wifiChannel: number;
  createdAt: string;
}

export interface TransitStation {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
}
