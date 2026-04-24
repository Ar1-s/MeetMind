import { request } from '@/libs/request'

const api = request()

export async function getCalendarEvents(meetingId: string) {
  return api.get<{
    events: Array<{
      title: string
      start_time: string
      end_time: string
      description: string
      attendees: string[]
    }>
  }>(`/v1/meetings/${meetingId}/calendar/events`)
}

export async function downloadIcs(meetingId: string) {
  const headers: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('access_token')
      if (token) headers['Authorization'] = `Bearer ${token}`
    } catch {
      // localStorage may be unavailable in some environments
    }
  }
  const response = await fetch(`/api/v1/meetings/${meetingId}/calendar/ics`, {
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    let message = '下载失败'
    try {
      const data = await response.json()
      message = data?.detail || data?.message || message
    } catch {
      message = `${message} (${response.status})`
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meeting_${meetingId}.ics`
  a.click()
  window.URL.revokeObjectURL(url)
}

export async function generateEmailDraft(
  meetingId: string,
  template: string = 'meeting_summary',
  recipients: string[] = [],
) {
  return api.post<{
    subject: string
    body: string
    recipients: string[]
    template: string
  }>(`/v1/meetings/${meetingId}/email/draft`, {
    data: { template, recipients },
  })
}

export async function sendEmail(
  meetingId: string,
  recipients: string[],
  subject?: string,
  body?: string,
  template: string = 'meeting_summary',
) {
  return api.post<{ status: string; recipients: string[] }>(
    `/v1/meetings/${meetingId}/email/send`,
    {
      data: { recipients, subject, body, template },
    },
  )
}

export async function getCalendarSubscribeUrl() {
  return api.get<{ webcal_url: string }>(`/v1/calendar/subscribe`)
}
