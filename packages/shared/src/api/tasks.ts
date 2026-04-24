import type { ApiClient } from './client'
import type { Task, TaskBoardResponse, TaskCreate, TaskUpdate } from '../types'

export const createTasksApi = (client: ApiClient) => ({
  board: (params?: {
    view?: string
    assignee?: string
    status?: string
    priority?: string
    meeting_id?: string
  }) => client.get<TaskBoardResponse>('/v1/tasks/board', { params }),

  create: (data: TaskCreate) =>
    client.post<Task>('/v1/tasks', { data }),

  update: (taskId: string, data: TaskUpdate) =>
    client.patch<Task>(`/v1/tasks/${taskId}`, { data }),

  complete: (taskId: string, data?: { result_description?: string }) =>
    client.post<Task>(`/v1/tasks/${taskId}/complete`, { data: data ?? {} }),

  delete: (taskId: string) =>
    client.delete<void>(`/v1/tasks/${taskId}`),
})
