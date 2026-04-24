'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CalendarView from '@/components/calendar/CalendarView'
import { getCalendarEvents, CalendarEvent } from '@/libs/api/calendar'
import { useToastStore, useAuthStore } from '@/libs/stores'
import { useRouter } from 'next/navigation'
import { useTheme } from '@mui/material/styles'

export default function CalendarPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const toastError = useToastStore(s => s.error)
  const router = useRouter()
  const { user } = useAuthStore()

  const lastRangeRef = useRef('')
  const fetchingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  const fetchEvents = useCallback(
    async (range?: { start: string; end: string }, options?: { silent?: boolean }) => {
    const start = range ? new Date(range.start) : new Date()
    const end = range ? new Date(range.end) : new Date()
    if (!range) {
      start.setMonth(start.getMonth() - 2)
      end.setMonth(end.getMonth() + 2)
    }

    // Deduplicate: skip if same range is already fetched/fetching
    const rangeKey = `${start.toISOString()}|${end.toISOString()}`
    if (rangeKey === lastRangeRef.current || fetchingRef.current) return
    fetchingRef.current = true

    const shouldManageLoading = !hasLoadedOnceRef.current

    try {
      if (shouldManageLoading) {
        setLoading(true)
      }
      const res = await getCalendarEvents(start.toISOString(), end.toISOString())
      setEvents(res)
      setLoadError('')
      lastRangeRef.current = rangeKey
      hasLoadedOnceRef.current = true
    } catch (e) {
      console.error(e)
      const message = (e as Error)?.message || '获取日历事件失败'
      setLoadError(message)
      lastRangeRef.current = ''
      if (!options?.silent) {
        toastError(message)
      }
    } finally {
      if (shouldManageLoading) {
        setLoading(false)
      }
      fetchingRef.current = false
    }
    },
    [toastError],
  )

  useEffect(() => {
    fetchEvents(undefined, { silent: true })
  }, [fetchEvents])

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.type === 'meeting') {
      router.push(`/meetings/${event.metadata.original_id}`)
    } else {
      router.push(`/tasks?highlight=${event.metadata.original_id}`)
    }
  }

  const handleSubscribe = () => {
    const token = user?.calendar_token

    if (!token) {
      toastError('无法获取用户信息，请重新登录')
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'webcal' : 'webcal'
    // If dev env, we might need to point to API port directly if not proxying,
    // but usually webcal://localhost:3000/api... is fine if proxied.
    // However, API is on 3452. WebCal needs direct access to API.
    // Let's use the API URL from env or assume localhost:3452 for dev

    // Construct API base URL
    let apiBase = process.env.NEXT_PUBLIC_PROD_API_PATH || 'http://localhost:3452'

    // Handle relative path (e.g. "/api") by resolving against current origin
    if (apiBase.startsWith('/')) {
      apiBase = `${window.location.origin}${apiBase}`
    }

    // Remove trailing slash if present
    apiBase = apiBase.replace(/\/$/, '')

    // Replace http/https with webcal
    const webcalBase = apiBase.replace(/^https?:\/\//, 'webcal://')

    // Check if apiBase already ends with /api, if so, we shouldn't add it again if the path also has it
    // But typically endpoints are /v1/...
    // Let's assume apiBase leads to the root of API (e.g. .../api)
    // And our route path is /v1/calendar/feed

    const url = `${webcalBase}/v1/calendar/feed?token=${token}`
    window.open(url)
  }

  return (
    <Box
      sx={{
        bgcolor: { xs: isDark ? 'background.default' : '#F2F2F7', sm: 'transparent' },
        px: { xs: 2, sm: 0 },
        py: { xs: 2, sm: 0 },
        fontFamily: {
          xs: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif',
          sm: 'inherit',
        },
      }}
    >
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            日程日历
          </Typography>
          <Typography variant="body2" color="text.secondary">
            统一查看会议与任务
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<CalendarMonthIcon />}
          onClick={handleSubscribe}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            borderRadius: 999,
            px: 2,
            bgcolor: { xs: 'background.paper', sm: 'transparent' },
            border: {
              xs: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.06)',
              sm: isDark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(0,0,0,0.12)',
            },
            boxShadow: {
              xs: isDark ? '0 8px 16px rgba(0,0,0,0.5)' : '0 8px 16px rgba(0,0,0,0.06)',
              sm: 'none',
            },
          }}
        >
          订阅到系统日历
        </Button>
      </Box>

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {loading && events.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            borderRadius: { xs: 3, sm: 2 },
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: {
              xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
              sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
            },
            bgcolor: 'background.paper',
            p: { xs: 1.5, sm: 2 },
          }}
        >
          <CalendarView
            events={events}
            onSelectEvent={handleSelectEvent}
            onRangeChange={fetchEvents}
          />
        </Box>
      )}
    </Box>
  )
}
