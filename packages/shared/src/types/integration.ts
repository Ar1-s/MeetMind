export interface MeetingCalendarEvent {
  title: string
  start_time: string
  end_time: string
  description: string
  attendees: string[]
}

export interface EmailDraftRequest {
  template?: string
  recipients?: string[]
}

export interface EmailSendRequest {
  template?: string
  recipients: string[]
  subject?: string
  body?: string
}

export interface EmailDraft {
  subject: string
  body: string
  recipients: string[]
  template: string
}
