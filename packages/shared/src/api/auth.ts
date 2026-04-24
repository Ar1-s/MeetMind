import type { ApiClient } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types'

export const createAuthApi = (client: ApiClient) => ({
  login: (data: LoginRequest) =>
    client.post<AuthResponse>('/v1/auth/login', { data }),

  register: (data: RegisterRequest) =>
    client.post<AuthResponse>('/v1/auth/register', { data }),

  getCurrentUser: () =>
    client.get<User>('/v1/auth/me'),
})
