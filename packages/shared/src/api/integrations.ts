import type { ApiClient } from './client'
import type {
  MeetingCalendarEvent,
  EmailDraftRequest,
  EmailSendRequest,
  EmailDraft,
} from '../types'

export const createIntegrationsApi = (client: ApiClient) => ({
  getCalendarEvents: (meetingId: string) =>
    client.get<{ events: MeetingCalendarEvent[] }>(
      `/v1/meetings/${meetingId}/calendar/events`,
    ),

  downloadIcs: (meetingId: string) =>
    client.get<Blob>(`/v1/meetings/${meetingId}/calendar/ics`),

  generateEmailDraft: (meetingId: string, data?: EmailDraftRequest) =>
    client.post<EmailDraft>(`/v1/meetings/${meetingId}/email/draft`, { data }),

  sendEmail: (meetingId: string, data: EmailSendRequest) =>
    client.post<{ status: string; recipients: string[] }>(
      `/v1/meetings/${meetingId}/email/send`,
      { data },
    ),

  getCalendarSubscribeUrl: () =>
    client.get<{ webcal_url: string }>('/v1/calendar/subscribe'),
})
