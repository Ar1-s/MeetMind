export interface Agent {
  id: string
  name: string
  description?: string | null
  prompt: string
  is_default: boolean
}

export interface AgentCreate {
  name: string
  description?: string | null
  prompt: string
}

export interface AgentUpdate {
  name?: string
  description?: string | null
  prompt?: string
}
