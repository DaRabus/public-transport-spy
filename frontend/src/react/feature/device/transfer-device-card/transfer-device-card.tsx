'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { fetchTransferDevice } from '@helpers/api/fetch-transfer-device/fetch-transfer-device';

/** Hands the display to another account by its (unique) username. It keeps running without re-pairing. */
export function TransferDeviceCard({ uuid, deviceName }: { uuid: string; deviceName: string }) {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleTransfer = async () => {
    const target = userName.trim();
    if (!confirm(`Transfer "${deviceName}" to ${target}? You will lose access to it.`)) return;
    setError(null);
    setBusy(true);
    try {
      await fetchTransferDevice(uuid, target);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card sx={{ backgroundColor: 'var(--bg-1)', border: '1px solid var(--line)' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={{ color: 'var(--fg)', mb: 1, fontWeight: 600 }}>
          Transfer to another account
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--fg-3)', mb: 2 }}>
          The display keeps its settings and keeps running; only the owner changes.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            label="Username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Button variant="outlined" disabled={busy || !userName.trim()} onClick={handleTransfer}>
            {busy ? 'Transferring...' : 'Transfer'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
