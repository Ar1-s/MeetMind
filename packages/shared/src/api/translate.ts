import type { ApiClient } from './client'

export const createTranslateApi = (client: ApiClient) => ({
  translate: (params: {
    text: string
    source_lang?: string
    target_lang: string
    enhance?: boolean
  }) =>
    client.post<{ translation: string; detected_language?: string }>('/v1/translate', {
      data: params,
    }),
})
