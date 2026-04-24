export interface ApiResponse<T> {
  data?: T
  error?: ApiError
  success: boolean
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, unknown>
}
