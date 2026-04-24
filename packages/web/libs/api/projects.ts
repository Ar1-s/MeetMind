import { request } from '@/libs/request'
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
} from '@/interfaces'

const api = request()

export async function getProjects(): Promise<Project[]> {
  return api.get<Project[]>('/v1/projects')
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  return api.post<Project>('/v1/projects', { data })
}

export async function updateProject(projectId: string, data: ProjectUpdate): Promise<Project> {
  return api.patch<Project>(`/v1/projects/${projectId}`, { data })
}

export async function deleteProject(projectId: string): Promise<void> {
  return api.delete<void>(`/v1/projects/${projectId}`)
}

export async function createProjectFromMeeting(meetingId: string): Promise<Project> {
  return api.post<Project>('/v1/projects/from-meeting', { data: { meeting_id: meetingId } })
}

export async function createObjective(
  projectId: string,
  data: ObjectiveCreate,
): Promise<Objective> {
  return api.post<Objective>(`/v1/projects/${projectId}/objectives`, { data })
}

export async function updateObjective(
  objectiveId: string,
  data: ObjectiveUpdate,
): Promise<Objective> {
  return api.patch<Objective>(`/v1/projects/objectives/${objectiveId}`, { data })
}

export async function deleteObjective(objectiveId: string): Promise<void> {
  return api.delete<void>(`/v1/projects/objectives/${objectiveId}`)
}

export async function createKeyResult(
  objectiveId: string,
  data: KeyResultCreate,
): Promise<KeyResult> {
  return api.post<KeyResult>(`/v1/projects/objectives/${objectiveId}/key-results`, { data })
}

export async function updateKeyResult(
  keyResultId: string,
  data: KeyResultUpdate,
): Promise<KeyResult> {
  return api.patch<KeyResult>(`/v1/projects/key-results/${keyResultId}`, { data })
}

export async function deleteKeyResult(keyResultId: string): Promise<void> {
  return api.delete<void>(`/v1/projects/key-results/${keyResultId}`)
}
