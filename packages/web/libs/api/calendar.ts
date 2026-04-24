import { request } from '@/libs/request'

const api = request()

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  all_day: boolean
  type: 'meeting' | 'task'
  status?: string
  metadata: {
    original_id: string
    [key: string]: any
  }
}

export async function getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  return api.get<CalendarEvent[]>('/v1/calendar/events', {
    params: { start_date: start, end_date: end },
  })
}
