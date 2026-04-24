import {
  createApiClient,
  createAuthApi,
  createMeetingsApi,
  createTasksApi,
  createProjectsApi,
  createAnalysisApi,
  createCalendarApi,
  createTranslateApi,
  createMemoryApi,
  createMindmapApi,
  createRecordingsApi,
  createAgentsApi,
  createChatsApi,
  createAssistantApi,
  createIntegrationsApi,
  createCalendarFeedApi,
  createPreferencesApi,
} from '@meetmind/shared'
import { storage } from './storage'
import Constants from 'expo-constants'

// Expo inlines EXPO_PUBLIC_* values at bundle time.
// Local development reads packages/mobile/.env, while EAS cloud builds should
// provide EXPO_PUBLIC_API_URL through the selected EAS environment.
const FALLBACK_API_URL = 'http://localhost:3452/api'

const getHostBasedApiUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.platform?.hostUri ?? null

  if (!hostUri) return null

  const host = hostUri.split(':')[0]?.trim()
  if (!host) return null

  return `http://${host}:3452/api`
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl

export const API_BASE_URL =
  configuredApiUrl && configuredApiUrl !== FALLBACK_API_URL
    ? configuredApiUrl
    : getHostBasedApiUrl() ?? configuredApiUrl ?? FALLBACK_API_URL

const client = createApiClient(API_BASE_URL, storage.getToken)

export const authApi = createAuthApi(client)
export const meetingsApi = createMeetingsApi(client)
export const tasksApi = createTasksApi(client)
export const projectsApi = createProjectsApi(client)
export const analysisApi = createAnalysisApi(client)
export const calendarApi = createCalendarApi(client)
export const translateApi = createTranslateApi(client)
export const memoryApi = createMemoryApi(client)
export const mindmapApi = createMindmapApi(client)
export const recordingsApi = createRecordingsApi(client)
export const agentsApi = createAgentsApi(client)
export const chatsApi = createChatsApi(client)
export const assistantApi = createAssistantApi(client)
export const integrationsApi = createIntegrationsApi(client)
export const calendarFeedApi = createCalendarFeedApi(client)
export const preferencesApi = createPreferencesApi(client)
