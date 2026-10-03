import { Box, Container, Typography } from '@mui/material';
import Link from 'next/link';
import { RegistrationForm } from '@react-feature/user/registration-form';

export default function RegisterPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'var(--fg)' }}>
          Create an Account
        </Typography>
        <Typography variant="body1" sx={{ color: 'var(--fg-2)' }}>
          Link and control your physical ESP32 OLED displays
        </Typography>
      </Box>

      <RegistrationForm />

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Typography variant="body2" sx={{ color: 'var(--fg-3)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--a1)', textDecoration: 'underline' }}>
            Log in here
          </Link>
        </Typography>
      </Box>
    </Container>
  );
}
