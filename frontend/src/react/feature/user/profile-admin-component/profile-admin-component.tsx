'use client';

import { Alert, Box, Button, Card, CardContent, Divider, Grid, Typography } from '@mui/material';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useUser } from '@hooks/use-user';
import { CustomIconButton } from '@react-ui-kit/buttons/custom-icon-button';
import { ICONS } from '@react-ui-kit/icons/icon-paths';
import { PasswordUpdateField } from './password-update-field';
import { AvatarEditDialog } from './avatar-edit-dialog';
import { UserProfileHeader, UserStatusCard } from '@react-feature/user/profile-display-components';
import { ProfileField } from './profile-field';
import type { DeviceModel } from '@helpers/types';
import DevicesIcon from '@mui/icons-material/Devices';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';

const devicesFetcher = (url: string) => fetch(url).then((r) => r.json());

export function ProfileAdminComponent() {
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const { userData, isUserDataLoading } = useUser();

  const { data: devicesData } = useSWR<{ success: boolean; data: DeviceModel[] }>(
    '/api/v1/devices',
    devicesFetcher
  );

  if (isUserDataLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1">Loading profile...</Typography>
      </Box>
    );
  }

  if (!userData || !userData.isLoggedIn) {
    return (
      <Alert severity="warning" sx={{ width: '100%', my: 4 }}>
        You must be logged in to view your profile.{' '}
        <Link href="/login" style={{ color: 'var(--a1)', fontWeight: 600 }}>
          Login here
        </Link>
      </Alert>
    );
  }

  const devices = devicesData?.data ?? [];

  return (
    <Grid container spacing={3} sx={{ width: '100%', maxWidth: 900, mx: 'auto' }}>
      {/* Header section with avatar */}
      <UserProfileHeader
        userData={userData}
        isPublic={false}
        onEditAvatar={() => setShowAvatarDialog(true)}
      />

      {/* Avatar Edit Dialog */}
      <AvatarEditDialog
        open={showAvatarDialog}
        onClose={() => setShowAvatarDialog(false)}
        userData={userData}
      />

      {/* User Information Section - Editable */}
      <Card sx={{ width: '100%', backgroundColor: 'var(--bg-2)' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            User Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <ProfileField
            label="Username"
            value={userData.userName}
            fieldKey="userName"
            editable={false}
          />
          <ProfileField
            label="Social URL"
            value={userData.socialUrl ?? 'Not set'}
            fieldKey="socialUrl"
            editable
          />
          {userData.id && (
            <ProfileField label="User ID" value={userData.id} fieldKey="id" editable={false} />
          )}
          {userData.createdAt && (
            <ProfileField
              label="Created At"
              value={
                typeof userData.createdAt === 'string'
                  ? new Date(userData.createdAt).toLocaleString()
                  : 'N/A'
              }
              fieldKey="createdAt"
              editable={false}
            />
          )}
          {userData.updatedAt && (
            <ProfileField
              label="Updated At"
              value={
                typeof userData.updatedAt === 'string'
                  ? new Date(userData.updatedAt).toLocaleString()
                  : 'N/A'
              }
              fieldKey="updatedAt"
              editable={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card sx={{ width: '100%', backgroundColor: 'var(--bg-2)' }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Password Management
            </Typography>
            <CustomIconButton
              icon={ICONS.EDIT}
              width={20}
              height={20}
              tooltipText="Change Password"
              tooltipPlacement="left"
              onClick={() => setShowPasswordFields(!showPasswordFields)}
            />
          </Box>
          <Divider sx={{ my: 2 }} />

          {showPasswordFields ? (
            <Box
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'var(--line)',
                borderRadius: 1,
                backgroundColor: 'var(--bg-1)'
              }}
            >
              <PasswordUpdateField userData={userData} />
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
              Click the edit button to change your password
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Account Status Section */}
      <UserStatusCard userData={userData} />

      <Divider sx={{ width: '100%' }} />

      {/* Claimed Displays / Devices Section */}
      <Grid
        size={12}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DevicesIcon sx={{ color: 'var(--a1)' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Your Paired Displays ({devices.length})
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/pair"
          variant="outlined"
          size="small"
          startIcon={<AddCircleOutlineIcon />}
          sx={{
            borderColor: 'var(--a1)',
            color: 'var(--a1)',
            '&:hover': {
              borderColor: 'var(--a1)',
              backgroundColor: 'var(--a1-soft)'
            }
          }}
        >
          Pair New Device
        </Button>
      </Grid>

      {devices.length > 0 ? (
        <Grid container spacing={2} sx={{ width: '100%' }}>
          {devices.map((device) => (
            <Grid key={device.id} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ p: 2, backgroundColor: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {device.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--muted)', mb: 1 }}>
                  Station: <span style={{ color: 'var(--a1)' }}>{device.stationName}</span>
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'var(--font-jetbrains-mono)', display: 'block', mb: 2 }}
                >
                  UUID: {device.deviceUuid ?? 'Awaiting device...'}
                </Typography>
                <Button
                  component={Link}
                  href={`/devices/${device.deviceUuid}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={!device.deviceUuid}
                >
                  Configure Settings
                </Button>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid size={12}>
          <Alert severity="info" sx={{ width: '100%' }}>
            No displays paired yet. Turn on your ESP32 display and click &quot;Pair New Device&quot;
            to link it!
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}
