import type { ApiClient } from './client'

export const createCalendarFeedApi = (client: ApiClient) => ({
  getToken: () => client.get<{ token: string }>('/v1/calendar/token'),
})
