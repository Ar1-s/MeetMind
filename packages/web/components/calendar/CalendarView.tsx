'use client'

import { useCallback, useMemo, useState, type ComponentType } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import FullCalendar from '@fullcalendar/react'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { CalendarEvent } from '@/libs/api/calendar'

interface CalendarViewProps {
  events: CalendarEvent[]
  onSelectEvent?: (event: CalendarEvent) => void
  onRangeChange?: (range: { start: string; end: string }) => void
}

export default function CalendarView({ events, onSelectEvent, onRangeChange }: CalendarViewProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const [calendarView, setCalendarView] = useState(isMobile ? 'listWeek' : 'dayGridMonth')
  const [calendarDate, setCalendarDate] = useState<string | undefined>(undefined)
  const borderTone = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const buttonBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
  const harnessBorder = `1px solid ${borderTone}`
  const listBorder = borderTone
  const listHeaderBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
  const FullCalendarComponent = FullCalendar as unknown as ComponentType<any>

  const getEventColor = (event: CalendarEvent) => {
    const isOverdue =
      event.type === 'task' &&
      event.status !== 'done' &&
      event.status !== 'completed' &&
      event.end &&
      new Date(event.end) < new Date()

    if (isOverdue) {
      return { backgroundColor: '#FF3B30', borderColor: '#FF3B30', textColor: '#FFFFFF' }
    }

    if (event.type === 'meeting') {
      if (event.metadata?.has_summary) {
        return { backgroundColor: '#34C759', borderColor: '#34C759', textColor: '#FFFFFF' }
      }
      return { backgroundColor: '#007AFF', borderColor: '#007AFF', textColor: '#FFFFFF' }
    }

    if (event.type === 'task') {
      switch (event.status) {
        case 'done':
        case 'completed':
          return { backgroundColor: '#34C759', borderColor: '#34C759', textColor: '#FFFFFF' }
        case 'in_progress':
          return { backgroundColor: '#007AFF', borderColor: '#007AFF', textColor: '#FFFFFF' }
        case 'todo':
        case 'pending':
          return { backgroundColor: '#FF9500', borderColor: '#FF9500', textColor: '#FFFFFF' }
        case 'blocked':
          return { backgroundColor: '#AF52DE', borderColor: '#AF52DE', textColor: '#FFFFFF' }
      }
    }

    return { backgroundColor: '#007AFF', borderColor: '#007AFF', textColor: '#FFFFFF' }
  }

  const mappedEvents = useMemo(() => {
    return events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end || event.start,
      allDay: Boolean(event.all_day) || event.type === 'task',
      extendedProps: event,
      ...getEventColor(event),
    }))
  }, [events])

  const plugins = useMemo(
    () => [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    [],
  )

  const headerToolbar = useMemo(
    () => ({
      left: 'prev,next today',
      center: 'title',
      right: isMobile
        ? 'dayGridMonth,timeGridWeek,listWeek'
        : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    }),
    [isMobile],
  )

  const buttonText = useMemo(
    () => ({ today: '今天', month: '月', week: '周', day: '日', list: '列表' }),
    [],
  )

  const handleDatesSet = useCallback(
    (info: DatesSetArg) => {
      const nextView = info.view.type
      const nextDate = info.view.currentStart.toISOString()

      setCalendarView(prev => (prev === nextView ? prev : nextView))
      setCalendarDate(prev => (prev === nextDate ? prev : nextDate))
      onRangeChange?.({ start: info.startStr, end: info.endStr })
    },
    [onRangeChange],
  )

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        height: { xs: '72vh', md: 'calc(100vh - 150px)' },
        maxHeight: { xs: '72vh', md: '90vh' },
        '& .fc': {
          fontFamily: theme.typography.fontFamily,
          '--fc-border-color': borderTone,
          '--fc-button-border-color': buttonBorder,
          '--fc-neutral-bg-color': isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          '--fc-neutral-text-color': isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
          '--fc-page-bg-color': theme.palette.background.paper,
        },
        '& .fc-toolbar': {
          flexWrap: 'wrap',
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          padding: { xs: '4px 0 8px', sm: '0' },
        },
        '& .fc-toolbar-chunk': {
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-start' },
          gap: 0.5,
          width: { xs: '100%', sm: 'auto' },
        },
        '& .fc-toolbar-title': {
          fontSize: { xs: '1rem', sm: '1.2rem' },
          textAlign: { xs: 'center', sm: 'left' },
          fontWeight: 600,
          color: theme.palette.text.primary,
        },
        '& .fc-button': {
          padding: '4px 8px',
          fontSize: '0.75rem',
          borderRadius: 999,
          borderColor: buttonBorder,
          boxShadow: 'none',
        },
        '& .fc-button-primary': {
          backgroundColor: '#007AFF',
          borderColor: '#007AFF',
        },
        '& .fc-button-primary:not(:disabled):hover': {
          backgroundColor: '#0A84FF',
          borderColor: '#0A84FF',
        },
        '& .fc-button-primary:disabled': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.35)',
        },
        '& .fc-button-group': {
          borderRadius: 999,
          overflow: 'hidden',
        },
        '& .fc-view-harness': {
          borderRadius: 0,
          overflow: 'visible',
          border: harnessBorder,
          backgroundColor: theme.palette.background.paper,
        },
        '& .fc-list': {
          borderColor: listBorder,
        },
        '& .fc-list-table': {
          borderColor: listBorder,
        },
        '& .fc-list-day-cushion': {
          backgroundColor: listHeaderBg,
        },
        '& .fc-list-day-text, & .fc-list-day-side-text': {
          color: theme.palette.text.secondary,
        },
        '& .fc-list-event:hover td': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        },
        '& .fc-scrollgrid': {
          border: 'none',
          backgroundColor: 'transparent',
        },
        '& .fc-theme-standard td, & .fc-theme-standard th': {
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        '& .fc-theme-standard .fc-scrollgrid': {
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        '& .fc-daygrid-day': {
          backgroundColor: 'transparent',
        },
        '& .fc-daygrid-day-number': {
          color: 'text.secondary',
          fontSize: { xs: '0.75rem', sm: '0.85rem' },
        },
        '& .fc-day-today': {
          backgroundColor: 'rgba(0,122,255,0.08)',
        },
      }}
    >
      <FullCalendarComponent
        plugins={plugins}
        initialView={calendarView}
        initialDate={calendarDate}
        headerToolbar={headerToolbar}
        buttonText={buttonText}
        height="100%"
        events={mappedEvents}
        dayMaxEvents
        datesSet={handleDatesSet}
        eventClick={(info: EventClickArg) => {
          const original = info.event.extendedProps as CalendarEvent
          if (original && onSelectEvent) {
            onSelectEvent(original)
          }
        }}
        nowIndicator
        stickyHeaderDates
      />
    </Box>
  )
}
