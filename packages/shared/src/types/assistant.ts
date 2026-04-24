export interface AssistantChatRequest {
  instruction: string
  history?: Array<Record<string, unknown>>
  conversation_id?: string
  agent?: Record<string, unknown>
  agent_id?: string
}

export interface AssistantResponse {
  type: string
  message: string
  suggestions: string[]
  component_data?: Record<string, unknown>
}

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface SuggestionsResponse {
  suggestions: string[]
}
