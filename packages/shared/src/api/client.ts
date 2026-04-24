/**
 * Platform-agnostic API client.
 * Consumers inject baseUrl and a token getter to keep this free of platform deps.
 */

export type TokenGetter = () => Promise<string | null>

export interface RequestConfig {
  params?: Record<string, any>
  data?: any
  options?: Omit<RequestInit, 'method' | 'body'>
}

export interface ApiClient {
  get<T>(path: string, config?: Pick<RequestConfig, 'params' | 'options'>): Promise<T>
  post<T>(path: string, config?: RequestConfig): Promise<T>
  put<T>(path: string, config?: RequestConfig): Promise<T>
  patch<T>(path: string, config?: RequestConfig): Promise<T>
  delete<T>(path: string, config?: RequestConfig): Promise<T>
  /** Raw fetch — useful for FormData uploads */
  upload<T>(path: string, formData: FormData): Promise<T>
}

const joinUrl = (base: string, path: string) => {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

const buildQuery = (params?: Record<string, any>) => {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

export const createApiClient = (baseUrl: string, getToken: TokenGetter): ApiClient => {
  const buildHeaders = async (extra?: HeadersInit): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (extra instanceof Headers) {
      extra.forEach((value: string, key: string) => {
        headers[key] = value
      })
    } else if (Array.isArray(extra)) {
      extra.forEach(([key, value]) => {
        headers[key] = value
      })
    } else if (extra) {
      Object.assign(headers, extra)
    }
    return headers
  }

  const execute = async <T>(
    method: string,
    path: string,
    { params, data, options }: RequestConfig = {},
  ): Promise<T> => {
    const url = `${joinUrl(baseUrl, path)}${buildQuery(params)}`
    const headers = await buildHeaders(options?.headers)
    const res = await fetch(url, {
      ...options,
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = (json as any)?.detail
      const msg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null
      throw new Error(msg || (json as any)?.message || `Request failed: ${res.status}`)
    }
    return json as T
  }

  return {
    get: (path, config) => execute('GET', path, config),
    post: (path, config) => execute('POST', path, config),
    put: (path, config) => execute('PUT', path, config),
    patch: (path, config) => execute('PATCH', path, config),
    delete: (path, config) => execute('DELETE', path, config),

    upload: async <T>(path: string, formData: FormData): Promise<T> => {
      const url = joinUrl(baseUrl, path)
      const token = await getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      // Do NOT set Content-Type — let the runtime set multipart boundary
      const res = await fetch(url, { method: 'POST', headers, body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = (json as any)?.detail
        const msg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null
        throw new Error(msg || (json as any)?.message || `Upload failed: ${res.status}`)
      }
      return json as T
    },
  }
}
