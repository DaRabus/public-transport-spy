'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

export function RegistrationForm() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      sx={{
        backgroundColor: 'var(--bg-1)',
        border: '1px solid var(--line)',
        maxWidth: 440,
        margin: '0 auto'
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonAddIcon sx={{ color: 'var(--a1)' }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'var(--fg)' }}>
            Create Account
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--bg-2)',
                  color: 'var(--fg)',
                  '& fieldset': { borderColor: 'var(--line)' },
                  '&:hover fieldset': { borderColor: 'var(--a1)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--a1)' }
                },
                '& .MuiInputLabel-root': { color: 'var(--fg-3)' }
              }}
            />

            <TextField
              label="Password (min 6 characters)"
              type="password"
              variant="outlined"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--bg-2)',
                  color: 'var(--fg)',
                  '& fieldset': { borderColor: 'var(--line)' },
                  '&:hover fieldset': { borderColor: 'var(--a1)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--a1)' }
                },
                '& .MuiInputLabel-root': { color: 'var(--fg-3)' }
              }}
            />

            <TextField
              label="Confirm Password"
              type="password"
              variant="outlined"
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--bg-2)',
                  color: 'var(--fg)',
                  '& fieldset': { borderColor: 'var(--line)' },
                  '&:hover fieldset': { borderColor: 'var(--a1)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--a1)' }
                },
                '& .MuiInputLabel-root': { color: 'var(--fg-3)' }
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                backgroundColor: 'var(--a1)',
                color: '#07090a',
                fontWeight: 600,
                py: 1.5,
                '&:hover': { backgroundColor: '#5ae69e' }
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#07090a' }} /> : 'Register'}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
