import { request } from '@/libs/request'

const api = request()

export async function translateText(params: {
  text: string
  source_lang?: string
  target_lang: string
  enhance?: boolean
}) {
  return api.post<{
    translation: string
    detected_language?: string
  }>('/v1/translate', { data: params })
}
