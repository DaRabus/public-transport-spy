import type { ThemeOptions } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';

import { Colors } from './colors';
import type { LocalTheme } from '@theme/theme-registry';

const DISPLAY_STACK = [
  'var(--font-space-grotesk)',
  'Space Grotesk',
  'ui-sans-serif',
  'system-ui',
  'sans-serif'
].join(', ');

const MONO_STACK = [
  'var(--font-jetbrains-mono)',
  'JetBrains Mono',
  'Geist Mono',
  'ui-monospace',
  'monospace'
].join(', ');

const commonTheme: ThemeOptions = {
  shape: {
    borderRadius: 0
  },
  typography: {
    fontFamily: MONO_STACK,
    h1: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 600,
      fontSize: 'clamp(40px, 6vw, 80px)',
      lineHeight: 1,
      letterSpacing: '-0.03em'
    },
    h2: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 600,
      fontSize: 'clamp(28px, 3.4vw, 44px)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em'
    },
    h3: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 500,
      fontSize: '22px',
      lineHeight: 1.15,
      letterSpacing: '-0.01em'
    },
    h4: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 500,
      fontSize: '20px',
      lineHeight: 1.2,
      letterSpacing: '-0.005em'
    },
    h5: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 500,
      fontSize: '18px',
      lineHeight: 1.25,
      letterSpacing: '0px'
    },
    h6: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 500,
      fontSize: '16px',
      lineHeight: 1.3,
      letterSpacing: '0px'
    },
    body1: {
      fontFamily: MONO_STACK,
      fontSize: '14px',
      lineHeight: 1.6,
      letterSpacing: '0px'
    },
    body2: {
      fontFamily: MONO_STACK,
      fontSize: '13px',
      lineHeight: 1.55,
      letterSpacing: '0px'
    },
    subtitle1: {
      fontFamily: DISPLAY_STACK,
      fontWeight: 500,
      fontSize: '15px',
      lineHeight: 1.4,
      letterSpacing: '-0.005em'
    },
    subtitle2: {
      fontFamily: MONO_STACK,
      fontWeight: 500,
      fontSize: '12px',
      lineHeight: 1.4,
      letterSpacing: '0.02em'
    },
    overline: {
      fontFamily: MONO_STACK,
      fontWeight: 500,
      fontSize: '11px',
      lineHeight: 1.5,
      letterSpacing: '0.18em',
      textTransform: 'uppercase'
    },
    caption: {
      fontFamily: MONO_STACK,
      fontWeight: 400,
      fontSize: '11px',
      lineHeight: 1.5,
      letterSpacing: '0.04em'
    },
    button: {
      fontFamily: MONO_STACK,
      fontWeight: 500,
      fontSize: '12px',
      letterSpacing: '0.04em',
      textTransform: 'none'
    }
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 900,
      lg: 1200,
      xl: 1536
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: 'var(--bg)',
          color: 'var(--fg)',
          fontFamily: MONO_STACK,
          fontSize: '14px',
          lineHeight: 1.5,
          WebkitFontSmoothing: 'antialiased',
          textRendering: 'optimizeLegibility',
          transition: 'background-color 0.3s ease'
        },
        '::selection': {
          background: 'var(--a1)',
          color: 'var(--bg)'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableRipple: true,
        disableElevation: true
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 0,
          textTransform: 'none',
          fontFamily: MONO_STACK,
          fontSize: '12px',
          letterSpacing: '0.04em',
          padding: '10px 14px',
          border: '1px solid var(--line-2)',
          color: 'var(--fg)',
          backgroundColor: 'transparent',
          transition: 'border-color 120ms ease, color 120ms ease, background-color 120ms ease',
          '&:hover': {
            backgroundColor: 'transparent',
            borderColor: 'var(--a1)',
            color: 'var(--a1)'
          },
          '&.Mui-disabled': {
            color: theme.palette.text.disabled,
            borderColor: 'var(--line)'
          }
        })
      },
      // Variant styling via `variants` (matched on the button's props, applied after styleOverrides.root).
      variants: [
        {
          props: { variant: 'contained' },
          style: {
            backgroundColor: 'var(--a1)',
            color: 'var(--bg)',
            borderColor: 'var(--a1)',
            '&:hover': {
              backgroundColor: 'transparent',
              color: 'var(--a1)',
              borderColor: 'var(--a1)'
            }
          }
        },
        {
          props: { variant: 'outlined' },
          style: {
            borderColor: 'var(--line-2)',
            color: 'var(--fg)',
            '&:hover': {
              borderColor: 'var(--a1)',
              color: 'var(--a1)',
              backgroundColor: 'transparent'
            }
          }
        },
        {
          props: { variant: 'text' },
          style: {
            border: 'none',
            color: 'var(--fg-2)',
            '&:hover': { color: 'var(--a1)', backgroundColor: 'transparent' }
          }
        }
      ]
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          borderRadius: 0,
          fontFamily: MONO_STACK,
          fontSize: '11px',
          letterSpacing: '0.02em',
          height: 'auto',
          padding: '5px 10px',
          backgroundColor: 'transparent',
          border: '1px solid var(--line-2)',
          color: 'var(--fg-2)',
          transition: 'border-color 120ms ease, color 120ms ease',
          '& .MuiChip-label': {
            padding: 0
          },
          '& .MuiChip-icon': {
            margin: '0 6px 0 0',
            color: 'inherit'
          },
          '&:hover': {
            borderColor: 'var(--a1)',
            color: 'var(--fg)',
            backgroundColor: 'transparent'
          },
          ...(ownerState.color === 'primary' && {
            color: 'var(--a1)',
            borderColor: 'color-mix(in oklab, var(--a1) 40%, var(--line))'
          }),
          ...(ownerState.color === 'secondary' && {
            color: 'var(--a2)',
            borderColor: 'color-mix(in oklab, var(--a2) 40%, var(--line))'
          }),
          '&.Mui-disabled': {
            color: theme.palette.text.disabled,
            opacity: 0.5
          }
        }),
        filled: () => ({
          backgroundColor: 'var(--a1)',
          color: 'var(--bg)',
          borderColor: 'var(--a1)',
          '&:hover': {
            backgroundColor: 'transparent',
            color: 'var(--a1)'
          }
        }),
        outlined: () => ({
          backgroundColor: 'transparent',
          borderColor: 'var(--line-2)',
          color: 'var(--fg-2)',
          '&:hover': {
            borderColor: 'var(--a1)',
            color: 'var(--a1)',
            backgroundColor: 'transparent'
          }
        })
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        // Unselected options must read as clickable, not disabled.
        root: {
          color: 'var(--fg-2)',
          borderColor: 'var(--line-2)',
          '&.Mui-selected': {
            color: 'var(--a1)',
            backgroundColor: 'var(--a1-soft)'
          }
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: () => ({
          borderRadius: 0,
          padding: '8px',
          color: 'var(--fg-2)',
          transition: 'color 120ms ease, background-color 120ms ease',
          '&:hover': {
            backgroundColor: 'transparent',
            color: 'var(--a1)'
          }
        })
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: () => ({
          borderRadius: 0,
          fontFamily: MONO_STACK,
          fontSize: '13px',
          color: 'var(--fg)',
          backgroundColor: 'transparent',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--line-2)',
            borderWidth: '1px'
          },
          '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--a1)',
            borderWidth: '1px'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--a1)',
            borderWidth: '1px'
          }
        }),
        input: {
          padding: '10px 12px'
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: MONO_STACK,
          fontSize: '11px',
          letterSpacing: '0.04em',
          color: 'var(--fg-3)',
          '&.Mui-focused': {
            color: 'var(--a1)'
          }
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: () => ({
          margin: '0.5rem 0',
          borderColor: 'var(--line)',
          backgroundColor: 'transparent'
        })
      }
    },
    MuiCard: {
      styleOverrides: {
        root: () => ({
          backgroundColor: 'var(--bg-1)',
          border: '2px solid var(--line)',
          borderRadius: 0,
          boxShadow: 'none',
          transition: 'background-color 160ms ease, border-color 160ms ease',
          overflow: 'hidden',
          '&:hover': {
            backgroundColor: 'var(--bg-2)'
          }
        })
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px',
          '&:last-child': {
            paddingBottom: '24px'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--bg-1)',
          backgroundImage: 'none',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--line)',
          borderTop: 'none',
          boxShadow: 'none',
          color: 'var(--fg)'
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: () => ({
          color: 'var(--a1)',
          textDecoration: 'none',
          fontFamily: 'inherit',
          fontWeight: 500,
          transition: 'color 120ms ease',
          '&:hover': {
            color: 'var(--a1)',
            textDecoration: 'underline'
          }
        })
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          padding: '8px 0'
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--bg-2)',
          color: 'var(--fg)',
          border: '1px solid var(--line)',
          borderRadius: 0,
          fontFamily: MONO_STACK,
          fontSize: '11px',
          letterSpacing: '0.04em'
        },
        arrow: {
          color: 'var(--bg-2)'
        }
      }
    }
  }
};

export const createAppTheme = (mode: LocalTheme) =>
  createTheme({
    palette: { mode, ...Colors[mode] },
    ...commonTheme
  });
