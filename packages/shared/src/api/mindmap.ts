import type { ApiClient } from './client'
import type { MindmapData } from '../types'

export const createMindmapApi = (client: ApiClient) => ({
  generate: async (meetingId: string): Promise<MindmapData> => {
    const res = await client.post<{ status: string; mindmap: MindmapData }>(
      `/v1/meetings/${meetingId}/mindmap/generate`,
    )
    return res.mindmap
  },

  edit: async (meetingId: string, instruction: string): Promise<MindmapData> => {
    const res = await client.post<{ status: string; mindmap: MindmapData }>(
      `/v1/meetings/${meetingId}/mindmap/edit`,
      { data: { instruction } },
    )
    return res.mindmap
  },

  getChatHistory: (meetingId: string) =>
    client.get<any[]>(`/v1/meetings/${meetingId}/mindmap/chat`),
})
