const isBrowser = typeof window !== 'undefined'
const AUTH_STORAGE_KEY = 'auth-storage'

const isAuthErrorResponse = (status: number, data: any) => {
  if (status === 401) return true

  const message = String(data?.detail || data?.message || '').toLowerCase()
  return (
    message.includes('invalid or expired token') ||
    message.includes('token expired') ||
    message.includes('invalid token') ||
    message.includes('not authenticated') ||
    message.includes('unauthorized')
  )
}

const clearBrowserAuthState = () => {
  if (!isBrowser) return

  try {
    window.localStorage.removeItem('access_token')
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {}
}

const redirectToLogin = () => {
  if (!isBrowser) return false

  const path = window.location.pathname
  if (path.startsWith('/login') || path.startsWith('/register')) {
    return false
  }

  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
  window.location.replace(`/login?next=${next}`)
  return true
}

const normalizeBaseUrl = (value?: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

const resolveBaseUrl = () => {
  if (isBrowser) {
    const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_PROD_API_PATH)
    return envBase || '/api'
  }
  return normalizeBaseUrl(process.env.INTERNAL_API_URL)
}

const baseUrl = resolveBaseUrl()

const joinUrl = (base: string, path: string) => {
  if (!base) return path
  if (base.endsWith('/') && path.startsWith('/')) return `${base}${path.slice(1)}`
  if (!base.endsWith('/') && !path.startsWith('/')) return `${base}/${path}`
  return `${base}${path}`
}

const normalizeParams = (params?: Record<string, any>) => {
  if (!params) return ''

  const entries = Object.entries(params).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return []
    }

    if (Array.isArray(value)) {
      return value
        .filter(item => item !== undefined && item !== null && item !== '')
        .map(item => [key, String(item)] as [string, string])
    }

    return [[key, String(value)] as [string, string]]
  })

  return entries.length > 0 ? new URLSearchParams(entries).toString() : ''
}

export const request = () => {
  const basicFetch = async <T>(
    path: string,
    options: RequestInit,
    params?: Record<string, any>,
  ): Promise<T> => {
    const init = async (): Promise<RequestInit> => {
      const headers = new Headers(await buildHeaders(options))
      if (!isBrowser) {
        const { cookies, headers: nextHeaders } = await import('next/headers')
        const cookieString = (await cookies()).toString()
        if (cookieString) headers.set('Cookie', cookieString)
        try {
          const incoming = await nextHeaders()
          const realIp =
            incoming.get('cf-connecting-ip') ||
            incoming.get('x-forwarded-for')?.split(',')[0]?.trim()
          if (realIp) headers.set('x-real-ip', realIp)
        } catch {}
      }
      // if body is FormData, we will not manually set Content-Type so browser can set boundary.
      const opt: RequestInit = { ...options, headers, credentials: 'include' }
      const maybeBody: any = (opt as any).body
      if (maybeBody instanceof FormData) {
        headers.delete('Content-Type')
      }
      return opt
    }
    const reqUrl = () => {
      const query = normalizeParams(params)
      return `${joinUrl(baseUrl, path)}${query ? `?${query}` : ''}`
    }

    const requestOnce = async (): Promise<T> => {
      const opt = await init()
      const res = await fetch(reqUrl(), opt)
      const data = (await res.json().catch(() => ({}))) as any

      if (!res.ok) {
        if (isBrowser && isAuthErrorResponse(res.status, data)) {
          clearBrowserAuthState()
          if (redirectToLogin()) {
            return await new Promise<T>(() => {})
          }
        }

        throw new Error(data?.detail || data?.message || 'Request failed')
      }

      return data as T
    }

    const data = await requestOnce()
    return data
  }

  const get = async <T>(
    path: string,
    config?: { params?: Record<string, any>; options?: RequestInit },
  ): Promise<T> => {
    return await basicFetch<T>(
      path,
      {
        method: 'GET',
        ...config?.options,
      },
      config?.params,
    )
  }
  const post = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<T> => {
    return await basicFetch<T>(
      path,
      {
        method: 'POST',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }
  const put = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<T> => {
    return await basicFetch<T>(
      path,
      {
        method: 'PUT',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }
  const _delete = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<T> => {
    return await basicFetch<T>(
      path,
      {
        method: 'DELETE',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }
  const patch = async <T>(
    path: string,
    config?: { data?: Record<string, any>; params?: Record<string, any>; options?: RequestInit },
  ): Promise<T> => {
    return await basicFetch<T>(
      path,
      {
        method: 'PATCH',
        body: config?.data ? JSON.stringify(config.data) : undefined,
        ...config?.options,
      },
      config?.params,
    )
  }

  const _fetch = async <T>(
    path: string,
    config?: {
      method: string
      data?: any
      params?: Record<string, any>
      options?: RequestInit
    },
  ): Promise<T> => {
    return await basicFetch<T>(
      path,
      {
        method: config?.method,
        body: config?.data,
        ...config?.options,
      },
      config?.params,
    )
  }

  return {
    get,
    post,
    put,
    delete: _delete,
    patch,
    fetch: _fetch,
  }
}

const buildHeaders = async (options?: RequestInit): Promise<HeadersInit> => {
  const existing = options?.headers
  let headersObj: Record<string, string> = {}

  if (existing instanceof Headers) {
    existing.forEach((v, k) => {
      headersObj[k] = v
    })
  } else if (Array.isArray(existing)) {
    existing.forEach(([k, v]) => {
      headersObj[k] = v
    })
  } else {
    headersObj = { ...(existing as Record<string, string> | undefined) }
  }

  if (!headersObj['Content-Type']) {
    headersObj['Content-Type'] = 'application/json'
  }

  // Client-side authentication
  if (isBrowser) {
    const token = localStorage.getItem('access_token')
    if (token && !headersObj['Authorization']) {
      headersObj['Authorization'] = `Bearer ${token}`
    }
  }

  return headersObj
}