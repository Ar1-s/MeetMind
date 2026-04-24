import type { ApiClient } from './client'
import type { Meeting, MeetingCreate, MeetingListResponse } from '../types'

export const createMeetingsApi = (client: ApiClient) => ({
  list: (params?: { page?: number; limit?: number; tags?: string; project_id?: string }) =>
    client.get<MeetingListResponse>('/v1/meetings', { params }),

  get: (meetingId: string) =>
    client.get<Meeting>(`/v1/meetings/${meetingId}`),

  create: (data: MeetingCreate) =>
    client.post<Meeting>('/v1/meetings', { data }),

  update: (meetingId: string, data: Partial<MeetingCreate>) =>
    client.patch<Meeting>(`/v1/meetings/${meetingId}`, { data }),

  delete: (meetingId: string) =>
    client.delete<void>(`/v1/meetings/${meetingId}`),
})
