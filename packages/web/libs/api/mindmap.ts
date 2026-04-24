'use client'

import { request } from '../request'
import type { MindmapData } from '@/interfaces'

const api = request()

/**
 * Generate initial mindmap from meeting summary
 */
export async function generateMindmap(meetingId: string): Promise<MindmapData> {
  const response = await api.post<{ status: string; mindmap: MindmapData }>(
    `/v1/meetings/${meetingId}/mindmap/generate`,
  )
  return response.mindmap
}

/**
 * Edit mindmap using natural language instruction
 */
export async function editMindmap(meetingId: string, instruction: string): Promise<MindmapData> {
  const response = await api.post<{ status: string; mindmap: MindmapData }>(
    `/v1/meetings/${meetingId}/mindmap/edit`,
    { data: { instruction } },
  )
  return response.mindmap
}

/**
 * Get chat history for mindmap editing
 */
export async function fetchMindmapChatHistory(meetingId: string): Promise<any[]> {
  const response = await api.get<any[]>(`/v1/meetings/${meetingId}/mindmap/chat`)
  return response
}
