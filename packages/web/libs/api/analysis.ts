import { request } from '@/libs/request'

const api = request()

export interface AnalysisStatusResponse {
  status: string
  progress: number
  message?: string
  stage?: string
  steps?: Array<{ label: string; progress: number }>
  eta_seconds?: number
}

export async function startAnalysis(meetingId: string, recordingId: string) {
  if (!recordingId || typeof recordingId !== 'string') {
    throw new Error(`无效的 recording_id: ${String(recordingId)}`)
  }
  return api.post<{ analysis_id: string; status: string; message: string }>(
    `/v1/meetings/${meetingId}/analyze`,
    { data: { recording_id: recordingId } },
  )
}

export async function getAnalysisStatus(analysisId: string) {
  return api.get<AnalysisStatusResponse>(`/v1/analysis/${analysisId}/status`)
}

export async function getMeetingSummary(meetingId: string) {
  return api.get<{
    summary_id: string
    meeting_id: string
    abstract: string
    decisions: string[]
    risks: string[]
    action_items: Array<{
      title: string
      assignee?: string
      due_date?: string
      priority: string
    }>
    mindmap?: {
      type: string
      content: string
    }
    transcript: Array<{
      start: number
      end: number
      speaker: string
      text: string
    }>
    sentiment_score?: number
    emotion_flags?: string[]
    model_version?: string
    created_at: string
    updated_at?: string
  }>(`/v1/meetings/${meetingId}/summary`)
}

export async function createMeetingSlides(meetingId: string, theme?: string) {
  return api.post<{ slides_id: string; status: string; message: string }>(
    `/v1/meetings/${meetingId}/slides`,
    { data: theme ? { theme } : undefined },
  )
}

export async function getMeetingSlidesStatus(meetingId: string) {
  return api.get<{
    status: string
    progress: number
    message: string
    preview_url?: string
    export_urls?: {
      pdf?: string
      pptx?: string
    }
    image_urls?: string[]
    log_url?: string
  }>(`/v1/meetings/${meetingId}/slides/status`)
}

export async function getMeetingSlidesLogs(meetingId: string) {
  return api.get<{ log: string }>(`/v1/meetings/${meetingId}/slides/logs`)
}

export async function getMeetingSlidesMarkdown(meetingId: string) {
  return api.get<{ markdown: string }>(`/v1/meetings/${meetingId}/slides/markdown`)
}

export async function updateMeetingSlidesMarkdown(meetingId: string, markdown: string) {
  return api.post<{ slides_id: string; status: string; message: string }>(
    `/v1/meetings/${meetingId}/slides/markdown`,
    { data: { markdown } },
  )
}

export async function getMeetingSlidesExportExists(meetingId: string) {
  return api.get<{ pdf: boolean; pptx: boolean }>(`/v1/meetings/${meetingId}/slides/export/exists`)
}

export async function getMeetingSlidesImages(meetingId: string) {
  return api.get<{ images: string[] }>(`/v1/meetings/${meetingId}/slides/images`)
}

export async function listPptBackgroundPresets() {
  return api.get<{ assets: Array<Record<string, any>> }>(`/v1/ppt-backgrounds?source=preset`)
}

export async function listPptBackgroundUploads() {
  return api.get<{ assets: Array<Record<string, any>> }>(`/v1/ppt-backgrounds?source=upload`)
}

export async function uploadPptBackground(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return api.fetch<{ asset: Record<string, any> }>(`/v1/ppt-backgrounds/upload`, {
    method: 'POST',
    data: formData,
  })
}

export async function getMeetingSlidesBackgrounds(meetingId: string) {
  return api.get<{ global_id?: string | null; slides?: Record<string, string | null> }>(
    `/v1/meetings/${meetingId}/slides/backgrounds`,
  )
}

export async function updateMeetingSlidesBackgrounds(
  meetingId: string,
  payload: { global_id?: string | null; slides?: Record<string, string | null> },
) {
  return api.post(`/v1/meetings/${meetingId}/slides/backgrounds`, { data: payload })
}

export async function recommendMeetingSlidesBackgrounds(meetingId: string) {
  return api.post<{ assets: Array<Record<string, any>> }>(
    `/v1/meetings/${meetingId}/slides/backgrounds/recommend`,
  )
}
