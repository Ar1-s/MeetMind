import { request } from '@/libs/request'
import type { Chat, ChatDetail, ChatCreate, ChatUpdate } from '@/interfaces'

const api = request()

export async function listChats() {
  return api.get<Chat[]>('/v1/chats')
}

export async function createChat(data?: ChatCreate) {
  return api.post<Chat>('/v1/chats', { data })
}

export async function getChat(chatId: string) {
  return api.get<ChatDetail>(`/v1/chats/${chatId}`)
}

export async function updateChat(chatId: string, data: ChatUpdate) {
  return api.patch<Chat>(`/v1/chats/${chatId}`, { data })
}

export async function deleteChat(chatId: string) {
  return api.delete<{ success: boolean }>(`/v1/chats/${chatId}`)
}
