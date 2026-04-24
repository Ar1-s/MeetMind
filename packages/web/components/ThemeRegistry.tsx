'use client'

import { createTheme, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react'
import ToastProvider from './ToastProvider'

type ThemeMode = 'light' | 'dark'

interface ThemeModeContextValue {
  mode: ThemeMode
  toggle: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

export const useThemeMode = () => {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeRegistry')
  }
  return ctx
}

interface ThemeRegistryProps {
  children: ReactNode
}

export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('theme_mode') as ThemeMode | null
    if (stored === 'light' || stored === 'dark') {
      setMode(stored)
      return
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    setMode(prefersDark ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    setMode(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('theme_mode', next)
      }
      return next
    })
  }

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#0A84FF',
          },
          secondary: {
            main: '#9c27b0',
          },
          background: {
            default: mode === 'dark' ? '#0B0B0F' : '#f5f5f5',
            paper: mode === 'dark' ? '#121318' : '#ffffff',
          },
        },
        typography: {
          fontFamily: 'var(--font-geist-sans), sans-serif',
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                '@media (max-width:600px)': {
                  borderRadius: 999,
                  minHeight: 40,
                },
              },
              contained: {
                backgroundColor: mode === 'dark' ? '#0A84FF' : '#1976d2',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: mode === 'dark' ? '#2EA0FF' : '#1565c0',
                },
              },
              outlined: {
                borderColor: mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                color: mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'inherit',
                '&:hover': {
                  borderColor: mode === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)',
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                '@media (max-width:600px)': {
                  borderRadius: 12,
                  backgroundColor: mode === 'dark' ? '#1A1C24' : '#F7F7FB',
                  '& fieldset': {
                    borderColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  },
                  '&:hover fieldset': {
                    borderColor: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#007AFF',
                  },
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                '@media (max-width:600px)': {
                  borderRadius: 999,
                },
                ...(mode === 'dark'
                  ? {
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.9)',
                      borderColor: 'rgba(255,255,255,0.12)',
                    }
                  : {}),
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                ...(mode === 'dark'
                  ? {
                      backgroundColor: '#121318',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }
                  : {}),
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                ...(mode === 'dark'
                  ? {
                      backgroundColor: '#121318',
                      color: 'rgba(255,255,255,0.92)',
                    }
                  : {}),
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                ...(mode === 'dark'
                  ? {
                      backgroundColor: '#121318',
                      color: 'rgba(255,255,255,0.9)',
                    }
                  : {}),
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                ...(mode === 'dark'
                  ? {
                      backgroundColor: '#15161C',
                      color: 'rgba(255,255,255,0.9)',
                    }
                  : {}),
              },
            },
          },
        },
      }),
    [mode],
  )

  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}
