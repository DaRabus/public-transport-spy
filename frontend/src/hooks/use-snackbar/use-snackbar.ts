'use client';

import { useCallback, useState } from 'react';

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export function useSnackbar() {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success'
  });

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      setSnackbar({
        open: true,
        message,
        severity
      });
    },
    []
  );

  const showSuccess = useCallback(
    (message: string) => {
      showSnackbar(message, 'success');
    },
    [showSnackbar]
  );

  const showError = useCallback(
    (message: string) => {
      showSnackbar(message, 'error');
    },
    [showSnackbar]
  );

  const showWarning = useCallback(
    (message: string) => {
      showSnackbar(message, 'warning');
    },
    [showSnackbar]
  );

  const showInfo = useCallback(
    (message: string) => {
      showSnackbar(message, 'info');
    },
    [showSnackbar]
  );

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    snackbar,
    showSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    closeSnackbar
  };
}
