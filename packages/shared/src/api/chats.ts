import type { ApiClient } from './client'
import type { Chat, ChatDetail, ChatCreate, ChatUpdate } from '../types'

export const createChatsApi = (client: ApiClient) => ({
  list: () => client.get<Chat[]>('/v1/chats'),

  create: (data?: ChatCreate) => client.post<Chat>('/v1/chats', { data }),

  get: (chatId: string) => client.get<ChatDetail>(`/v1/chats/${chatId}`),

  update: (chatId: string, data: ChatUpdate) =>
    client.patch<Chat>(`/v1/chats/${chatId}`, { data }),

  delete: (chatId: string) =>
    client.delete<{ success: boolean }>(`/v1/chats/${chatId}`),
})
