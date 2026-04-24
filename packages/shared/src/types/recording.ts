export interface Recording {
  id: string
  meeting_id: string
  type: 'live' | 'import'
  storage: 'local' | 'cloud' | 'both'
  audio_uri?: string
  duration: number
  file_size: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

export interface Summary {
  summary_id: string
  meeting_id: string
  abstract?: string
  decisions: string[]
  risks: string[]
  action_items: ActionItem[]
  mindmap?: MindmapData
  mindmap_image?: string
  transcript?: TranscriptSegment[]
  sentiment_score?: number
  emotion_flags?: string[]
  model_version?: string
  created_at: string
  updated_at?: string
}

export interface ActionItem {
  title: string
  assignee?: string
  due_date?: string
  priority: 'high' | 'medium' | 'low'
  source_segment_start?: number
  source_segment_end?: number
}

export interface TranscriptSegment {
  start: number
  end: number
  speaker: string
  text: string
  confidence?: number
}

export interface MindmapNode {
  id: string
  type: 'topic' | 'subtopic' | 'detail'
  label: string
  description?: string
  parent_id?: string | null
}

export interface MindmapData {
  type: 'reactflow'
  nodes: MindmapNode[]
}
