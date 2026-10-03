import { Avatar, Box, Card, CardContent, Chip, Divider, Grid, Typography } from '@mui/material';
import type { UserModel } from '@helpers/types';
import { UserRole } from '@helpers/types';
import { CustomIconButton } from '@react-ui-kit/buttons/custom-icon-button';
import { ICONS } from '@react-ui-kit/icons/icon-paths';

export interface UserProfileCardProps {
  userData: Partial<UserModel>;
  isPublic?: boolean;
}

export interface UserProfileHeaderProps extends UserProfileCardProps {
  onEditAvatar?: () => void;
}

export function UserProfileHeader({
  userData,
  isPublic = false,
  onEditAvatar
}: UserProfileHeaderProps) {
  const isAdmin = userData.role === UserRole.ADMIN;

  return (
    <Card
      sx={{
        width: '100%',
        p: 3,
        borderColor: 'var(--line)',
        borderWidth: 1,
        borderStyle: 'solid',
        backgroundColor: 'var(--bg-2)'
      }}
    >
      <CardContent>
        <Grid container spacing={2}>
          <Grid
            size={12}
            sx={{
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Box
              sx={{
                position: 'relative'
              }}
            >
              <Avatar
                src={userData.avatarUrl ?? '/avatar-default.svg'}
                alt="Profile Image"
                sx={{ width: 120, height: 120, mb: 2, border: '2px solid var(--a1)' }}
              />
              {!isPublic && onEditAvatar && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    right: -10,
                    bgcolor: 'background.paper',
                    borderRadius: '50%',
                    p: 0.5
                  }}
                >
                  <CustomIconButton
                    icon={ICONS.EDIT}
                    width={20}
                    height={20}
                    tooltipText="Change Avatar"
                    tooltipPlacement="right"
                    onClick={onEditAvatar}
                  />
                </Box>
              )}
            </Box>
          </Grid>

          <Grid
            size={12}
            sx={{
              textAlign: 'center'
            }}
          >
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
              {isPublic ? userData.userName : `Welcome, ${userData.userName}`}
            </Typography>
            <Chip
              label={userData.role ?? 'USER'}
              color={isAdmin ? 'primary' : 'default'}
              size="small"
              sx={{ mt: 1, fontFamily: 'var(--font-jetbrains-mono)' }}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function UserInformationCard({ userData }: UserProfileCardProps) {
  return (
    <Card sx={{ width: '100%', backgroundColor: 'var(--bg-2)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          User Information
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid size={12}>
            <Card sx={{ mb: 2, p: 2, backgroundColor: 'var(--bg-1)' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'var(--muted)' }}>
                  Username
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {userData.userName}
                </Typography>
              </Box>
            </Card>
          </Grid>

          {userData.socialUrl && (
            <Grid size={12}>
              <Card sx={{ mb: 2, p: 2, backgroundColor: 'var(--bg-1)' }}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 'bold', color: 'var(--muted)' }}
                  >
                    Social URL
                  </Typography>
                  <Typography variant="body1">
                    <a
                      href={userData.socialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--a1)' }}
                    >
                      {userData.socialUrl}
                    </a>
                  </Typography>
                </Box>
              </Card>
            </Grid>
          )}

          {userData.id && (
            <Grid size={12}>
              <Card sx={{ mb: 2, p: 2, backgroundColor: 'var(--bg-1)' }}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 'bold', color: 'var(--muted)' }}
                  >
                    User ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {userData.id}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          )}

          {userData.createdAt && (
            <Grid size={12}>
              <Card sx={{ mb: 2, p: 2, backgroundColor: 'var(--bg-1)' }}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 'bold', color: 'var(--muted)' }}
                  >
                    Created At
                  </Typography>
                  <Typography variant="body2">
                    {typeof userData.createdAt === 'string'
                      ? new Date(userData.createdAt).toLocaleString()
                      : userData.createdAt instanceof Date
                        ? userData.createdAt.toLocaleString()
                        : 'N/A'}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          )}

          {userData.updatedAt && (
            <Grid size={12}>
              <Card sx={{ mb: 2, p: 2, backgroundColor: 'var(--bg-1)' }}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 'bold', color: 'var(--muted)' }}
                  >
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {typeof userData.updatedAt === 'string'
                      ? new Date(userData.updatedAt).toLocaleString()
                      : userData.updatedAt instanceof Date
                        ? userData.updatedAt.toLocaleString()
                        : 'N/A'}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}

export function UserStatusCard({ userData }: UserProfileCardProps) {
  return (
    <Card
      sx={{
        width: '100%',
        borderColor: 'var(--line)',
        borderWidth: 1,
        borderStyle: 'solid',
        backgroundColor: 'var(--bg-2)'
      }}
    >
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Account Status
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'var(--muted)' }}>
              Role
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
              {userData.role}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
