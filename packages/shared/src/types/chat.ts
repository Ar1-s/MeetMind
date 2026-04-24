export interface Chat {
  id: string
  title: string
  updated_at: string
  agent_id?: string | null
}

export interface ChatMessage {
  id: string
  role: string
  content: string
  component_data?: Record<string, unknown> | null
  created_at: string
}

export interface ChatDetail extends Chat {
  messages: ChatMessage[]
}

export interface ChatCreate {
  title?: string
  agent_id?: string | null
}

export interface ChatUpdate {
  title?: string
  agent_id?: string | null
}
