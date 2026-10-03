'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { DisplayPage, Theme, TransitStation } from '@helpers/types';
import { cleanPages, ScreenPagesEditor } from '@react-feature/device/screen-pages-editor';
import { ScreenPreview } from '@react-feature/device/screen-preview';
import { TimezonePicker } from '@react-feature/device/timezone-picker';
import { type DisplayPower, DisplayPowerEditor } from '@react-feature/device/display-power-editor';
import { TransferDeviceCard } from '@react-feature/device/transfer-device-card';
import { isOnline } from '@react-feature/admin/device-metrics/admin-metrics-logic';
import { formatDate } from '@helpers/utils';
import { useDevice } from '@hooks/use-device';

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'standard', label: 'Standard (Helvetica Clean)' },
  { value: 'bold', label: 'Bold (Modern Sans)' },
  { value: 'retro', label: 'Retro (8-bit Pixel / Arcade)' }
];

/** Dark input styling shared by every field on this page. */
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--bg-2)',
    color: 'var(--fg)',
    '& fieldset': { borderColor: 'var(--line)' }
  },
  '& .MuiInputLabel-root': { color: 'var(--fg-3)' },
  '& .MuiFormHelperText-root': { color: 'var(--fg-3)' }
};

const cardSx = { backgroundColor: 'var(--bg-1)', border: '1px solid var(--line)' };

/** A titled block of the settings form; sections are separated by dividers in the parent stack. */
function SettingsSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="section">
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--fg)' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'var(--fg-3)', mt: 0.5 }}>
          {description}
        </Typography>
      )}
      <Box sx={{ mt: 2.5 }}>{children}</Box>
    </Box>
  );
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        py: 1.25,
        fontSize: 13,
        color: 'var(--fg-2)'
      }}
    >
      <span>{label}</span>
      <span>{children}</span>
    </Box>
  );
}

export default function DeviceSettingsPage({ params }: { params: Promise<{ uuid: string }> }) {
  const router = useRouter();
  const { uuid } = use(params);

  const {
    device,
    isLoadingDevice,
    mutateUpdateDevice,
    isMutatingUpdateDevice,
    mutateUnpairDevice,
    isMutatingUnpairDevice
  } = useDevice(uuid);

  const [name, setName] = useState('');
  const [stationName, setStationName] = useState('Zürich HB');
  const [timezone, setTimezone] = useState('Europe/Zurich');
  const [power, setPower] = useState<DisplayPower>({
    isConfigured: true,
    scheduleEnabled: false,
    scheduleOn: 360,
    scheduleOff: 1380,
    scheduleDays: 127
  });
  const [theme, setTheme] = useState<Theme>('standard');
  const [apiInterval, setApiInterval] = useState(300000);
  const [screenInterval, setScreenInterval] = useState(15000);
  const [pages, setPages] = useState<DisplayPage[]>([{ type: 'departures' }]);

  const [stationOptions, setStationOptions] = useState<string[]>([
    'Zürich HB',
    'Bern',
    'Basel SBB',
    'Genève',
    'Luzern',
    'Winterthur'
  ]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!device) return;
    setName(device.name || '');
    setStationName(device.stationName || 'Zürich HB');
    setTimezone(device.timezone || 'Europe/Zurich');
    setPower({
      isConfigured: device.isConfigured,
      scheduleEnabled: device.scheduleEnabled,
      scheduleOn: device.scheduleOn,
      scheduleOff: device.scheduleOff,
      scheduleDays: device.scheduleDays
    });
    setTheme(device.theme || 'standard');
    setApiInterval(device.apiInterval || 300000);
    setScreenInterval(device.screenInterval || 15000);
    setPages(device.display?.pages?.length ? device.display.pages : [{ type: 'departures' }]);
  }, [device]);

  const handleStationSearch = async (query: string) => {
    if (!query || query.length < 2) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/v1/transit/stations?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStationOptions(data.data.map((s: TransitStation) => s.name));
      }
    } catch {
      // fallback
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      await mutateUpdateDevice({
        name: name.trim() || undefined,
        stationName: stationName.trim() || undefined,
        timezone,
        ...power,
        theme,
        apiInterval: Number(apiInterval),
        screenInterval: Number(screenInterval),
        display: { pages: cleanPages(pages) }
      });

      setMessage({
        type: 'success',
        text: 'Settings updated successfully! ESP32 will sync on next poll.'
      });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || 'Failed to update device' });
    }
  };

  const handleUnpair = async () => {
    if (!confirm('Are you sure you want to unpair this display? It will return to pairing mode.')) {
      return;
    }

    try {
      await mutateUnpairDevice();
      router.push('/');
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || 'Failed to unpair device' });
    }
  };

  if (isLoadingDevice) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: 'var(--a1)' }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        component={Link}
        href="/"
        startIcon={<ArrowBackIcon />}
        sx={{ color: 'var(--fg-2)', mb: 3 }}
      >
        Back to Displays
      </Button>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--fg)' }}>
            {name || 'Configure Display'}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'var(--fg-3)', fontFamily: 'var(--font-jetbrains-mono)' }}
          >
            UUID: {uuid}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={handleUnpair}
          disabled={isMutatingUnpairDevice}
          sx={{ borderColor: 'var(--line-2)' }}
        >
          {isMutatingUnpairDevice ? 'Unpairing...' : 'Unpair Device'}
        </Button>
      </Box>

      {message && (
        <Alert
          severity={message.type}
          icon={message.type === 'success' ? <CheckCircleIcon /> : undefined}
          sx={{ mb: 4 }}
        >
          {message.text}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Settings Form */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={cardSx}>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 4, color: 'var(--fg)' }}>
                Display Settings
              </Typography>

              <form onSubmit={handleSave}>
                <Stack spacing={4} divider={<Divider sx={{ borderColor: 'var(--line)' }} />}>
                  <SettingsSection title="General">
                    <Stack spacing={3}>
                      <TextField
                        label="Display Name"
                        variant="outlined"
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        sx={fieldSx}
                      />

                      <Autocomplete
                        freeSolo
                        options={stationOptions}
                        loading={searchLoading}
                        value={stationName}
                        onChange={(_e, val) => setStationName(val || '')}
                        onInputChange={(_e, val) => handleStationSearch(val)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Departure Station"
                            variant="outlined"
                            fullWidth
                            helperText="Search Swiss railway / bus stations (e.g. Zürich HB, Bern, Basel)"
                            sx={fieldSx}
                          />
                        )}
                      />

                      <FormControl fullWidth>
                        <InputLabel sx={{ color: 'var(--fg-3)' }}>Display Font Theme</InputLabel>
                        <Select
                          value={theme}
                          label="Display Font Theme"
                          onChange={(e) => setTheme(e.target.value as Theme)}
                          sx={{
                            backgroundColor: 'var(--bg-2)',
                            color: 'var(--fg)',
                            '& fieldset': { borderColor: 'var(--line)' }
                          }}
                        >
                          {THEME_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TimezonePicker value={timezone} onChange={setTimezone} />

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Transit Fetch Interval (sec)"
                            type="number"
                            fullWidth
                            value={apiInterval / 1000}
                            onChange={(e) => setApiInterval(Number(e.target.value) * 1000)}
                            helperText="Recommended: 300 (5 minutes)"
                            sx={fieldSx}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Screen Refresh Interval (sec)"
                            type="number"
                            fullWidth
                            value={screenInterval / 1000}
                            onChange={(e) => setScreenInterval(Number(e.target.value) * 1000)}
                            helperText="Recommended: 15 (15 seconds)"
                            sx={fieldSx}
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </SettingsSection>

                  <SettingsSection title="Display power">
                    <DisplayPowerEditor
                      value={power}
                      onChange={(patch) => setPower((p) => ({ ...p, ...patch }))}
                    />
                  </SettingsSection>

                  <SettingsSection
                    title="Screens"
                    description="Pages rotate on the display. Long station and destination names are shortened to fit. Changes apply on the next sync, no restart needed."
                  >
                    <ScreenPagesEditor
                      pages={pages}
                      onChange={setPages}
                      defaultStation={stationName}
                    />
                  </SettingsSection>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isMutatingUpdateDevice}
                    startIcon={<SaveIcon />}
                    sx={{
                      backgroundColor: 'var(--a1)',
                      color: '#07090a',
                      fontWeight: 600,
                      py: 1.5,
                      '&:hover': { backgroundColor: '#5ae69e' }
                    }}
                  >
                    {isMutatingUpdateDevice ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Live OLED Preview & Hardware Telemetry */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {/* Virtual SSD1322 OLED */}
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'var(--a1)', mb: 2, fontWeight: 700, letterSpacing: '0.1em' }}
                >
                  LIVE PREVIEW · SSD1322 256x64
                </Typography>

                <ScreenPreview
                  uuid={uuid}
                  draft={{ pages: cleanPages(pages), stationName: stationName.trim(), theme }}
                  timeZone={timezone}
                  power={{
                    enabled: power.isConfigured,
                    schedule: power.scheduleEnabled
                      ? { on: power.scheduleOn, off: power.scheduleOff, days: power.scheduleDays }
                      : null
                  }}
                />
              </CardContent>
            </Card>

            {/* Hardware Information */}
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--fg)', mb: 2, fontWeight: 600 }}>
                  Device Status
                </Typography>

                <Stack divider={<Divider sx={{ borderColor: 'var(--line)' }} />}>
                  <StatusRow label="Status">
                    <span
                      style={{
                        color: device && isOnline(device, Date.now()) ? 'var(--a1)' : 'var(--fg-3)',
                        fontWeight: 600
                      }}
                    >
                      {!device
                        ? ''
                        : !device.isConfigured
                          ? 'Switched off'
                          : isOnline(device, Date.now())
                            ? 'Connected'
                            : 'Offline'}
                    </span>
                  </StatusRow>
                  <StatusRow label="Last seen">{formatDate(device?.lastSeenAt)}</StatusRow>
                  <StatusRow label="Last known IP">
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {device?.lastIp || 'N/A'}
                    </span>
                  </StatusRow>
                  <StatusRow label="Claimed at">{formatDate(device?.claimedAt)}</StatusRow>
                  <StatusRow label="Device token">
                    <span
                      style={{
                        color: 'var(--a1)',
                        fontSize: 11,
                        fontFamily: 'var(--font-jetbrains-mono)'
                      }}
                    >
                      Active
                    </span>
                  </StatusRow>
                </Stack>
              </CardContent>
            </Card>

            <TransferDeviceCard uuid={uuid} deviceName={device?.name ?? 'this display'} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
