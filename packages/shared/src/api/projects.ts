import type { ApiClient } from './client'
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  Objective,
  ObjectiveCreate,
  ObjectiveUpdate,
  KeyResult,
  KeyResultCreate,
  KeyResultUpdate,
} from '../types'

export const createProjectsApi = (client: ApiClient) => ({
  list: () =>
    client.get<Project[]>('/v1/projects'),

  create: (data: ProjectCreate) =>
    client.post<Project>('/v1/projects', { data }),

  update: (projectId: string, data: ProjectUpdate) =>
    client.patch<Project>(`/v1/projects/${projectId}`, { data }),

  delete: (projectId: string) =>
    client.delete<void>(`/v1/projects/${projectId}`),

  createFromMeeting: (meetingId: string) =>
    client.post<Project>('/v1/projects/from-meeting', { data: { meeting_id: meetingId } }),

  // Objectives
  createObjective: (projectId: string, data: ObjectiveCreate) =>
    client.post<Objective>(`/v1/projects/${projectId}/objectives`, { data }),

  updateObjective: (objectiveId: string, data: ObjectiveUpdate) =>
    client.patch<Objective>(`/v1/projects/objectives/${objectiveId}`, { data }),

  deleteObjective: (objectiveId: string) =>
    client.delete<void>(`/v1/projects/objectives/${objectiveId}`),

  // Key results
  createKeyResult: (objectiveId: string, data: KeyResultCreate) =>
    client.post<KeyResult>(`/v1/projects/objectives/${objectiveId}/key-results`, { data }),

  updateKeyResult: (keyResultId: string, data: KeyResultUpdate) =>
    client.patch<KeyResult>(`/v1/projects/key-results/${keyResultId}`, { data }),

  deleteKeyResult: (keyResultId: string) =>
    client.delete<void>(`/v1/projects/key-results/${keyResultId}`),
})
