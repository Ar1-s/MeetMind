export interface User {
  user_id: string
  username: string
  email: string
  display_name?: string
  avatar_url?: string
  calendar_token?: string
}

export interface AuthResponse {
  access_token: string
  user: User
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  display_name?: string
}
