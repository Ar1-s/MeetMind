'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import { alpha, keyframes, useTheme } from '@mui/material/styles'
import { login } from '@/libs/api'
import { useAuthStore, useToastStore } from '@/libs/stores'
import { useThemeMode } from '@/components/ThemeRegistry'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const authLogin = useAuthStore(s => s.login)
  const toast = useToastStore()
  const theme = useTheme()
  const { mode, toggle } = useThemeMode()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const ripple = keyframes`
    0% {
      transform: translate(-50%, -50%) scale(0.05);
      opacity: 0;
    }
    12% {
      opacity: 0.8;
    }
    70% {
      opacity: 0.35;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.6);
      opacity: 0;
    }
  `
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 3,
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#F7F7FB',
      '& fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      },
      '&:hover fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
      },
    },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.username.trim() || !form.password.trim()) {
      toast.warning('请填写用户名和密码')
      return
    }

    setLoading(true)
    try {
      const res = await login(form)
      authLogin(res.user, res.access_token)
      toast.success('登录成功')
      const nextPath = searchParams.get('next')
      router.push(nextPath && nextPath.startsWith('/') ? nextPath : '/meetings')
    } catch (err: any) {
      toast.error(err?.message || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 720,
            height: 720,
            top: '50%',
            left: '50%',
            borderRadius: '50%',
            border: '2px solid',
            borderColor: alpha(theme.palette.primary.main, 0.28),
            boxShadow: `0 0 80px ${alpha(theme.palette.primary.main, 0.25)}`,
            animation: `${ripple} 6.8s ease-out infinite`,
            animationDelay: '-1.2s',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 720,
            height: 720,
            top: '50%',
            left: '50%',
            borderRadius: '50%',
            border: '2px solid',
            borderColor: alpha(theme.palette.primary.main, 0.22),
            boxShadow: `0 0 70px ${alpha(theme.palette.primary.main, 0.22)}`,
            animation: `${ripple} 6.8s ease-out infinite`,
            animationDelay: '-3.4s',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 720,
            height: 720,
            top: '50%',
            left: '50%',
            borderRadius: '50%',
            border: '2px solid',
            borderColor: alpha(theme.palette.primary.main, 0.18),
            boxShadow: `0 0 60px ${alpha(theme.palette.primary.main, 0.2)}`,
            animation: `${ripple} 6.8s ease-out infinite`,
            animationDelay: '-5.6s',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 720,
            height: 720,
            top: '50%',
            left: '50%',
            borderRadius: '50%',
            border: '2px solid',
            borderColor: alpha(theme.palette.primary.main, 0.16),
            boxShadow: `0 0 50px ${alpha(theme.palette.primary.main, 0.18)}`,
            animation: `${ripple} 6.8s ease-out infinite`,
            animationDelay: '-7.8s',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(60% 60% at 50% 50%, ${alpha(
              theme.palette.primary.main,
              0.12,
            )} 0%, transparent 65%)`,
            opacity: theme.palette.mode === 'dark' ? 0.9 : 0.75,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(0deg, ${alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.14 : 0.08,
            )} 0 1px, transparent 1px 16px)`,
            opacity: theme.palette.mode === 'dark' ? 0.35 : 0.25,
          }}
        />
      </Box>
      <Paper
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 420,
          m: 2,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 20px 40px rgba(0,0,0,0.6)'
              : '0 20px 40px rgba(0,0,0,0.12)',
          bgcolor: 'background.paper',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Tooltip title={mode === 'dark' ? '切换明亮模式' : '切换黑暗模式'}>
          <IconButton
            onClick={toggle}
            size="small"
            sx={{ position: 'absolute', top: 12, right: 12 }}
            aria-label="toggle theme"
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box
            sx={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.25,
              mb: 1.5,
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 18,
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.25),
                background: `linear-gradient(135deg, ${alpha(
                  theme.palette.primary.main,
                  0.15,
                )}, ${alpha(theme.palette.primary.main, 0.35)})`,
                boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 6,
                  borderRadius: 14,
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(10,132,255,0.16)'
                      : 'rgba(10,132,255,0.08)',
                }}
              />
              <GraphicEqIcon
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 30,
                  color: 'primary.main',
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: 1, color: 'text.secondary' }}
            >
              MEETING COPILOT
            </Typography>
          </Box>
          <Typography variant="h4" gutterBottom textAlign="center" sx={{ fontWeight: 700 }}>
          登录
        </Typography>
          <Typography variant="body2" color="text.secondary">
            继续你的会议记录
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="用户名或邮箱"
            value={form.username}
            onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            required
            autoFocus
            disabled={loading}
            sx={inputSx}
          />
          <TextField
            label="密码"
            type="password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            required
            disabled={loading}
            sx={inputSx}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              borderRadius: 999,
              py: 1.2,
              boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.35)}`,
              '&:hover': {
                boxShadow: `0 16px 32px ${alpha(theme.palette.primary.main, 0.45)}`,
              },
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '登录'}
          </Button>
        </Box>

        <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
          没有账号？ <Link href="/register">立即注册</Link>
        </Typography>
      </Paper>
    </Box>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
