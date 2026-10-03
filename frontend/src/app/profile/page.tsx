import { Grid, Typography } from '@mui/material';
import { ProfileAdminComponent } from '@react-feature/user/profile-admin-component';
import { DeleteAccountCard } from '@react-feature/user/delete-account-card';

export default async function ProfilePage() {
  return (
    <Grid
      container
      spacing={3}
      sx={{
        display: 'grid',
        justifyItems: 'center',
        alignItems: 'center',
        py: 4
      }}
    >
      <Grid
        size={{ xs: 12, sm: 8, lg: 6 }}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
          gap: 1,
          mb: 2
        }}
      >
        <Typography variant="h1">Your Profile</Typography>
        <Typography variant="body1" sx={{ color: 'var(--muted)' }}>
          View and manage your profile information and account settings
        </Typography>
      </Grid>
      <Grid size={12}>
        <ProfileAdminComponent />
      </Grid>
      <Grid size={{ xs: 12, sm: 8, lg: 6 }}>
        <DeleteAccountCard />
      </Grid>
    </Grid>
  );
}
