import type { ApiClient } from './client'
import type {
  AssistantChatRequest,
  AssistantResponse,
  ToolSchema,
  SuggestionsResponse,
} from '../types'

export const createAssistantApi = (client: ApiClient) => ({
  chat: (data: AssistantChatRequest) =>
    client.post<AssistantResponse>('/v1/assistant/chat', { data }),

  getTools: () => client.get<{ tools: ToolSchema[] }>('/v1/assistant/tools'),

  getSuggestions: () =>
    client.get<SuggestionsResponse>('/v1/assistant/suggestions'),
})
