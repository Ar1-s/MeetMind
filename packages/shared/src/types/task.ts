export interface SourceMeeting {
  meeting_id: string
  title: string
  date?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  assignee?: string
  due_date?: string
  priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  source_meeting?: SourceMeeting
  key_result_id?: string | null
  okr?: {
    project_id: string
    project_name: string
    objective_id: string
    objective_title: string
    key_result_id: string
    key_result_title: string
    progress: number
  }
  source_segment_start?: number
  source_segment_end?: number
  created_at: string
  updated_at?: string
  completed_at?: string
}

export interface TaskStatistics {
  total_tasks: number
  todo_count: number
  in_progress_count: number
  done_count: number
  overdue_count: number
}

export interface TaskBoardResponse {
  tasks: Task[]
  statistics: TaskStatistics
}

export interface TaskCreate {
  title: string
  description?: string
  assignee?: string
  due_date?: string
  priority?: 'high' | 'medium' | 'low'
  source_meeting_id?: string
  key_result_id?: string | null
  source_segment_start?: number
  source_segment_end?: number
}

export interface TaskUpdate {
  title?: string
  description?: string
  assignee?: string
  due_date?: string
  priority?: 'high' | 'medium' | 'low'
  status?: 'todo' | 'in_progress' | 'done' | 'blocked'
  key_result_id?: string | null
  source_segment_start?: number
  source_segment_end?: number
}
