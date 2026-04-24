'use client'

import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Alert from '@mui/material/Alert'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReplayIcon from '@mui/icons-material/Replay'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useSlideEditor, PROGRESS_STAGES } from './useSlideEditor'
import { parseSlideSection } from './utils'
import SlideEditorToolbar from './SlideEditorToolbar'
import SlideThumbnailSidebar from './SlideThumbnailSidebar'
import SlideCanvas from './SlideCanvas'
import SlidePropertiesPanel from './SlidePropertiesPanel'
import SlideBackgroundTab from './SlideBackgroundTab'
import type { Meeting, Summary } from '@/interfaces'

interface SlideEditorProps {
  open: boolean
  meetingId: string
  meeting: Meeting | null
  summary: Summary | null
  onClose: () => void
  /** If true, auto-trigger generation on first open when no existing slides */
  autoGenerate?: boolean
}

export default function SlideEditor({
  open,
  meetingId,
  summary,
  onClose,
  autoGenerate,
}: SlideEditorProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isDark = theme.palette.mode === 'dark'

  const editor = useSlideEditor(meetingId, open, Boolean(summary))

  // Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+S
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        editor.undo()
      } else if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        editor.redo()
      } else if (mod && e.key === 'y') {
        e.preventDefault()
        editor.redo()
      } else if (mod && e.key === 's') {
        e.preventDefault()
        if (!editor.busy && editor.sections.length > 0) {
          editor.applyAndRegenerate()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, editor])

  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'

  // Current slide parsed data
  const currentSection = editor.sections[editor.activeIndex] || ''
  const parsed = parseSlideSection(currentSection)

  // Current image URL for active slide
  const currentImageUrl = editor.imagesWithKey[editor.activeIndex] || undefined

  // Preview URL for iframe modes
  const currentPreviewUrl =
    editor.hasPdfPreview || editor.hasHtmlPreview
      ? editor.buildPreviewUrl(editor.activeIndex + 1)
      : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: isDark ? '#0f1117' : '#f4f5f9',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Toolbar */}
      <SlideEditorToolbar
        mode={editor.mode}
        onModeChange={editor.setMode}
        onApplyAndRegenerate={editor.applyAndRegenerate}
        onRegenerate={() => editor.generateSlides(true)}
        onDownload={editor.downloadSlides}
        onClose={onClose}
        onFetchLog={editor.fetchLog}
        onVoiceInput={editor.startVoiceInput}
        busy={editor.busy}
        exportReady={editor.exportReady}
        hasSummary={Boolean(summary)}
        hasMarkdown={editor.sections.length > 0}
        voiceListening={editor.voiceListening}
        logLoading={editor.logLoading}
        isMobile={isMobile}
        isDark={isDark}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        theme={editor.theme}
        onThemeChange={editor.setTheme}
      />

      {/* Progress bar (when generating) */}
      {editor.status &&
        (editor.status.status === 'processing' || editor.status.status === 'failed') && (
          <Box sx={{ px: 2, pt: 1 }}>
            <ProgressSection
              status={editor.status}
              isDark={isDark}
              softBorder={softBorder}
            />
          </Box>
        )}

      {/* Status chip + error */}
      {(editor.statusLabel || editor.error) && (
        <Box sx={{ px: 2, pt: 0.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {editor.statusLabel && (
            <Chip label={editor.statusLabel} color={editor.statusColor} size="small" />
          )}
          {editor.status?.message && editor.status.status === 'processing' && (
            <Typography variant="caption" color="text.secondary">
              {editor.status.message}
            </Typography>
          )}
          {editor.error && (
            <Alert
              severity="error"
              variant="outlined"
              sx={{ py: 0, fontSize: 12 }}
              action={
                <Button
                  size="small"
                  color="error"
                  onClick={editor.retryLastAction}
                  startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
                  sx={{ textTransform: 'none', fontSize: 12 }}
                >
                  重试
                </Button>
              }
            >
              {editor.error}
            </Alert>
          )}
        </Box>
      )}

      {/* Log accordion */}
      {editor.log && (
        <Box sx={{ px: 2, pt: 0.5 }}>
          <Accordion
            expanded={editor.logExpanded}
            onChange={(_, expanded) => editor.setLogExpanded(expanded)}
            sx={{
              borderRadius: 2,
              border: softBorder,
              boxShadow: 'none',
              bgcolor: isDark ? '#1A1C24' : '#F7F7FB',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="caption" color="text.secondary">
                生成日志
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontSize: 11,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {editor.log}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Main content area */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {editor.mode === 'edit' ? (
          editor.sections.length === 0 && !editor.markdownLoaded ? (
            /* Empty state: no slides yet */
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                p: 4,
              }}
            >
              <Typography variant="h6" color="text.secondary">
                暂无幻灯片内容
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
                {editor.error
                  ? editor.error
                  : summary
                    ? '点击下方按钮从会议纪要生成 PPT，或生成后在此编辑。'
                    : '请先分析会议生成纪要，然后再生成 PPT。'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {editor.error ? (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={editor.retryLastAction}
                    disabled={editor.busy}
                    startIcon={<ReplayIcon />}
                  >
                    重试
                  </Button>
                ) : summary ? (
                  <Button
                    variant="contained"
                    onClick={() => editor.generateSlides(false)}
                    disabled={editor.busy}
                    startIcon={<PlayArrowIcon />}
                  >
                    {editor.busy ? '生成中...' : '生成 PPT'}
                  </Button>
                ) : null}
                <Button
                  variant="outlined"
                  onClick={() => editor.addSlide(-1)}
                >
                  从空白开始
                </Button>
              </Box>
            </Box>
          ) : (
            /* Three-panel editor layout */
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                overflow: 'hidden',
              }}
            >
              {/* Left: Thumbnails */}
              <Box
                sx={{
                  borderRight: isMobile ? 'none' : softBorder,
                  borderBottom: isMobile ? softBorder : 'none',
                  bgcolor: isDark ? '#13151c' : '#eef0f5',
                  overflow: 'auto',
                  flexShrink: 0,
                }}
              >
                <SlideThumbnailSidebar
                  sections={editor.sections}
                  images={editor.images}
                  activeIndex={editor.activeIndex}
                  previewKey={editor.previewKey}
                  onSelect={editor.setActiveIndex}
                  onReorder={editor.reorderSlides}
                  onAdd={editor.addSlide}
                  onDelete={editor.deleteSlide}
                  onDuplicate={editor.duplicateSlide}
                  isMobile={isMobile}
                  isDark={isDark}
                />
              </Box>

              {/* Center: Canvas */}
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: { xs: 1, md: 2 },
                  minHeight: isMobile ? '40vh' : 0,
                }}
              >
                <SlideCanvas
                  section={currentSection}
                  imageUrl={currentImageUrl}
                  previewUrl={currentPreviewUrl}
                  previewMode={editor.hasImagePreview ? 'image' : editor.hasPdfPreview ? 'pdf' : 'html'}
                  slideIndex={editor.activeIndex}
                  isMobile={isMobile}
                  isDark={isDark}
                />
              </Box>

              {/* Right: Properties panel */}
              <Box
                sx={{
                  borderLeft: isMobile ? 'none' : softBorder,
                  borderTop: isMobile ? softBorder : 'none',
                  bgcolor: isDark ? '#13151c' : '#fafbfd',
                  overflow: 'auto',
                  flexShrink: 0,
                }}
              >
                <SlidePropertiesPanel
                  title={parsed.title}
                  body={parsed.body}
                  notes={parsed.notes}
                  slideIndex={editor.activeIndex}
                  totalSlides={editor.sections.length}
                  onTitleChange={(v) => editor.updateSlideTitle(editor.activeIndex, v)}
                  onBodyChange={(v) => editor.updateSlideBody(editor.activeIndex, v)}
                  onNotesChange={(v) => editor.updateSlideNotes(editor.activeIndex, v)}
                  isMobile={isMobile}
                  isDark={isDark}
                />
              </Box>
            </Box>
          )
        ) : (
          /* Background tab */
          <SlideBackgroundTab
            sections={editor.sections}
            slidesCount={editor.slidesCount}
            backgroundConfig={editor.backgroundConfig}
            backgroundPresets={editor.backgroundPresets}
            backgroundUploads={editor.backgroundUploads}
            backgroundRecommended={editor.backgroundRecommended}
            backgroundAssetsAll={editor.backgroundAssetsAll}
            backgroundAssetMap={editor.backgroundAssetMap}
            backgroundSource={editor.backgroundSource}
            backgroundLoading={editor.backgroundLoading}
            backgroundSaving={editor.backgroundSaving}
            backgroundUploading={editor.backgroundUploading}
            onSourceChange={editor.setBackgroundSource}
            onGlobalChange={editor.handleGlobalBackgroundChange}
            onSlideChange={editor.handleSlideBackgroundChange}
            onUpload={(f) => editor.handleUploadBackground(f)}
            onFetchRecommendations={editor.fetchBackgroundRecommendations}
            isDark={isDark}
          />
        )}
      </Box>

      {/* Mobile bottom actions */}
      {isMobile && editor.sections.length > 0 && editor.mode === 'edit' && (
        <Box
          sx={{
            p: 1.5,
            borderTop: softBorder,
            bgcolor: isDark ? '#0f1117' : '#f4f5f9',
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => editor.generateSlides(true)}
            disabled={editor.busy || !summary}
            startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          >
            重新生成
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={editor.applyAndRegenerate}
            disabled={editor.busy || editor.sections.length === 0}
            startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
          >
            应用并生成
          </Button>
        </Box>
      )}
    </Dialog>
  )
}

// ---- Progress section (extracted) ----

function ProgressSection({
  status,
  isDark,
  softBorder,
}: {
  status: { status: string; progress: number; message: string }
  isDark: boolean
  softBorder: string
}) {
  const progress = Math.min(Math.max(status.progress ?? 0, 0), 100)
  const activeStage = PROGRESS_STAGES.reduce(
    (acc, stage) => (progress >= stage.at ? stage : acc),
    PROGRESS_STAGES[0],
  )
  const stageLabel =
    status.status === 'completed'
      ? '已完成'
      : status.status === 'failed'
        ? '生成失败'
        : activeStage?.label || '生成中'

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: softBorder,
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, rgba(18,21,28,0.96), rgba(30,36,48,0.92))'
          : 'linear-gradient(135deg, rgba(248,250,255,0.98), rgba(240,244,252,0.98))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {status.message || '正在处理'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          <Chip label={stageLabel} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {progress}%
          </Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            background: status.status === 'failed'
              ? 'linear-gradient(90deg, #FF3B30, #FF6B6B)'
              : 'linear-gradient(90deg, #0A84FF, #64D2FF)',
          },
        }}
      />
    </Box>
  )
}
