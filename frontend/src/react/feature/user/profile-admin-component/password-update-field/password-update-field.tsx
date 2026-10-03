'use client';

import { Button, Grid, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useUser } from '@hooks/use-user';
import type { UserModel } from '@helpers/types';
import { CustomSnackbar } from '@react-ui-kit/custom-snackbar';
import { useSnackbar } from '@hooks/use-snackbar';
import { getErrorMessage, SUCCESS_MESSAGES } from '@helpers/error-messages';

interface PasswordUpdateFieldsProps {
  userData: Partial<UserModel>;
}

export function PasswordUpdateField({ userData }: PasswordUpdateFieldsProps) {
  const { mutateUpdateUser, isMutatingUpdateUser } = useUser();
  const { snackbar, showSuccess, showError, closeSnackbar } = useSnackbar();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    if (!newPassword) {
      setError('New password is required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    try {
      await mutateUpdateUser({
        currentPassword: currentPassword,
        newPassword: newPassword
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess(SUCCESS_MESSAGES.PASSWORD_UPDATED);
    } catch (error_) {
      console.error('Error updating password:', error_);
      showError(getErrorMessage(error_));
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <TextField
          fullWidth
          label="Current Password"
          type="password"
          size="small"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </Grid>
      <Grid size={12}>
        <TextField
          fullWidth
          label="New Password"
          type="password"
          size="small"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          helperText="Password must be at least 6 characters"
        />
      </Grid>
      <Grid size={12}>
        <TextField
          fullWidth
          label="Confirm New Password"
          type="password"
          size="small"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </Grid>

      {error && (
        <Grid size={12}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Grid>
      )}

      <Grid size={12} sx={{ mt: 1 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={isMutatingUpdateUser}
          fullWidth
        >
          {isMutatingUpdateUser ? 'Updating...' : 'Update Password'}
        </Button>
      </Grid>
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={closeSnackbar}
      />
    </Grid>
  );
}
