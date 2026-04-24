import { request } from '@/libs/request'
import type {
  AssistantChatRequest,
  AssistantResponse,
  ToolSchema,
  SuggestionsResponse,
} from '@/interfaces'

const api = request()

export async function sendAssistantChat(data: AssistantChatRequest) {
  return api.post<AssistantResponse>('/v1/assistant/chat', { data })
}

export async function getAssistantTools() {
  return api.get<{ tools: ToolSchema[] }>('/v1/assistant/tools')
}

export async function getAssistantSuggestions() {
  return api.get<SuggestionsResponse>('/v1/assistant/suggestions')
}
