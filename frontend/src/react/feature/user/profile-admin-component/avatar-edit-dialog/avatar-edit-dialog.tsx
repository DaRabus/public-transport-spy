'use client';

import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import { useState } from 'react';
import { useUser } from '@hooks/use-user';
import type { UserModel } from '@helpers/types';
import { UserRole } from '@helpers/types';
import type { FetchUpdateUserBody } from '@helpers/api/fetch-update-user/fetch-update-user';

interface AvatarEditDialogProps {
  open: boolean;
  onClose: () => void;
  userData: Partial<UserModel>;
}

const PRESET_AVATARS = [
  '/avatar-default.svg',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150'
];

export function AvatarEditDialog({ open, onClose, userData }: AvatarEditDialogProps) {
  const { mutateUpdateUser, isMutatingUpdateUser } = useUser();
  const [avatarUrl, setAvatarUrl] = useState(userData.avatarUrl ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isAdmin = userData.role === UserRole.ADMIN;

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!avatarUrl) {
      setError('Please provide an avatar image URL');
      return;
    }

    try {
      const updateData: FetchUpdateUserBody = { avatarUrl };

      if (!isAdmin && currentPassword) {
        updateData.currentPassword = currentPassword;
      }

      await mutateUpdateUser(updateData);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error_) {
      console.error('Error updating avatar URL:', error_);
      setError('Failed to update avatar. Please try again.');
    }
  };

  const handleCancel = () => {
    setAvatarUrl(userData.avatarUrl ?? '');
    setCurrentPassword('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'var(--bg-2)',
            border: '1px solid var(--line)',
            color: 'var(--fg)'
          }
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Update Avatar</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar
              src={avatarUrl || '/avatar-default.svg'}
              alt="Avatar Preview"
              sx={{ width: 80, height: 80, border: '2px solid var(--a1)' }}
            />
          </Box>

          <Typography variant="body2" sx={{ mb: 2, color: 'var(--muted)' }}>
            Enter an image URL or pick one of the presets below:
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
            {PRESET_AVATARS.map((preset, idx) => (
              <Avatar
                key={idx}
                src={preset}
                sx={{
                  width: 44,
                  height: 44,
                  cursor: 'pointer',
                  border: avatarUrl === preset ? '2px solid var(--a1)' : '2px solid transparent',
                  '&:hover': { transform: 'scale(1.05)' }
                }}
                onClick={() => setAvatarUrl(preset)}
              />
            ))}
          </Box>

          <TextField
            fullWidth
            label="Avatar Image URL"
            size="small"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            sx={{ mb: 2 }}
          />

          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}

          {success && (
            <Typography variant="body2" sx={{ color: 'var(--a1)', mt: 1, fontWeight: 600 }}>
              Avatar updated successfully!
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} sx={{ color: 'var(--muted)' }}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isMutatingUpdateUser || !avatarUrl}
          loading={isMutatingUpdateUser}
        >
          Update Avatar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
