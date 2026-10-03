'use client';

import { useState } from 'react';

import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import WifiIcon from '@mui/icons-material/Wifi';
import TrainIcon from '@mui/icons-material/DirectionsTransit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { formatDate } from '@helpers/utils';
import { formatPairingCode } from '@helpers/pairing-code';
import { useUser } from '@hooks/use-user';
import { useDevices } from '@hooks/use-devices';
import { fetchCancelPendingPairing } from '@helpers/api/fetch-cancel-pending-pairing/fetch-cancel-pending-pairing';
import { ScreenPreview } from '@react-feature/device/screen-preview';
import { isOnline } from '@react-feature/admin/device-metrics/admin-metrics-logic';

export default function DashboardPage() {
  const { userData, isUserDataLoading } = useUser();
  const { devices, isLoadingDevices, mutateDevicesList } = useDevices();
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelPending = async (id: string, code: string | null) => {
    if (
      !confirm(`Cancel the pairing request${code ? ` for code ${formatPairingCode(code)}` : ''}?`)
    )
      return;
    setCancelError(null);
    try {
      await fetchCancelPendingPairing(id);
      await mutateDevicesList();
    } catch (err) {
      setCancelError((err as Error).message);
    }
  };
  const loading = isUserDataLoading || (!!userData && isLoadingDevices);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress sx={{ color: 'var(--a1)' }} />
      </Box>
    );
  }

  if (!userData) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Box
          sx={{
            display: 'inline-flex',
            p: 2,
            borderRadius: '50%',
            backgroundColor: 'var(--a1-soft)',
            mb: 3
          }}
        >
          <TrainIcon sx={{ fontSize: 56, color: 'var(--a1)' }} />
        </Box>
        <Typography variant="h2" sx={{ fontWeight: 700, mb: 2, color: 'var(--fg)' }}>
          Public Transport Spy
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'var(--fg-2)', maxWidth: 600, mx: 'auto', mb: 5, fontSize: 16 }}
        >
          Live Swiss Public Transport Departure Board controller for ESP32 and SSD1322 OLED
          displays. Pair your displays, select your stations, and customize themes.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'center' }}
        >
          <Button component={Link} href="/login" variant="contained" size="large">
            Log In
          </Button>
          <Button component={Link} href="/register" variant="outlined" size="large">
            Create Account
          </Button>
          <Button
            component={Link}
            href="/pair"
            variant="outlined"
            size="large"
            sx={{
              borderColor: 'var(--a2)',
              color: 'var(--a2)',
              px: 4,
              py: 1.5,
              '&:hover': { borderColor: 'var(--a2)', backgroundColor: 'var(--a2-soft)' }
            }}
          >
            Pair with Code
          </Button>
        </Stack>

        <Box sx={{ mt: 8, textAlign: 'left' }}>
          <Typography
            variant="overline"
            sx={{ color: 'var(--fg-3)', display: 'block', textAlign: 'center', mb: 3 }}
          >
            How pairing works
          </Typography>
          <Grid container spacing={3}>
            {[
              {
                icon: <PersonAddIcon sx={{ fontSize: 28, color: 'var(--a1)' }} />,
                title: '1. Create an account',
                body: 'Sign up, then open "Pair with Code" whenever you add a new display.'
              },
              {
                icon: <PowerSettingsNewIcon sx={{ fontSize: 28, color: 'var(--a1)' }} />,
                title: '2. Power on the display',
                body: 'Connect it to your Wi-Fi when prompted. It then makes up its own 6-character code locally and shows it with a QR code — before it ever talks to our servers.'
              },
              {
                icon: <QrCodeScannerIcon sx={{ fontSize: 28, color: 'var(--a1)' }} />,
                title: '3. Enter the code here',
                body: 'Type the code (or scan the QR) to link the display to your account. It confirms itself automatically and starts showing live departures within seconds.'
              }
            ].map((step) => (
              <Grid key={step.title} size={{ xs: 12, sm: 4 }}>
                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 1.5,
                      border: '1px solid var(--line)',
                      backgroundColor: 'var(--bg-1)',
                      width: 'fit-content'
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography variant="subtitle1" sx={{ color: 'var(--fg)', fontWeight: 600 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--fg-3)' }}>
                    {step.body}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--fg)' }}>
            Your Displays
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--fg-3)' }}>
            Signed in as {userData.userName} • {devices.length} registered{' '}
            {devices.length === 1 ? 'device' : 'devices'}
          </Typography>
        </Box>

        <Button
          component={Link}
          href="/pair"
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
        >
          Pair New Display
        </Button>
      </Box>

      {devices.length === 0 ? (
        <Card
          sx={{
            backgroundColor: 'var(--bg-1)',
            border: '1px dashed var(--line-2)',
            p: 6,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" sx={{ color: 'var(--fg)', mb: 1 }}>
            No displays paired yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--fg-3)', mb: 3 }}>
            Turn on your ESP32 board, connect to its setup WiFi, and scan the QR code on the screen.
          </Typography>
          <Button component={Link} href="/pair" variant="contained">
            Enter Pairing Code
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {devices.map((device) => {
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={device.id}>
                <Card>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 2
                      }}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--fg)' }}>
                          {device.name || 'ESP32 Board'}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'var(--fg-3)',
                            fontFamily: 'var(--font-jetbrains-mono)'
                          }}
                        >
                          {device.deviceUuid
                            ? `${device.deviceUuid.substring(0, 16)}...`
                            : 'Awaiting device...'}
                        </Typography>
                      </Box>
                      <Chip
                        icon={<WifiIcon style={{ fontSize: 14 }} />}
                        label={
                          !device.deviceUuid
                            ? 'Pending'
                            : !device.isConfigured
                              ? 'Switched off'
                              : isOnline(device, Date.now())
                                ? 'Online'
                                : 'Offline'
                        }
                        size="small"
                        sx={{
                          backgroundColor: isOnline(device, Date.now())
                            ? 'var(--a1-soft)'
                            : 'var(--bg-2)',
                          color: isOnline(device, Date.now()) ? 'var(--a1)' : 'var(--fg-3)',
                          border: `1px solid ${isOnline(device, Date.now()) ? 'var(--a1)' : 'var(--line)'}`,
                          fontSize: 11
                        }}
                      />
                    </Box>

                    {/* The real composed screens (stored settings), drawn like the device does */}
                    <Box sx={{ mb: 2.5 }}>
                      {device.deviceUuid ? (
                        <ScreenPreview
                          compact
                          uuid={device.deviceUuid}
                          timeZone={device.timezone}
                          power={{
                            enabled: device.isConfigured,
                            schedule: device.scheduleEnabled
                              ? {
                                  on: device.scheduleOn,
                                  off: device.scheduleOff,
                                  days: device.scheduleDays
                                }
                              : null
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            border: '2px dashed var(--line-2)',
                            p: 2,
                            textAlign: 'center'
                          }}
                        >
                          <Typography sx={{ fontSize: 12, color: 'var(--fg-3)' }}>
                            Waiting for the display to confirm code{' '}
                            {device.pairingCode ? formatPairingCode(device.pairingCode) : ''}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Stack spacing={1}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: 'var(--fg-2)'
                        }}
                      >
                        <span>Theme:</span>
                        <Chip
                          label={device.theme}
                          size="small"
                          sx={{ height: 20, fontSize: 10, textTransform: 'uppercase' }}
                        />
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: 'var(--fg-2)'
                        }}
                      >
                        <span>Refresh Interval:</span>
                        <span>{device.apiInterval / 1000}s</span>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: 'var(--fg-3)'
                        }}
                      >
                        <span>Last Seen:</span>
                        <span>{formatDate(device.lastSeenAt)}</span>
                      </Box>
                    </Stack>
                  </CardContent>

                  <Divider sx={{ borderColor: 'var(--line)' }} />

                  <CardActions sx={{ p: 2, justifyContent: 'flex-end' }}>
                    {device.deviceUuid ? (
                      <Button
                        component={Link}
                        href={`/devices/${device.deviceUuid}`}
                        startIcon={<SettingsIcon />}
                        size="small"
                        sx={{
                          color: 'var(--a1)',
                          '&:hover': { backgroundColor: 'var(--a1-soft)' }
                        }}
                      >
                        Configure
                      </Button>
                    ) : (
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                        <Typography
                          variant="caption"
                          sx={{ color: cancelError ? 'var(--a2)' : 'var(--fg-3)' }}
                        >
                          {cancelError ?? 'Waiting for device to connect...'}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => cancelPending(device.id, device.pairingCode)}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}
