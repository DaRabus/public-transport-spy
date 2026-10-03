/**
 * Palette mirrors the "phosphor" theme from /redesign — terminal × bold modernist.
 * Source of truth for the matching CSS variables (--bg, --fg, --a1, …) is
 * `globals.css`; values here must stay in sync so MUI components and raw CSS
 * stay visually consistent.
 */
export const Colors = {
  dark: {
    primary: {
      main: '#6dffb0', // --a1 — phosphor green
      light: '#a2ffce',
      dark: '#3ad188',
      contrastText: '#07090a',
      heading: '#e9efe7',
      shades: {
        p50: 'rgba(109, 255, 176, 0.5)',
        p30: 'rgba(109, 255, 176, 0.3)'
      }
    },
    secondary: {
      main: '#ffb547', // --a2 — warm amber accent
      dark: '#cc8e2e',
      light: '#ffd089',
      contrastText: '#07090a',
      shades: {
        p50: 'rgba(255, 181, 71, 0.5)'
      }
    },
    success: {
      main: '#6dffb0',
      dark: '#3ad188',
      light: '#a2ffce',
      contrastText: '#07090a',
      shades: {
        p30: 'rgba(109, 255, 176, 0.3)'
      }
    },
    error: {
      main: '#ff5e6d',
      dark: '#cc3d4b',
      light: '#ff8c95',
      contrastText: '#07090a'
    },
    warning: {
      main: '#ffb547',
      dark: '#cc8e2e',
      light: '#ffd089',
      contrastText: '#07090a'
    },
    info: {
      main: '#6e8bff',
      dark: '#4a66cc',
      light: '#9eb2ff',
      contrastText: '#07090a',
      shades: {
        p30: 'rgba(110, 139, 255, 0.3)'
      }
    },
    text: {
      primary: '#e9efe7', // --fg
      secondary: '#aab2ad', // --fg-2
      disabled: '#6a716d', // --fg-3
      contrast: '#07090a'
    },
    other: {
      divider: '#1d2224', // --line
      buttonGroup: '#6e8bff',
      buttonSelected: '#6dffb0',
      successBorder: '#6dffb0',
      hoverBox: '#131718' // --bg-2
    },
    action: {
      hover: 'rgba(109, 255, 176, 0.08)',
      active: 'rgba(109, 255, 176, 0.16)',
      selected: 'rgba(109, 255, 176, 0.12)'
    },
    background: {
      default: '#1f282d', // --bg
      paper: '#283437', // --bg-1
      card: '#272f32', // --bg-2
      border: '#1d2224' // --line
    },
    paper: {
      elevation1: '#0e1112',
      elevation6: '#131718',
      elevation20: 'rgba(109, 255, 176, 0.05)',
      elevation21: '#1d2224',
      elevation22: 'rgba(109, 255, 176, 0.05)',
      elevation23: 'rgba(110, 139, 255, 0.05)',
      elevation24: 'rgba(255, 181, 71, 0.05)'
    }
  }
};
