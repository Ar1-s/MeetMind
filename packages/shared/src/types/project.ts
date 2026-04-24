export interface KeyResult {
  id: string
  objective_id: string
  title: string
  current_value: number
  target_value: number
  unit?: string | null
  status: string
  progress: number
  linked_task_count: number
  completed_task_count: number
  progress_source: 'manual' | 'tasks'
  created_at: string
  updated_at?: string | null
}

export interface Objective {
  id: string
  project_id: string
  title: string
  description?: string | null
  status: string
  progress: number
  key_results: KeyResult[]
  created_at: string
  updated_at?: string | null
}

export interface Project {
  id: string
  name: string
  description?: string | null
  status: string
  start_date?: string | null
  end_date?: string | null
  progress: number
  objectives: Objective[]
  created_at: string
  updated_at?: string | null
}

export interface ProjectCreate {
  name: string
  description?: string | null
  status?: string
  start_date?: string | null
  end_date?: string | null
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
  status?: string
  start_date?: string | null
  end_date?: string | null
}

export interface ObjectiveCreate {
  title: string
  description?: string | null
  status?: string
}

export interface ObjectiveUpdate {
  title?: string
  description?: string | null
  status?: string
}

export interface KeyResultCreate {
  title: string
  current_value?: number
  target_value?: number
  unit?: string | null
  status?: string
}

export interface KeyResultUpdate {
  title?: string
  current_value?: number
  target_value?: number
  unit?: string | null
  status?: string
}
