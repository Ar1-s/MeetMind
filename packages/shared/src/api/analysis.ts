import type { ApiClient } from './client'
import type { Summary } from '../types'

export interface SlidesStatus {
  status: string
  progress: number
  message: string
  preview_url?: string
  export_urls?: { pdf?: string; pptx?: string }
  image_urls?: string[]
  log_url?: string
}

export interface AnalysisStatusResponse {
  status: string
  progress: number
  message?: string
  stage?: string
  steps?: Array<{ label: string; progress: number }>
  eta_seconds?: number
}

export const createAnalysisApi = (client: ApiClient) => ({
  startAnalysis: (meetingId: string, recordingId: string) => {
    if (!recordingId || typeof recordingId !== 'string') {
      throw new Error(`无效的 recording_id: ${String(recordingId)}`)
    }

    return client.post<{ analysis_id: string; status: string; message: string }>(
      `/v1/meetings/${meetingId}/analyze`,
      { data: { recording_id: recordingId } },
    )
  },

  getAnalysisStatus: (analysisId: string) =>
    client.get<AnalysisStatusResponse>(`/v1/analysis/${analysisId}/status`),

  getSummary: (meetingId: string) => client.get<Summary>(`/v1/meetings/${meetingId}/summary`),

  createSlides: (meetingId: string) =>
    client.post<{ slides_id: string; status: string; message: string }>(
      `/v1/meetings/${meetingId}/slides`,
    ),

  getSlidesStatus: (meetingId: string) =>
    client.get<SlidesStatus>(`/v1/meetings/${meetingId}/slides/status`),

  getSlidesMarkdown: (meetingId: string) =>
    client.get<{ markdown: string }>(`/v1/meetings/${meetingId}/slides/markdown`),

  updateSlidesMarkdown: (meetingId: string, markdown: string) =>
    client.post<{ slides_id: string; status: string; message: string }>(
      `/v1/meetings/${meetingId}/slides/markdown`,
      { data: { markdown } },
    ),

  getSlidesImages: (meetingId: string) =>
    client.get<{ images: string[] }>(`/v1/meetings/${meetingId}/slides/images`),

  getSlidesBackgrounds: (meetingId: string) =>
    client.get<{ global_id?: string | null; slides?: Record<string, string | null> }>(
      `/v1/meetings/${meetingId}/slides/backgrounds`,
    ),

  updateSlidesBackgrounds: (
    meetingId: string,
    payload: { global_id?: string | null; slides?: Record<string, string | null> },
  ) => client.post(`/v1/meetings/${meetingId}/slides/backgrounds`, { data: payload }),

  getSlidesLogs: (meetingId: string) =>
    client.get<{ log: string }>(`/v1/meetings/${meetingId}/slides/logs`),

  getSlidesExportExists: (meetingId: string) =>
    client.get<{ pdf: boolean; pptx: boolean }>(`/v1/meetings/${meetingId}/slides/export/exists`),

  recommendBackgrounds: (meetingId: string) =>
    client.post<{ assets: Array<Record<string, unknown>> }>(
      `/v1/meetings/${meetingId}/slides/backgrounds/recommend`,
    ),

  listPptBackgrounds: (source?: 'preset' | 'upload') =>
    client.get<{ assets: Array<Record<string, unknown>> }>('/v1/ppt-backgrounds', {
      params: source ? { source } : undefined,
    }),

  uploadPptBackground: (formData: FormData) =>
    client.upload<{ asset: Record<string, unknown> }>('/v1/ppt-backgrounds/upload', formData),
})
