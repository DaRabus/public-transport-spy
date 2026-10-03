'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { fetchDeleteAccount } from '@helpers/api/fetch-delete-account/fetch-delete-account';

/** Danger zone: deletes the account. Displays are released (reset) so anyone can pair them again. */
export function DeleteAccountCard() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await fetchDeleteAccount(password);
      await mutate(() => true, undefined, { revalidate: false }); // drop all cached user/device data
      router.push('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card sx={{ width: '100%', backgroundColor: 'var(--bg-2)', border: '1px solid #ff6b6b' }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff6b6b' }} gutterBottom>
          Delete account
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--fg-2)', mb: 2 }}>
          This permanently deletes your account. Your displays are released and reset (name, screens
          and schedule are cleared) and show a new pairing code, so you or anyone else can pair them
          again. Pending pairing requests are cancelled. To keep a display in use, transfer it to
          another account first.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            type="password"
            label="Current password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label='Type "DELETE" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <Button
            variant="outlined"
            disabled={busy || !password || confirmText !== 'DELETE'}
            onClick={handleDelete}
            sx={{
              borderColor: '#ff6b6b',
              color: '#ff6b6b',
              '&:hover': { borderColor: '#ff6b6b', color: '#ff6b6b' }
            }}
          >
            {busy ? 'Deleting...' : 'Delete my account'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
