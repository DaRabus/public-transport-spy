'use client';

import { Box, Button, TextField, Typography } from '@mui/material';
import { useState } from 'react';

interface CurrentPasswordDialogProps {
  onConfirm: (password: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string | null;
}

export function CurrentPasswordDialog({
  onConfirm,
  onCancel,
  isLoading,
  error
}: CurrentPasswordDialogProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!password) return;
    onConfirm(password);
  };

  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        border: '1px solid',
        borderColor: 'var(--line)',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        backgroundColor: 'var(--bg-1)'
      }}
    >
      <Typography variant="body2">
        Please enter your current password to confirm this change:
      </Typography>
      <TextField
        fullWidth
        label="Current Password"
        type="password"
        size="small"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        error={!!error}
        helperText={error}
      />
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}
      >
        <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading || !password}>
          {isLoading ? 'Confirming...' : 'Confirm'}
        </Button>
      </Box>
    </Box>
  );
}
