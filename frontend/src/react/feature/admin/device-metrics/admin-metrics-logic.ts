// Pure data shaping for the admin telemetry dashboard (import-free so `node --test` runs it directly).

export interface FleetDevice {
  deviceUuid: string | null;
  isConfigured: boolean;
  lastSeenAt: string | null;
  metricsInterval: number;
}

export interface FleetStatus {
  total: number;
  online: number;
  offline: number;
  pending: number;
  switchedOff: number;
}

/** Seen within three telemetry intervals (one missed upload is not an outage). */
export function isOnline(d: FleetDevice, now: number): boolean {
  return Boolean(d.lastSeenAt && now - Date.parse(d.lastSeenAt) <= 3 * d.metricsInterval);
}

/**
 * Pending = paired in the app but never confirmed by hardware; switched off = owner disabled it;
 * online = seen within three telemetry intervals; else offline.
 */
export function fleetStatus(devices: FleetDevice[], now: number): FleetStatus {
  const status: FleetStatus = {
    total: devices.length,
    online: 0,
    offline: 0,
    pending: 0,
    switchedOff: 0
  };
  for (const d of devices) {
    if (!d.deviceUuid) status.pending++;
    else if (!d.isConfigured) status.switchedOff++;
    else if (isOnline(d, now)) status.online++;
    else status.offline++;
  }
  return status;
}

export interface MetricPoint {
  createdAt: string;
  ramFreeBytes: number;
  ramMinFreeEver: number;
  ramMaxAllocBlock: number;
  wifiSignalRssi: number;
  uptimeSeconds: number;
  fsUsedBytes: number;
}

const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;

/** Chart series, oldest first (the API returns newest first), in KB / dBm / hours. */
export function metricSeries(metrics: MetricPoint[]) {
  const sorted = [...metrics].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return {
    time: sorted.map((m) => new Date(m.createdAt)),
    ramFreeKb: sorted.map((m) => kb(m.ramFreeBytes)),
    ramMinKb: sorted.map((m) => kb(m.ramMinFreeEver)),
    ramBlockKb: sorted.map((m) => kb(m.ramMaxAllocBlock)),
    rssi: sorted.map((m) => m.wifiSignalRssi),
    uptimeHours: sorted.map((m) => Math.round((m.uptimeSeconds / 3600) * 100) / 100),
    fsUsedKb: sorted.map((m) => kb(m.fsUsedBytes))
  };
}

// esp_reset_reason_t
const RESET_REASONS: Record<number, string> = {
  0: 'Unknown',
  1: 'Power on',
  2: 'External pin',
  3: 'Software restart',
  4: 'Crash (panic)',
  5: 'Interrupt watchdog',
  6: 'Task watchdog',
  7: 'Other watchdog',
  8: 'Deep sleep wake',
  9: 'Brownout',
  10: 'SDIO'
};

export function resetReasonName(code: number): string {
  return RESET_REASONS[code] ?? `Unknown (${code})`;
}
