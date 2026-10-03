'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography
} from '@mui/material';
import TrainIcon from '@mui/icons-material/DirectionsTransit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InsightsIcon from '@mui/icons-material/Insights';
import { useUser } from '@hooks/use-user';
import { UserRole } from '@helpers/types';

interface ClientHeaderProps {
  userName: string | null;
  isAuth: boolean;
}

export function ClientHeader({ userName, isAuth }: ClientHeaderProps) {
  // Only shows the link; the admin BFF routes enforce the role themselves.
  const { userData } = useUser();
  const isAdmin = isAuth && userData?.role === UserRole.ADMIN;
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await fetch('/api/v1/user', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: 'var(--bg-1)',
        borderBottom: '1px solid var(--line)',
        boxShadow: 'none'
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrainIcon sx={{ color: 'var(--a1)', fontSize: 32 }} />
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'var(--font-space-grotesk)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--fg)',
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                PUBLIC TRANSPORT SPY
              </Typography>
            </Link>
            <Chip
              label="ESP32 LIVE"
              size="small"
              sx={{
                backgroundColor: 'var(--a1-soft)',
                color: 'var(--a1)',
                border: '1px solid var(--a1)',
                fontFamily: 'var(--font-jetbrains-mono)',
                fontSize: 10,
                fontWeight: 600,
                display: { xs: 'none', md: 'inline-flex' }
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              component={Link}
              href="/"
              startIcon={<DashboardIcon />}
              sx={{
                color: 'var(--fg)',
                '&:hover': { color: 'var(--a1)' }
              }}
            >
              Devices
            </Button>
            {isAdmin && (
              <Button
                component={Link}
                href="/admin"
                startIcon={<InsightsIcon />}
                sx={{
                  color: 'var(--fg)',
                  '&:hover': { color: 'var(--a1)' }
                }}
              >
                Admin
              </Button>
            )}
            <Button
              component={Link}
              href="/pair"
              variant="outlined"
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
              Pair Device
            </Button>

            {isAuth ? (
              <Box>
                <IconButton onClick={handleMenu} sx={{ color: 'var(--fg)' }}>
                  <AccountCircleIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  sx={{
                    '& .MuiPaper-root': {
                      backgroundColor: 'var(--bg-2)',
                      border: '1px solid var(--line)',
                      color: 'var(--fg)'
                    }
                  }}
                >
                  <MenuItem disabled sx={{ color: 'var(--a1)' }}>
                    Signed in as {userName}
                  </MenuItem>
                  <MenuItem component={Link} href="/profile" onClick={handleClose}>
                    Profile
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>Logout</MenuItem>
                </Menu>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button component={Link} href="/login" sx={{ color: 'var(--fg)' }}>
                  Login
                </Button>
                <Button
                  component={Link}
                  href="/register"
                  variant="contained"
                  sx={{
                    backgroundColor: 'var(--a1)',
                    color: '#07090a',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#5ae69e'
                    }
                  }}
                >
                  Register
                </Button>
              </Box>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
