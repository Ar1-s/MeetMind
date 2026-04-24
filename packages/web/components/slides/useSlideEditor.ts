'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  createMeetingSlides,
  getMeetingSlidesStatus,
  getMeetingSlidesLogs,
  getMeetingSlidesMarkdown,
  updateMeetingSlidesMarkdown,
  getMeetingSlidesExportExists,
  getMeetingSlidesImages,
  listPptBackgroundPresets,
  listPptBackgroundUploads,
  uploadPptBackground,
  getMeetingSlidesBackgrounds,
  updateMeetingSlidesBackgrounds,
  recommendMeetingSlidesBackgrounds,
} from '@/libs/api/analysis'
import { splitSlides, joinSlides, parseSlideSection, buildSlideSection, createBlankSlide } from './utils'

export type BackgroundAsset = {
  id: string
  name?: string
  url: string
  tags?: string[]
  source?: string
  author?: string
}

export interface SlidesStatus {
  status: string
  progress: number
  message: string
  preview_url?: string
  export_urls?: { pdf?: string; pptx?: string }
  image_urls?: string[]
}

function mergeExportReady(
  current: { pdf: boolean; pptx: boolean },
  next?: { pdf?: boolean | string; pptx?: boolean | string } | null,
) {
  return {
    pdf: current.pdf || Boolean(next?.pdf),
    pptx: current.pptx || Boolean(next?.pptx),
  }
}

export interface BackgroundConfig {
  global_id?: string | null
  slides: Record<string, string | null>
}

export type SlideTheme = 'default' | 'dark' | 'minimal' | 'corporate'

export interface UseSlideEditorReturn {
  // State
  sections: string[]
  markdown: string
  images: string[]
  activeIndex: number
  status: SlidesStatus | null
  loading: boolean
  error: string | null
  log: string
  logExpanded: boolean
  logLoading: boolean
  exportReady: { pdf: boolean; pptx: boolean }
  previewKey: number
  previewMode: 'pdf' | 'html' | 'image'
  mode: 'edit' | 'background'
  voiceListening: boolean
  contentEditorRef: React.MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>

  // Background state
  backgroundConfig: BackgroundConfig
  backgroundPresets: BackgroundAsset[]
  backgroundUploads: BackgroundAsset[]
  backgroundRecommended: BackgroundAsset[]
  backgroundAssetsAll: BackgroundAsset[]
  backgroundAssetMap: Record<string, BackgroundAsset>
  backgroundSource: 'preset' | 'upload' | 'recommend'
  backgroundLoading: boolean
  backgroundSaving: boolean
  backgroundUploading: boolean

  // Theme
  theme: SlideTheme
  setTheme: (theme: SlideTheme) => void

  // Undo/Redo
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  // Retry
  retryLastAction: () => Promise<void>

  // Derived
  busy: boolean
  slidesCount: number
  hasImagePreview: boolean
  hasPdfPreview: boolean
  hasHtmlPreview: boolean
  statusLabel: string
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary'
  markdownLoaded: boolean

  // Actions
  setActiveIndex: (index: number) => void
  setMode: (mode: 'edit' | 'background') => void
  setPreviewMode: (mode: 'pdf' | 'html' | 'image') => void
  setLogExpanded: (expanded: boolean) => void
  generateSlides: (force?: boolean) => Promise<void>
  applyAndRegenerate: () => Promise<void>
  addSlide: (afterIndex?: number) => void
  deleteSlide: (index: number) => void
  duplicateSlide: (index: number) => void
  reorderSlides: (from: number, to: number) => void
  updateSlideTitle: (index: number, value: string) => void
  updateSlideBody: (index: number, value: string) => void
  updateSlideNotes: (index: number, value: string) => void
  downloadSlides: (format: 'pdf' | 'pptx') => void
  fetchLog: () => Promise<void>
  startVoiceInput: () => void

  // Background actions
  setBackgroundSource: (source: 'preset' | 'upload' | 'recommend') => void
  handleGlobalBackgroundChange: (value: string) => Promise<void>
  handleSlideBackgroundChange: (index: number, value: string) => Promise<void>
  handleUploadBackground: (file?: File | null) => Promise<void>
  fetchBackgroundRecommendations: () => Promise<void>

  // Helpers
  buildAuthedUrl: (url: string) => string
  buildPreviewUrl: (index: number) => string
  imagesWithKey: string[]
}

export const PROGRESS_STAGES = [
  { label: '准备中', at: 0 },
  { label: '生成内容', at: 20 },
  { label: '构建预览', at: 50 },
  { label: '导出 PNG', at: 55 },
  { label: '导出 PDF', at: 65 },
  { label: '导出 PPTX', at: 80 },
  { label: '完成', at: 100 },
]

export function useSlideEditor(
  meetingId: string,
  open: boolean,
  hasSummary: boolean,
): UseSlideEditorReturn {
  // Core state
  const [sections, setSections] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [status, setStatus] = useState<SlidesStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState('')
  const [logExpanded, setLogExpanded] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [exportReady, setExportReady] = useState<{ pdf: boolean; pptx: boolean }>({
    pdf: false,
    pptx: false,
  })
  const [previewKey, setPreviewKey] = useState(() => Date.now())
  const [previewMode, setPreviewMode] = useState<'pdf' | 'html' | 'image'>('image')
  const [mode, setMode] = useState<'edit' | 'background'>('edit')
  const [pollingKey, setPollingKey] = useState(0)
  const [voiceListening, setVoiceListening] = useState(false)
  const [markdownLoaded, setMarkdownLoaded] = useState(false)
  const contentEditorRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  // Theme
  const [theme, setTheme] = useState<SlideTheme>('default')

  // Undo/Redo history
  const historyStackRef = useRef<string[][]>([])
  const historyIndexRef = useRef(-1)
  const isUndoRedoRef = useRef(false)

  // Retry
  const lastActionRef = useRef<'generate' | 'apply' | null>(null)

  // Background state
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({
    global_id: null,
    slides: {},
  })
  const [backgroundPresets, setBackgroundPresets] = useState<BackgroundAsset[]>([])
  const [backgroundUploads, setBackgroundUploads] = useState<BackgroundAsset[]>([])
  const [backgroundRecommended, setBackgroundRecommended] = useState<BackgroundAsset[]>([])
  const [backgroundSource, setBackgroundSource] = useState<'preset' | 'upload' | 'recommend'>(
    'preset',
  )
  const [backgroundLoading, setBackgroundLoading] = useState(false)
  const [backgroundSaving, setBackgroundSaving] = useState(false)
  const [backgroundUploading, setBackgroundUploading] = useState(false)

  // Derived markdown from sections
  const markdown = useMemo(() => joinSlides(sections), [sections])

  // Derived values
  const busy = loading || status?.status === 'processing'
  const slidesCount = Math.max(sections.length, images.length, 0)
  const hasImagePreview = images.length > 0
  const effectiveExportReady = useMemo(
    () => mergeExportReady(exportReady, status?.export_urls),
    [exportReady, status?.export_urls],
  )
  const hasPdfPreview =
    effectiveExportReady.pdf || Boolean(status?.export_urls?.pdf)
  const hasHtmlPreview = Boolean(status?.preview_url)

  const statusLabel = !status
    ? ''
    : status.status === 'completed'
      ? '已完成'
      : status.status === 'failed'
        ? '生成失败'
        : status.status === 'processing'
          ? '生成中'
          : '就绪'
  const statusColor = !status
    ? ('default' as const)
    : status.status === 'completed'
      ? ('success' as const)
      : status.status === 'failed'
        ? ('error' as const)
        : status.status === 'processing'
          ? ('info' as const)
          : ('default' as const)

  // Background derived
  const backgroundAssetsAll = useMemo(
    () => [...backgroundPresets, ...backgroundUploads, ...backgroundRecommended],
    [backgroundPresets, backgroundUploads, backgroundRecommended],
  )
  const backgroundAssetMap = useMemo(() => {
    const map: Record<string, BackgroundAsset> = {}
    for (const a of backgroundAssetsAll) map[a.id] = a
    return map
  }, [backgroundAssetsAll])

  // ---- History (Undo/Redo) ----

  const pushHistory = useCallback((newSections: string[]) => {
    if (isUndoRedoRef.current) return
    const stack = historyStackRef.current
    const idx = historyIndexRef.current
    // Truncate any redo entries
    historyStackRef.current = stack.slice(0, idx + 1)
    historyStackRef.current.push([...newSections])
    // Cap at 50
    if (historyStackRef.current.length > 50) {
      historyStackRef.current = historyStackRef.current.slice(-50)
    }
    historyIndexRef.current = historyStackRef.current.length - 1
  }, [])

  const canUndo = historyIndexRef.current > 0
  const canRedo = historyIndexRef.current < historyStackRef.current.length - 1

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    isUndoRedoRef.current = true
    historyIndexRef.current -= 1
    setSections([...historyStackRef.current[historyIndexRef.current]])
    isUndoRedoRef.current = false
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyStackRef.current.length - 1) return
    isUndoRedoRef.current = true
    historyIndexRef.current += 1
    setSections([...historyStackRef.current[historyIndexRef.current]])
    isUndoRedoRef.current = false
  }, [])

  // URL helpers
  const buildAuthedUrl = useCallback((url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token || typeof window === 'undefined') return url
    const resolved = new URL(url, window.location.origin)
    if (!resolved.searchParams.get('token')) {
      resolved.searchParams.set('token', token)
    }
    return resolved.toString()
  }, [])

  const appendPreviewKey = useCallback(
    (url: string) => {
      if (!url) return url
      const [base, hash] = url.split('#')
      const joiner = base.includes('?') ? '&' : '?'
      const withKey = `${base}${joiner}v=${previewKey}`
      return hash ? `${withKey}#${hash}` : withKey
    },
    [previewKey],
  )

  const imagesWithKey = useMemo(
    () => images.map((url) => appendPreviewKey(url)),
    [images, appendPreviewKey],
  )

  const buildPreviewUrl = useCallback(
    (index: number) => {
      const hasPdf = effectiveExportReady.pdf || Boolean(status?.export_urls?.pdf)
      const hasHtml = Boolean(status?.preview_url)
      const effectiveMode =
        previewMode === 'pdf' && hasPdf
          ? 'pdf'
          : previewMode === 'html' && hasHtml
            ? 'html'
            : hasPdf
              ? 'pdf'
              : 'html'
      if (effectiveMode === 'pdf') {
        const base = status?.export_urls?.pdf || `/api/v1/meetings/${meetingId}/slides/export?format=pdf&inline=1`
        return appendPreviewKey(buildAuthedUrl(`${base}#page=${index}`))
      }
      const base = status?.preview_url || `/api/v1/meetings/${meetingId}/slides/preview/index.html`
      return appendPreviewKey(buildAuthedUrl(`${base}#${index}`))
    },
    [meetingId, effectiveExportReady, status, previewMode, appendPreviewKey, buildAuthedUrl],
  )

  // ---- Fetchers ----

  const prevStatusRef = useRef<string | null>(null)

  const fetchSlidesStatus = useCallback(async () => {
    try {
      const res = await getMeetingSlidesStatus(meetingId)
      setStatus(res)
      setExportReady((prev) => mergeExportReady(prev, res.export_urls))
      if (res.status === 'completed' || res.status === 'failed') {
        setLoading(false)
      }
      // Refresh previewKey when status transitions to completed
      if (res.status === 'completed' && prevStatusRef.current !== 'completed') {
        setPreviewKey(Date.now())
      }
      prevStatusRef.current = res.status
      if (res.image_urls?.length) {
        setImages(res.image_urls)
        setPreviewMode('image')
      }
      // Check exports
      try {
        const exports = await getMeetingSlidesExportExists(meetingId)
        setExportReady((prev) => mergeExportReady(mergeExportReady(prev, res.export_urls), exports))
      } catch {
        /* ignore */
      }
      return res
    } catch {
      setError('获取PPT状态失败')
      return null
    }
  }, [meetingId])

  const fetchMarkdown = useCallback(async () => {
    try {
      const res = await getMeetingSlidesMarkdown(meetingId)
      const md = res.markdown || ''
      if (md.trim()) {
        const newSections = splitSlides(md)
        setSections(newSections)
        setMarkdownLoaded(true)
        // Initialize history with loaded sections
        historyStackRef.current = [newSections]
        historyIndexRef.current = 0
      }
    } catch {
      /* markdown may not exist yet */
    }
  }, [meetingId])

  const loadSlidesImages = useCallback(async () => {
    try {
      const res = await getMeetingSlidesImages(meetingId)
      if (Array.isArray(res.images) && res.images.length > 0) {
        setImages(res.images)
        setPreviewMode('image')
        setPreviewKey(Date.now())
      }
    } catch {
      /* ignore */
    }
  }, [meetingId])

  const fetchBackgroundAssets = useCallback(async () => {
    setBackgroundLoading(true)
    try {
      const [presets, uploads] = await Promise.all([
        listPptBackgroundPresets(),
        listPptBackgroundUploads(),
      ])
      setBackgroundPresets(Array.isArray(presets.assets) ? (presets.assets as BackgroundAsset[]) : [])
      setBackgroundUploads(Array.isArray(uploads.assets) ? (uploads.assets as BackgroundAsset[]) : [])
    } catch {
      /* ignore */
    } finally {
      setBackgroundLoading(false)
    }
  }, [])

  const fetchBackgroundConfig = useCallback(async () => {
    try {
      const res = await getMeetingSlidesBackgrounds(meetingId)
      setBackgroundConfig({ global_id: res.global_id ?? null, slides: res.slides || {} })
    } catch {
      /* ignore */
    }
  }, [meetingId])

  const fetchBackgroundRecommendations = useCallback(async () => {
    try {
      const res = await recommendMeetingSlidesBackgrounds(meetingId)
      setBackgroundRecommended(Array.isArray(res.assets) ? (res.assets as BackgroundAsset[]) : [])
    } catch {
      setBackgroundRecommended([])
    }
  }, [meetingId])

  // ---- Effects ----

  // On open: fetch status + markdown + images
  useEffect(() => {
    if (!open) return
    setError(null)
    setLog('')
    setLogExpanded(false)
    setMode('edit')
    fetchSlidesStatus()
    fetchMarkdown()
    loadSlidesImages()
    fetchBackgroundAssets()
    fetchBackgroundConfig()
  }, [open, fetchSlidesStatus, fetchMarkdown, loadSlidesImages, fetchBackgroundAssets, fetchBackgroundConfig])

  // Poll status while processing
  useEffect(() => {
    if (!open) return
    if (status?.status === 'completed' || status?.status === 'failed') return

    const timer = setInterval(async () => {
      const res = await fetchSlidesStatus()
      if (res?.status === 'completed') {
        await loadSlidesImages()
        await fetchMarkdown()
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [open, pollingKey, status?.status, fetchSlidesStatus, loadSlidesImages, fetchMarkdown])

  // Keep activeIndex in bounds
  useEffect(() => {
    if (sections.length > 0 && activeIndex >= sections.length) {
      setActiveIndex(sections.length - 1)
    }
  }, [sections.length, activeIndex])

  // ---- Actions ----

  const generateSlides = useCallback(
    async (force = false) => {
      setPreviewKey(Date.now())
      setLoading(true)
      setError(null)
      setStatus(null)
      setLog('')
      setLogExpanded(false)
      setImages([])
      setExportReady({ pdf: false, pptx: false })
      try {
        const existing = await fetchSlidesStatus()
        const hasExistingAssets = Boolean(
          existing &&
            (existing.status === 'completed' ||
              existing.preview_url ||
              existing.export_urls?.pdf ||
              existing.export_urls?.pptx ||
              (Array.isArray(existing.image_urls) && existing.image_urls.length > 0)),
        )
        if (existing?.status === 'processing') {
          setLoading(true)
          setPollingKey((k) => k + 1)
          return
        }
        if (hasExistingAssets && !force) {
          setLoading(false)
          if (existing?.image_urls?.length) {
            setImages(existing.image_urls)
          }
          return
        }
        setLoading(true)
        lastActionRef.current = 'generate'
        await createMeetingSlides(meetingId, theme)
        setPollingKey((k) => k + 1)
        await fetchSlidesStatus()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '未知错误'
        setError(`生成PPT失败: ${msg}`)
        setLoading(false)
      }
    },
    [meetingId, fetchSlidesStatus, theme],
  )

  const applyAndRegenerate = useCallback(async () => {
    if (!markdown.trim()) return
    setLoading(true)
    setImages([])
    setStatus({ status: 'processing', progress: 0, message: '应用编辑并重新生成...' })
    setPollingKey((k) => k + 1)
    try {
      lastActionRef.current = 'apply'
      await updateMeetingSlidesMarkdown(meetingId, markdown)
      await fetchSlidesStatus()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      setError(`应用编辑失败: ${msg}`)
      setLoading(false)
    }
  }, [meetingId, markdown, fetchSlidesStatus])

  const retryLastAction = useCallback(async () => {
    if (lastActionRef.current === 'generate') {
      await generateSlides(true)
    } else if (lastActionRef.current === 'apply') {
      await applyAndRegenerate()
    }
  }, [generateSlides, applyAndRegenerate])

  const addSlide = useCallback(
    (afterIndex?: number) => {
      const idx = afterIndex ?? activeIndex
      setSections((prev) => {
        const next = [...prev]
        next.splice(idx + 1, 0, createBlankSlide())
        pushHistory(next)
        return next
      })
      setActiveIndex(idx + 1)
    },
    [activeIndex, pushHistory],
  )

  const deleteSlide = useCallback(
    (index: number) => {
      setSections((prev) => {
        if (prev.length <= 1) return prev
        const next = [...prev]
        next.splice(index, 1)
        pushHistory(next)
        return next
      })
      setActiveIndex((prev) => Math.min(prev, sections.length - 2))
    },
    [sections.length, pushHistory],
  )

  const duplicateSlide = useCallback(
    (index: number) => {
      setSections((prev) => {
        const next = [...prev]
        next.splice(index + 1, 0, prev[index])
        pushHistory(next)
        return next
      })
      setActiveIndex(index + 1)
    },
    [pushHistory],
  )

  const reorderSlides = useCallback((from: number, to: number) => {
    if (from === to) return
    setSections((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      pushHistory(next)
      return next
    })
  }, [pushHistory])

  const updateSlideTitle = useCallback((index: number, value: string) => {
    setSections((prev) => {
      const next = [...prev]
      const parsed = parseSlideSection(prev[index] || '')
      next[index] = buildSlideSection({ ...parsed, title: value })
      pushHistory(next)
      return next
    })
  }, [pushHistory])

  const updateSlideBody = useCallback((index: number, value: string) => {
    setSections((prev) => {
      const next = [...prev]
      const parsed = parseSlideSection(prev[index] || '')
      next[index] = buildSlideSection({ ...parsed, body: value })
      pushHistory(next)
      return next
    })
  }, [pushHistory])

  const updateSlideNotes = useCallback((index: number, value: string) => {
    setSections((prev) => {
      const next = [...prev]
      const parsed = parseSlideSection(prev[index] || '')
      next[index] = buildSlideSection({ ...parsed, notes: value })
      pushHistory(next)
      return next
    })
  }, [pushHistory])

  const downloadSlides = useCallback(
    (format: 'pdf' | 'pptx') => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const url = `/api/v1/meetings/${meetingId}/slides/export?format=${format}${token ? `&token=${token}` : ''}`
      window.open(url, '_blank')
    },
    [meetingId],
  )

  const fetchLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const res = await getMeetingSlidesLogs(meetingId)
      setLog(res.log || '')
      setLogExpanded(true)
    } catch {
      /* ignore */
    } finally {
      setLogLoading(false)
    }
  }, [meetingId])

  const startVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('当前浏览器不支持语音识别')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setVoiceListening(true)

    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim()
      if (text) {
        setSections((prev) => {
          const next = [...prev]
          const current = next[activeIndex] || ''
          next[activeIndex] = current + `\n- ${text}`
          return next
        })
      }
    }
    recognition.onerror = () => {
      setError('语音识别失败，请重试')
      setVoiceListening(false)
    }
    recognition.onend = () => {
      setVoiceListening(false)
    }
    recognition.start()
  }, [activeIndex])

  // ---- Background actions ----

  const saveBackgroundConfig = async (nextConfig: BackgroundConfig) => {
    setBackgroundSaving(true)
    setBackgroundConfig(nextConfig)
    try {
      await updateMeetingSlidesBackgrounds(meetingId, nextConfig)
    } catch {
      /* ignore */
    } finally {
      setBackgroundSaving(false)
    }
  }

  const handleGlobalBackgroundChange = async (value: string) => {
    await saveBackgroundConfig({ ...backgroundConfig, global_id: value || null })
  }

  const handleSlideBackgroundChange = async (index: number, value: string) => {
    const nextSlides = { ...(backgroundConfig.slides || {}) }
    if (!value) {
      delete nextSlides[String(index)]
    } else {
      nextSlides[String(index)] = value
    }
    await saveBackgroundConfig({ ...backgroundConfig, slides: nextSlides })
  }

  const handleUploadBackground = async (file?: File | null) => {
    if (!file) return
    setBackgroundUploading(true)
    try {
      await uploadPptBackground(file)
      await fetchBackgroundAssets()
      setBackgroundSource('upload')
    } catch {
      /* ignore */
    } finally {
      setBackgroundUploading(false)
    }
  }

  return {
    sections,
    markdown,
    images,
    activeIndex,
    status,
    loading,
    error,
    log,
    logExpanded,
    logLoading,
    exportReady: effectiveExportReady,
    previewKey,
    previewMode,
    mode,
    voiceListening,
    contentEditorRef,
    markdownLoaded,

    backgroundConfig,
    backgroundPresets,
    backgroundUploads,
    backgroundRecommended,
    backgroundAssetsAll,
    backgroundAssetMap,
    backgroundSource,
    backgroundLoading,
    backgroundSaving,
    backgroundUploading,

    theme,
    setTheme,

    canUndo,
    canRedo,
    undo,
    redo,

    retryLastAction,

    busy,
    slidesCount,
    hasImagePreview,
    hasPdfPreview,
    hasHtmlPreview,
    statusLabel,
    statusColor,

    setActiveIndex,
    setMode,
    setPreviewMode,
    setLogExpanded,
    generateSlides,
    applyAndRegenerate,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    updateSlideTitle,
    updateSlideBody,
    updateSlideNotes,
    downloadSlides,
    fetchLog,
    startVoiceInput,

    setBackgroundSource,
    handleGlobalBackgroundChange,
    handleSlideBackgroundChange,
    handleUploadBackground,
    fetchBackgroundRecommendations,

    buildAuthedUrl,
    buildPreviewUrl,
    imagesWithKey,
  }
}
