import type { ApiClient } from './client'
import type { UserPreferences, UserPreferencesUpdate } from '../types'

export const createPreferencesApi = (client: ApiClient) => ({
  get: () => client.get<UserPreferences>('/v1/preferences'),

  update: (data: UserPreferencesUpdate) =>
    client.patch<UserPreferences>('/v1/preferences', { data }),
})
