import { request } from '@/libs/request'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/interfaces'

const api = request()

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/v1/auth/login', { data })
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/v1/auth/register', { data })
}

export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/v1/auth/me')
}
