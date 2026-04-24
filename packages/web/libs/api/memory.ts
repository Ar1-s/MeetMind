import { request } from '@/libs/request'

const api = request()

export async function listMeetingMemories(meetingId: string) {
  return api.get<{
    memories: Array<{
      id: string
      meeting_id: string
      title?: string
      content: string
      created_at: string
    }>
  }>(`/v1/memory/meetings/${meetingId}`)
}

export async function createMeetingMemory(
  meetingId: string,
  title: string | null,
  content: string,
) {
  return api.post<{
    id: string
    meeting_id: string
    title?: string
    content: string
    created_at: string
  }>(`/v1/memory/meetings/${meetingId}`, {
    data: { title, content },
  })
}

export async function searchMemories(query: string) {
  return api.get<{
    memories: Array<{
      id: string
      meeting_id: string
      title?: string
      content: string
      created_at: string
    }>
  }>(`/v1/memory/search`, {
    params: { query },
  })
}
