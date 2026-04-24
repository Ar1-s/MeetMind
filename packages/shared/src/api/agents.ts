import type { ApiClient } from './client'
import type { Agent, AgentCreate, AgentUpdate } from '../types'

export const createAgentsApi = (client: ApiClient) => ({
  list: () => client.get<Agent[]>('/v1/agents'),

  create: (data: AgentCreate) => client.post<Agent>('/v1/agents', { data }),

  update: (agentId: string, data: AgentUpdate) =>
    client.put<Agent>(`/v1/agents/${agentId}`, { data }),

  delete: (agentId: string) =>
    client.delete<{ success: boolean }>(`/v1/agents/${agentId}`),
})
