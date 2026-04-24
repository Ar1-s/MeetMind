import type { Participant } from './meeting'
import type { Recording, Summary } from './recording'

export interface MeetingDetail {
  meeting: {
    meeting_id: string
    title: string
    start_time?: string
    end_time?: string
    timezone: string
    participants: Participant[]
    anonymize_participants?: boolean
    participant_aliases?: Record<string, string>
    tags: string[]
    project_id?: string
    source: string
    created_by?: string
    workspace_id?: string
    created_at: string
    updated_at?: string
  }
  recordings: Recording[]
  summary?: Summary
}
