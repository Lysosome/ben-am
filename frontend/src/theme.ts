import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#E6E6E6',
      contrastText: '#111111',
    },
    secondary: {
      main: '#A31313',
      dark: '#1A0000',
      light: '#E0A0A0',
      contrastText: '#111111',
    },
    background: {
      default: '#111111',
      paper: '#111111',
    },
    text: {
      primary: '#E6E6E6',
      secondary: '#A1A1A1',
    },
    divider: 'rgba(161,161,161,0.12)',
    error: {
      main: '#A31313',
      dark: '#1A0000',
      light: '#FE8D8D',
      contrastText: '#E6E6E6',
    },
    success: {
      main: '#9FC38A',
      contrastText: '#111111',
    },
    warning: {
      main: '#E4C0A0',
      contrastText: '#111111',
    },
  },
  typography: {
    fontFamily: '"Courier New", Courier, monospace', // "Share Tech Mono", 
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2.25rem',
      fontWeight: 600,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.875rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 700,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '10px 24px',
          fontSize: '1rem',
        },
        contained: {
          boxShadow: 'none',
          backgroundColor: '#E6E6E6',
          color: '#111111',
          '&:hover': {
            backgroundColor: '#dcdcdc',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
          borderRadius: 0,
          border: 'none',
          position: 'relative',
          backgroundImage: `
            linear-gradient(to right, #510000 0%, #510000 100%),
            linear-gradient(to right, #510000 0%, #510000 100%),
            linear-gradient(to bottom, #510000 0%, #510000 100%),
            linear-gradient(to bottom, #510000 0%, #510000 100%)
          `,
          backgroundSize: 'calc(100% - 20px) 2px, calc(100% - 20px) 2px, 2px calc(100% - 20px), 2px calc(100% - 20px)',
          backgroundPosition: '10px 0, 10px 100%, 0 10px, 100% 10px',
          backgroundRepeat: 'no-repeat',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCardMedia: {
      styleOverrides: {
        root: {
          margin: '10px 10px 0 10px',
          width: 'calc(100% - 20px)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
          },
        },
      },
    },
    MuiChip: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          borderRadius: 0,
          border: 'none',
          position: 'relative',
          backgroundImage: `
            linear-gradient(to right, #510000 0%, #510000 100%),
            linear-gradient(to right, #510000 0%, #510000 100%),
            linear-gradient(to bottom, #510000 0%, #510000 100%),
            linear-gradient(to bottom, #510000 0%, #510000 100%)
          `,
          backgroundSize: 'calc(100% - 20px) 2px, calc(100% - 20px) 2px, 2px calc(100% - 20px), 2px calc(100% - 20px)',
          backgroundPosition: '10px 0, 10px 100%, 0 10px, 100% 10px',
          backgroundRepeat: 'no-repeat',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Courier New", Courier, monospace',
          color: '#A1A1A1', // text.secondary
          '&.Mui-selected': {
            backgroundColor: 'transparent',
            color: '#E0A0A0', // secondary.light
            fontWeight: 700,
            '&:hover': {
              backgroundColor: 'rgba(224, 160, 160, 0.08)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(161, 161, 161, 0.08)',
          },
          // Previous button: hide icon and show < character
          '&.MuiPaginationItem-previousNext[aria-label*="previous"]': {
            '& .MuiSvgIcon-root': {
              display: 'none',
            },
            '&::after': {
              content: '"<"',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '1.2rem',
            },
          },
          // Next button: hide icon and show > character
          '&.MuiPaginationItem-previousNext[aria-label*="next"]': {
            '& .MuiSvgIcon-root': {
              display: 'none',
            },
            '&::after': {
              content: '">"',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '1.2rem',
            },
          },
        },
      },
    },
  },
});
