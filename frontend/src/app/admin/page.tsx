'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import type { DeviceModel } from '@helpers/types';
import { UserRole } from '@helpers/types';
import { useUser } from '@hooks/use-user';
import { DeviceMetricsPanel } from '@react-feature/admin/device-metrics';
import { fleetStatus } from '@react-feature/admin/device-metrics/admin-metrics-logic';

const fetchAdminDevices = async (url: string): Promise<DeviceModel[]> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status === 403 ? 'Admins only' : 'Failed to load devices');
  return ((await res.json()) as { data: DeviceModel[] }).data;
};

/** Fleet telemetry dashboard. Admins only: the BFF answers 403 to everyone else. */
export default function AdminPage() {
  const { userData, isUserDataLoading } = useUser();
  const isAdmin = userData?.role === UserRole.ADMIN;
  const {
    data: devices = [],
    error,
    isLoading
  } = useSWR(isAdmin ? '/api/v1/admin/devices' : null, fetchAdminDevices, {
    refreshInterval: 60000
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isUserDataLoading || (isAdmin && isLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: 'var(--a1)' }} />
      </Box>
    );
  }

  if (!isAdmin || error) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h5" sx={{ color: 'var(--fg)' }}>
          Admins only
        </Typography>
        <Typography sx={{ color: 'var(--fg-3)', mt: 1 }}>
          Device telemetry is only visible to administrators.
        </Typography>
      </Container>
    );
  }

  const status = fleetStatus(devices, Date.now());
  const claimed = devices.filter((d) => d.deviceUuid);
  const selected = claimed.find((d) => d.id === selectedId) ?? claimed[0] ?? null;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--fg)', mb: 0.5 }}>
        Fleet telemetry
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--fg-3)', mb: 4 }}>
        Health reports of all displays (heap, Wi-Fi, uptime, storage). Refreshes every minute.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Grid container spacing={2}>
            {[
              ['Displays', status.total],
              ['Online', status.online],
              ['Offline', status.offline],
              ['Pending pairing', status.pending],
              ['Switched off', status.switchedOff]
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 6, sm: 4 }}>
                <Card sx={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--line)' }}>
                  <CardContent>
                    <Typography sx={{ fontSize: 12, color: 'var(--fg-3)' }}>{label}</Typography>
                    <Typography
                      sx={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: 'var(--fg)'
                      }}
                    >
                      {value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            sx={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--line)', height: '100%' }}
          >
            <CardContent>
              <PieChart
                height={200}
                series={[
                  {
                    innerRadius: 45,
                    data: [
                      { id: 0, value: status.online, label: 'Online', color: '#6dffb0' },
                      { id: 1, value: status.offline, label: 'Offline', color: '#ff6b6b' },
                      { id: 2, value: status.pending, label: 'Pending', color: '#ffb547' },
                      { id: 3, value: status.switchedOff, label: 'Switched off', color: '#6a716d' }
                    ]
                  }
                ]}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack spacing={3}>
        <Autocomplete
          options={claimed}
          value={selected}
          disableClearable={Boolean(selected)}
          onChange={(_e, d) => setSelectedId(d?.id ?? null)}
          getOptionLabel={(d) => `${d.name} · ${d.stationName} · ${d.userId ?? 'no owner'}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => <TextField {...params} label="Display" />}
          sx={{ maxWidth: 520 }}
        />
        {selected ? (
          <DeviceMetricsPanel key={selected.id} device={selected} />
        ) : (
          <Typography sx={{ color: 'var(--fg-3)' }}>No paired displays yet.</Typography>
        )}
      </Stack>
    </Container>
  );
}
