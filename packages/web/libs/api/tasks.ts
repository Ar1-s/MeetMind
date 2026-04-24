import { request } from '@/libs/request'
import type { TaskBoardResponse, Task, TaskCreate, TaskUpdate } from '@/interfaces'

const api = request()

export async function getTaskBoard(params?: {
  view?: string
  assignee?: string
  status?: string
  priority?: string
  meeting_id?: string
}): Promise<TaskBoardResponse> {
  return api.get<TaskBoardResponse>('/v1/tasks/board', { params })
}

export async function createTask(data: TaskCreate): Promise<Task> {
  return api.post<Task>('/v1/tasks', { data })
}

export async function updateTask(taskId: string, data: TaskUpdate): Promise<Task> {
  return api.patch<Task>(`/v1/tasks/${taskId}`, { data })
}

export async function completeTask(
  taskId: string,
  data: { result_description?: string },
): Promise<Task> {
  return api.post<Task>(`/v1/tasks/${taskId}/complete`, { data })
}

export async function deleteTask(taskId: string): Promise<void> {
  return api.delete<void>(`/v1/tasks/${taskId}`)
}

export async function getRelatedTasks(params: { project_id: string; exclude_meeting_id?: string }) {
  return api.get<any[]>('/v1/tasks/related', { params })
}

export async function completeTasks(taskIds: string[]) {
  await Promise.all(taskIds.map(taskId => completeTask(taskId, {})))
}
