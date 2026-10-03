import { Grid, Typography } from '@mui/material';
import { LoginForm } from '@react-feature/user/login-form';
import Link from 'next/link';
import { Suspense } from 'react';

export default async function Login() {
  return (
    <Grid
      container
      spacing={2}
      sx={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 6
      }}
    >
      <Grid
        size={{ xs: 12, md: 6 }}
        sx={{
          my: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Typography variant="h1">Login</Typography>
        <Typography variant="body1">
          Login to your account to access your profile and devices. If you don&#39;t have an
          account, you can register for one.
        </Typography>
      </Grid>
      <Suspense fallback={<></>}>
        <Grid size={{ xs: 12, md: 6 }}>
          <LoginForm />
        </Grid>
      </Suspense>
      <Grid
        size={{ xs: 12, md: 6 }}
        sx={{
          my: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Link href="/register">Don&apos;t have an account? Register here.</Link>
      </Grid>
    </Grid>
  );
}
