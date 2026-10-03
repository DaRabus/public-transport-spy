// Run: npm test (frontend), typechecked with tsconfig.test.json. Pure data shaping for the admin telemetry dashboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fleetStatus,
  isOnline,
  metricSeries,
  resetReasonName,
  type FleetDevice,
  type MetricPoint
} from './admin-metrics-logic.ts';

const NOW = Date.parse('2026-10-07T12:00:00Z');
const device = (over: Partial<FleetDevice>): FleetDevice => ({
  deviceUuid: 'u',
  isConfigured: true,
  lastSeenAt: null,
  metricsInterval: 600000,
  ...over
});

test('fleet status: pending, switched off, online within 3 metric intervals, else offline', () => {
  const s = fleetStatus(
    [
      device({ deviceUuid: null }),
      device({ isConfigured: false, lastSeenAt: '2026-10-07T11:59:00Z' }),
      device({ lastSeenAt: '2026-10-07T11:40:00Z' }), // 20 min < 30 min
      device({ lastSeenAt: '2026-10-07T11:00:00Z' }), // 60 min
      device({ lastSeenAt: null })
    ],
    NOW
  );
  assert.deepEqual(s, { total: 5, online: 1, offline: 2, pending: 1, switchedOff: 1 });
});

test('online means seen within three telemetry intervals, not merely seen once', () => {
  assert.equal(isOnline(device({ lastSeenAt: '2026-10-07T11:31:00Z' }), NOW), true);
  assert.equal(isOnline(device({ lastSeenAt: '2026-10-06T17:47:00Z' }), NOW), false);
  assert.equal(isOnline(device({ lastSeenAt: null }), NOW), false);
});

test('metric series are oldest-first with KB/hour units for the charts', () => {
  const m = (createdAt: string, extra?: Partial<MetricPoint>): MetricPoint => ({
    createdAt,
    ramFreeBytes: 204800,
    ramMinFreeEver: 153600,
    ramMaxAllocBlock: 102400,
    wifiSignalRssi: -60,
    uptimeSeconds: 7200,
    fsUsedBytes: 51200,
    ...extra
  });
  const s = metricSeries([
    m('2026-10-07T11:50:00Z', { wifiSignalRssi: -70 }),
    m('2026-10-07T11:40:00Z')
  ]); // API: newest first
  assert.deepEqual(
    s.time.map((d) => d.toISOString()),
    ['2026-10-07T11:40:00.000Z', '2026-10-07T11:50:00.000Z']
  );
  assert.deepEqual(s.rssi, [-60, -70]);
  assert.deepEqual(s.ramFreeKb, [200, 200]);
  assert.deepEqual(s.ramMinKb, [150, 150]);
  assert.deepEqual(s.ramBlockKb, [100, 100]);
  assert.deepEqual(s.uptimeHours, [2, 2]);
  assert.deepEqual(s.fsUsedKb, [50, 50]);
});

test('ESP32 reset reasons are readable', () => {
  assert.equal(resetReasonName(1), 'Power on');
  assert.equal(resetReasonName(4), 'Crash (panic)');
  assert.equal(resetReasonName(9), 'Brownout');
  assert.equal(resetReasonName(42), 'Unknown (42)');
});
