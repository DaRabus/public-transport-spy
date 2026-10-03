'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { TransitStation } from '@helpers/types';
import {
  formatPairingCode,
  normalizePairingCode,
  PAIRING_CODE_LENGTH
} from '@helpers/pairing-code';
import { useDevices } from '@hooks/use-devices';

// Matches the backend's pending-claim TTL: after this the code is dead and the user must retry.
const PAIRING_WAIT_MS = 15 * 60 * 1000;

function PairFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const { devices, mutatePairDevice, isMutatingPairDevice } = useDevices({
    refreshInterval: pendingDeviceId ? 3000 : 0
  });
  const confirmed =
    !!pendingDeviceId && !!devices.find((d) => d.id === pendingDeviceId)?.deviceUuid;

  const [pairingCode, setPairingCode] = useState(formatPairingCode(initialCode));
  const [name, setName] = useState('');
  const [stationName, setStationName] = useState('Zürich HB');
  const [stationOptions, setStationOptions] = useState<string[]>([
    'Zürich HB',
    'Bern',
    'Basel SBB',
    'Genève',
    'Luzern',
    'Winterthur'
  ]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const showSuccess = success || confirmed;

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 1500);
    return () => clearTimeout(timer);
  }, [showSuccess, router]);

  useEffect(() => {
    if (!pendingDeviceId || confirmed) return;
    const timer = setTimeout(() => {
      setPendingDeviceId(null);
      setError(
        'Your display did not confirm in time. Make sure it is online and still shows this code, then try again. If it says "Registered to another account", its current owner has to release or transfer it first.'
      );
    }, PAIRING_WAIT_MS);
    return () => clearTimeout(timer);
  }, [pendingDeviceId, confirmed]);

  useEffect(() => {
    if (initialCode) {
      setPairingCode(formatPairingCode(initialCode));
    }
  }, [initialCode]);

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
      // fallback to current options
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await mutatePairDevice({
        pairingCode: normalizePairingCode(pairingCode),
        name: name.trim() || undefined,
        stationName: stationName.trim() || undefined
      });

      if (res?.data && !res.data.deviceUuid) {
        // Code accepted, but the display hasn't confirmed it yet: keep polling until it does.
        setPendingDeviceId(res.data.id);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || 'Failed to pair device. Please check the code.');
    }
  };

  return (
    <Card
      sx={{
        backgroundColor: 'var(--bg-1)',
        border: '1px solid var(--line)',
        maxWidth: 500,
        margin: '0 auto'
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <QrCodeScannerIcon sx={{ color: 'var(--a1)', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'var(--fg)' }}>
              Pair New ESP32 Display
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--fg-3)' }}>
              Enter the 6-character code shown on your OLED display
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {pendingDeviceId && !confirmed && (
          <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 3 }}>
            Code accepted. Waiting for your display to confirm. Keep it powered on and connected to
            Wi-Fi…
          </Alert>
        )}

        {showSuccess && (
          <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mb: 3 }}>
            Device successfully paired! Redirecting to dashboard...
          </Alert>
        )}

        <form onSubmit={handlePair}>
          <Stack spacing={3}>
            <TextField
              label="6-Character Pairing Code"
              variant="outlined"
              fullWidth
              required
              placeholder="e.g. KV7-9P2"
              value={pairingCode}
              onChange={(e) => setPairingCode(formatPairingCode(e.target.value))}
              helperText="Shown on screen next to the QR code"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--bg-2)',
                  color: 'var(--a1)',
                  fontFamily: 'var(--font-jetbrains-mono)',
                  fontSize: 20,
                  letterSpacing: '0.15em',
                  fontWeight: 700,
                  '& fieldset': { borderColor: 'var(--line)' },
                  '&:hover fieldset': { borderColor: 'var(--a1)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--a1)' }
                },
                '& .MuiInputLabel-root': { color: 'var(--fg-3)' },
                '& .MuiFormHelperText-root': { color: 'var(--fg-3)' }
              }}
            />

            <TextField
              label="Display Name (optional)"
              variant="outlined"
              fullWidth
              placeholder="e.g. Living Room, Office Desk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--bg-2)',
                  color: 'var(--fg)',
                  '& fieldset': { borderColor: 'var(--line)' },
                  '&:hover fieldset': { borderColor: 'var(--a1)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--a1)' }
                },
                '& .MuiInputLabel-root': { color: 'var(--fg-3)' }
              }}
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
                  label="Initial Station (Departures)"
                  variant="outlined"
                  fullWidth
                  helperText="Type to search Swiss train/bus stations"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'var(--bg-2)',
                      color: 'var(--fg)',
                      '& fieldset': { borderColor: 'var(--line)' },
                      '&:hover fieldset': { borderColor: 'var(--a1)' },
                      '&.Mui-focused fieldset': { borderColor: 'var(--a1)' }
                    },
                    '& .MuiInputLabel-root': { color: 'var(--fg-3)' },
                    '& .MuiFormHelperText-root': { color: 'var(--fg-3)' }
                  }}
                />
              )}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={
                isMutatingPairDevice ||
                showSuccess ||
                !!pendingDeviceId ||
                normalizePairingCode(pairingCode).length !== PAIRING_CODE_LENGTH
              }
              sx={{
                backgroundColor: 'var(--a1)',
                color: '#07090a',
                fontWeight: 600,
                py: 1.5,
                '&:hover': { backgroundColor: '#5ae69e' }
              }}
            >
              {isMutatingPairDevice ? (
                <CircularProgress size={24} sx={{ color: '#07090a' }} />
              ) : (
                'Confirm & Claim Device'
              )}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PairPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Suspense
        fallback={
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        }
      >
        <PairFormContent />
      </Suspense>
    </Container>
  );
}
