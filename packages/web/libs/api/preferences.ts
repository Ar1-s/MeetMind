import { request } from '@/libs/request'
import type { UserPreferences, UserPreferencesUpdate } from '@/interfaces'

const api = request()

export async function getPreferences() {
  return api.get<UserPreferences>('/v1/preferences')
}

export async function updatePreferences(data: UserPreferencesUpdate) {
  return api.patch<UserPreferences>('/v1/preferences', { data })
}
