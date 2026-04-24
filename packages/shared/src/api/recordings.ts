import type { ApiClient } from './client'
import type { Recording } from '../types'

export interface ImportRecordingResponse extends Recording {
  imported_at?: string
}

export const createRecordingsApi = (client: ApiClient) => ({
  list: (meetingId: string) =>
    client.get<{ recordings: Recording[] }>(`/v1/recordings/meetings/${meetingId}`),

  import: (meetingId: string, formData: FormData) =>
    client.upload<ImportRecordingResponse>(`/v1/recordings/meetings/${meetingId}/import`, formData),

  delete: (recordingId: string) => client.delete<void>(`/v1/recordings/${recordingId}`),
})
