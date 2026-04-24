import { request } from '@/libs/request'
import type { Agent, AgentCreate, AgentUpdate } from '@/interfaces'

const api = request()

export async function listAgents() {
  return api.get<Agent[]>('/v1/agents')
}

export async function createAgent(data: AgentCreate) {
  return api.post<Agent>('/v1/agents', { data })
}

export async function updateAgent(agentId: string, data: AgentUpdate) {
  return api.put<Agent>(`/v1/agents/${agentId}`, { data })
}

export async function deleteAgent(agentId: string) {
  return api.delete<{ success: boolean }>(`/v1/agents/${agentId}`)
}
