'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import type { DeviceModel } from '@helpers/types';
import { formatDate } from '@helpers/utils';
import { useDeviceMetrics } from '@hooks/use-device-metrics';
import { metricSeries, resetReasonName } from './admin-metrics-logic';

const ACCENT = '#6dffb0';
const ACCENT_2 = '#ffb547';
const MUTED = '#aab2ad';

// Telemetry arrives every metricsInterval (default 10 min): 144 samples = 24 h, 432 = 3 days, 500 = API cap.
const RANGES = [
  { label: '24 h', limit: 144 },
  { label: '3 days', limit: 432 },
  { label: '7 days', limit: 500 }
];

const timeAxis = (data: Date[]) => [
  {
    data,
    scaleType: 'time' as const,
    valueFormatter: (d: Date) =>
      d.toLocaleString('de-CH', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
  }
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--line)' }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ color: 'var(--fg)', fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

/** Telemetry charts for one device (admins only; the BFF enforces it). */
export function DeviceMetricsPanel({ device }: { device: DeviceModel }) {
  const [limit, setLimit] = useState(RANGES[0].limit);
  const { metrics, isMetricsLoading, metricsError } = useDeviceMetrics(device.deviceUuid, limit);
  const s = metricSeries(metrics);
  const latest = metrics[0];

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ color: 'var(--fg-2)', fontSize: 13 }}>
          {device.name} · {device.stationName} · owner {device.userId ?? '-'}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={limit}
          onChange={(_e, v: number | null) => v && setLimit(v)}
        >
          {RANGES.map((r) => (
            <ToggleButton key={r.limit} value={r.limit}>
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {isMetricsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: 'var(--a1)' }} />
        </Box>
      ) : metricsError ? (
        <Typography sx={{ color: 'var(--a2)' }}>{(metricsError as Error).message}</Typography>
      ) : metrics.length === 0 ? (
        <Typography sx={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>
          No telemetry yet. The device reports every {Math.round(device.metricsInterval / 60000)}{' '}
          minutes.
        </Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {[
              ['Firmware', latest.firmwareVersion ?? 'unknown'],
              ['Last reset', resetReasonName(latest.resetReason)],
              [
                'Uptime',
                `${Math.floor(latest.uptimeSeconds / 3600)} h ${Math.floor((latest.uptimeSeconds % 3600) / 60)} min`
              ],
              ['Wi-Fi', `${latest.wifiSignalRssi} dBm · ch ${latest.wifiChannel}`],
              ['CPU', `${latest.cpuFreqMHz} MHz`],
              ['Last report', formatDate(latest.createdAt)]
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 6, md: 4, lg: 2 }}>
                <Typography sx={{ fontSize: 11, color: 'var(--fg-3)' }}>{label}</Typography>
                <Typography
                  sx={{
                    fontSize: 14,
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-jetbrains-mono)'
                  }}
                >
                  {value}
                </Typography>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <ChartCard title="Heap memory (KB)">
                <LineChart
                  height={240}
                  grid={{ horizontal: true }}
                  xAxis={timeAxis(s.time)}
                  series={[
                    {
                      data: s.ramFreeKb,
                      label: 'Free',
                      color: ACCENT,
                      showMark: false,
                      curve: 'linear'
                    },
                    {
                      data: s.ramMinKb,
                      label: 'Lowest ever',
                      color: ACCENT_2,
                      showMark: false,
                      curve: 'linear'
                    },
                    {
                      data: s.ramBlockKb,
                      label: 'Largest block',
                      color: MUTED,
                      showMark: false,
                      curve: 'linear'
                    }
                  ]}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <ChartCard title="Wi-Fi signal (dBm)">
                <LineChart
                  height={240}
                  grid={{ horizontal: true }}
                  xAxis={timeAxis(s.time)}
                  yAxis={[{ min: -100, max: -20 }]}
                  series={[
                    {
                      data: s.rssi,
                      label: 'RSSI',
                      color: ACCENT,
                      showMark: false,
                      curve: 'linear'
                    }
                  ]}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <ChartCard title="Uptime (hours) · drops are reboots">
                <LineChart
                  height={240}
                  grid={{ horizontal: true }}
                  xAxis={timeAxis(s.time)}
                  series={[
                    {
                      data: s.uptimeHours,
                      label: 'Uptime',
                      color: ACCENT_2,
                      showMark: false,
                      curve: 'linear'
                    }
                  ]}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <ChartCard title="Flash storage used (KB)">
                <LineChart
                  height={240}
                  grid={{ horizontal: true }}
                  xAxis={timeAxis(s.time)}
                  series={[
                    {
                      data: s.fsUsedKb,
                      label: 'LittleFS used',
                      color: MUTED,
                      showMark: false,
                      curve: 'linear'
                    }
                  ]}
                />
              </ChartCard>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
