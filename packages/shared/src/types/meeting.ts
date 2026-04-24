export interface Participant {
  name: string
  email?: string
  role?: string
}

export interface Meeting {
  meeting_id?: string
  id: string
  title: string
  start_time?: string
  end_time?: string
  timezone: string
  participants: Participant[]
  anonymize_participants?: boolean
  participant_aliases?: Record<string, string>
  tags: string[]
  project_id?: string
  source: 'manual' | 'calendar_import'
  created_by?: string
  workspace_id?: string
  created_at: string
  updated_at?: string
}

export interface MeetingListItem {
  id: string
  title: string
  start_time?: string
  end_time?: string
  participants_count: number
  has_recording: boolean
  has_summary: boolean
  tags: string[]
}

export interface MeetingListResponse {
  meetings: MeetingListItem[]
  pagination: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface MeetingCreate {
  title: string
  start_time?: string
  end_time?: string
  timezone?: string
  participants?: Participant[]
  anonymize_participants?: boolean
  tags?: string[]
  project_id?: string
  source?: string
}
