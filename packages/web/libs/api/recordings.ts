import { request } from '@/libs/request'
import type { Recording } from '@/interfaces'

const api = request()

export type UploadProgressHandler = (progress: number) => void

export interface ImportRecordingResponse extends Recording {
  imported_at?: string
}

export async function getMeetingRecordings(meetingId: string) {
  return api.get<{ recordings: Recording[] }>(`/v1/recordings/meetings/${meetingId}`)
}

export async function deleteRecording(recordingId: string) {
  return api.delete<void>(`/v1/recordings/${recordingId}`)
}

const normalizeBasePath = (value?: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return '/api'
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

const joinUrl = (base: string, path: string) => {
  if (!base) return path
  if (base.endsWith('/') && path.startsWith('/')) return `${base}${path.slice(1)}`
  if (!base.endsWith('/') && !path.startsWith('/')) return `${base}/${path}`
  return `${base}${path}`
}

const resolveUploadUrl = (path: string) => {
  const directBase = (process.env.NEXT_PUBLIC_DIRECT_API_URL || '').trim()
  const base = normalizeBasePath(directBase || process.env.NEXT_PUBLIC_PROD_API_PATH)
  return joinUrl(base, path)
}

const uploadRecordingWithProgress = (
  meetingId: string,
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<ImportRecordingResponse> =>
  new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('storage_preference', 'local')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', resolveUploadUrl(`/v1/recordings/meetings/${meetingId}/import`), true)
    xhr.withCredentials = true

    const token = window.localStorage.getItem('access_token')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return
      const progress = Math.round((event.loaded / event.total) * 100)
      onProgress?.(Math.min(progress, 99))
    }

    xhr.onerror = () => {
      reject(new Error('网络错误，上传失败'))
    }

    xhr.onload = () => {
      let data: any = {}
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        data = {}
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve(data as ImportRecordingResponse)
        return
      }

      reject(new Error(data?.detail || data?.message || `上传失败 (${xhr.status})`))
    }

    xhr.send(formData)
  })

export async function importRecording(
  meetingId: string,
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<ImportRecordingResponse> {
  if (typeof window !== 'undefined') {
    return uploadRecordingWithProgress(meetingId, file, onProgress)
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('storage_preference', 'local')

  return api.fetch<ImportRecordingResponse>(`/v1/recordings/meetings/${meetingId}/import`, {
    method: 'POST',
    data: formData,
  })
}
