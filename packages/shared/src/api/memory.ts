import type { ApiClient } from './client'

export interface Memory {
  id: string
  meeting_id: string
  title?: string
  content: string
  created_at: string
}

export const createMemoryApi = (client: ApiClient) => ({
  list: (meetingId: string) =>
    client.get<{ memories: Memory[] }>(`/v1/memory/meetings/${meetingId}`),

  create: (meetingId: string, title: string | null, content: string) =>
    client.post<Memory>(`/v1/memory/meetings/${meetingId}`, { data: { title, content } }),

  search: (query: string) =>
    client.get<{ memories: Memory[] }>('/v1/memory/search', { params: { query } }),
})
