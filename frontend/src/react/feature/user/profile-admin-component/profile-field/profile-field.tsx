'use client';

import { Box, Card, Chip, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useUser } from '@hooks/use-user';
import { CustomIconButton } from '@react-ui-kit/buttons/custom-icon-button';
import { ICONS } from '@react-ui-kit/icons/icon-paths';
import type { FetchUpdateUserBody } from '@helpers/api/fetch-update-user/fetch-update-user';
import { UserRole } from '@helpers/types';
import { CurrentPasswordDialog } from '../current-password-dialog';
import { CustomSnackbar } from '@react-ui-kit/custom-snackbar';
import { useSnackbar } from '@hooks/use-snackbar';
import { getErrorMessage, SUCCESS_MESSAGES } from '@helpers/error-messages';

export interface ProfileFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  editable?: boolean;
}

export function ProfileField({ label, value, fieldKey, editable = true }: ProfileFieldProps) {
  const { mutateUpdateUser, isMutatingUpdateUser, userData } = useUser();
  const { snackbar, showSuccess, showError, closeSnackbar } = useSnackbar();
  const [isEditing, setIsEditing] = useState(false);
  const [temporaryValue, setTemporaryValue] = useState(value);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isEditableField = ['socialUrl', 'avatarUrl'].includes(fieldKey);

  useEffect(() => {
    setTemporaryValue(value);
  }, [value]);

  useEffect(() => {
    if (userData?.role === UserRole.ADMIN) {
      setNeedsPassword(false);
    }
  }, [userData]);

  const handleEditClick = () => {
    if (!editable || !isEditableField) {
      return;
    }
    setIsEditing(true);
    setFieldError(null);
  };

  const validateInput = (): boolean => {
    if (fieldKey === 'socialUrl' && temporaryValue.trim()) {
      try {
        new URL(temporaryValue);
      } catch {
        setFieldError('Please enter a valid URL');
        return false;
      }
    }

    setFieldError(null);
    return true;
  };

  const handlePasswordConfirm = async (currentPassword: string) => {
    try {
      if (!validateInput()) {
        return;
      }

      const updateData: FetchUpdateUserBody = { currentPassword };

      if (fieldKey === 'socialUrl') {
        updateData.socialUrl = temporaryValue;
      } else if (fieldKey === 'avatarUrl') {
        updateData.avatarUrl = temporaryValue;
      }

      await mutateUpdateUser(updateData);
      setNeedsPassword(false);
      setIsEditing(false);
      setPasswordError(null);
      showSuccess(SUCCESS_MESSAGES.USER_UPDATED);
    } catch (error) {
      console.error(`Error updating ${fieldKey}:`, error);
      setPasswordError('Invalid password or update failed');
      showError(getErrorMessage(error));
    }
  };

  const handleChange = async () => {
    try {
      if (temporaryValue === value) {
        setIsEditing(false);
        return;
      }

      if (!validateInput()) {
        return;
      }

      const updateData: FetchUpdateUserBody = {};

      if (fieldKey === 'socialUrl') {
        updateData.socialUrl = temporaryValue;
      } else if (fieldKey === 'avatarUrl') {
        updateData.avatarUrl = temporaryValue;
      }

      await mutateUpdateUser(updateData);
      setIsEditing(false);
      showSuccess(SUCCESS_MESSAGES.USER_UPDATED);
    } catch (error) {
      console.error(`Error updating ${fieldKey}:`, error);
      setFieldError('Update failed. Please try again.');
      showError(getErrorMessage(error));
    }
  };

  const handleCancel = () => {
    setTemporaryValue(value);
    setIsEditing(false);
    setNeedsPassword(false);
    setPasswordError(null);
    setFieldError(null);
  };

  return (
    <Card sx={{ mb: 2, p: 2, backgroundColor: 'var(--bg-1)' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                color: 'var(--muted)'
              }}
            >
              {label}
            </Typography>
            {editable && isEditableField && !isEditing && (
              <CustomIconButton
                icon={ICONS.EDIT}
                width={16}
                height={16}
                tooltipText="Edit"
                tooltipPlacement="right"
                onClick={handleEditClick}
              />
            )}
          </Box>
          {isEditing ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1
              }}
            >
              <TextField
                size="small"
                value={temporaryValue}
                onChange={(e) => setTemporaryValue(e.target.value)}
                error={!!fieldError}
                helperText={fieldError}
                fullWidth
              />
              <Chip
                label="Save"
                color="primary"
                size="small"
                onClick={handleChange}
                disabled={isMutatingUpdateUser}
              />
              <Chip label="Cancel" color="default" size="small" onClick={handleCancel} />
            </Box>
          ) : (
            <Typography variant="body1" sx={{ mt: 0.5, fontFamily: 'var(--font-jetbrains-mono)' }}>
              {value}
            </Typography>
          )}
        </Box>
      </Box>
      {needsPassword && (
        <CurrentPasswordDialog
          onConfirm={handlePasswordConfirm}
          onCancel={handleCancel}
          isLoading={isMutatingUpdateUser}
          error={passwordError}
        />
      )}
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={closeSnackbar}
      />
    </Card>
  );
}
