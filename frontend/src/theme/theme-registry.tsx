'use client';

import { type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from './theme';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

export enum LocalTheme {
  Dark = 'dark'
}

export function ThemeRegistry({ children }: { children: ReactNode }) {
  const theme = createAppTheme(LocalTheme.Dark);

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true, key: 'mui' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
