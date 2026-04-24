import { request } from '@/libs/request'
import type { MeetingListResponse, Meeting, MeetingCreate } from '@/interfaces'

const api = request()

export async function getMeetings(params?: {
  page?: number
  limit?: number
  tags?: string
  project_id?: string
  search?: string
}): Promise<MeetingListResponse> {
  return api.get<MeetingListResponse>('/v1/meetings', { params })
}

export async function getMeeting(meetingId: string): Promise<Meeting> {
  return api.get<Meeting>(`/v1/meetings/${meetingId}`)
}

export async function createMeeting(data: MeetingCreate): Promise<Meeting> {
  return api.post<Meeting>('/v1/meetings', { data })
}

export async function updateMeeting(
  meetingId: string,
  data: Partial<MeetingCreate>,
): Promise<Meeting> {
  return api.patch<Meeting>(`/v1/meetings/${meetingId}`, { data })
}

export async function deleteMeeting(
  meetingId: string,
  options?: { deleteRelated?: boolean },
): Promise<void> {
  return api.delete<void>(`/v1/meetings/${meetingId}`, {
    data:
      options && typeof options.deleteRelated === 'boolean'
        ? { delete_related: options.deleteRelated }
        : undefined,
  })
}
