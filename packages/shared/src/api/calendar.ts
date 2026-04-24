import type { ApiClient } from './client'

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

export const createCalendarApi = (client: ApiClient) => ({
  getEvents: (start: string, end: string) =>
    client.get<CalendarEvent[]>('/v1/calendar/events', {
      params: { start_date: start, end_date: end },
    }),

  getSubscribeUrl: () =>
    client.get<{ webcal_url: string }>('/v1/calendar/subscribe'),
})
