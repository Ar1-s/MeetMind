'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import Check from '@mui/icons-material/Check'
import MicIcon from '@mui/icons-material/Mic'
import EditIcon from '@mui/icons-material/Edit'
import WallpaperIcon from '@mui/icons-material/Wallpaper'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import TerminalIcon from '@mui/icons-material/Terminal'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import PaletteIcon from '@mui/icons-material/Palette'
import type { SlideTheme } from './useSlideEditor'

interface SlideEditorToolbarProps {
  mode: 'edit' | 'background'
  onModeChange: (mode: 'edit' | 'background') => void
  onApplyAndRegenerate: () => void
  onRegenerate: () => void
  onDownload: (format: 'pdf' | 'pptx') => void
  onClose: () => void
  onFetchLog: () => void
  onVoiceInput: () => void
  busy: boolean
  exportReady: { pdf: boolean; pptx: boolean }
  hasSummary: boolean
  hasMarkdown: boolean
  voiceListening: boolean
  logLoading: boolean
  isMobile: boolean
  isDark: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  theme: SlideTheme
  onThemeChange: (theme: SlideTheme) => void
}

export default function SlideEditorToolbar({
  mode,
  onModeChange,
  onApplyAndRegenerate,
  onRegenerate,
  onDownload,
  onClose,
  onFetchLog,
  onVoiceInput,
  busy,
  exportReady,
  hasSummary,
  hasMarkdown,
  voiceListening,
  logLoading,
  isMobile,
  isDark,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  theme,
  onThemeChange,
}: SlideEditorToolbarProps) {
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null)
  const [downloadAnchor, setDownloadAnchor] = useState<HTMLElement | null>(null)

  const themeOptions: { id: SlideTheme; label: string }[] = [
    { id: 'default', label: '默认' },
    { id: 'dark', label: '深色' },
    { id: 'minimal', label: '简约' },
    { id: 'corporate', label: '商务' },
  ]

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.01)',
        flexWrap: 'wrap',
        minHeight: 48,
      }}
    >
      {/* Mode toggle */}
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, val) => val && onModeChange(val)}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            px: 1.5,
            py: 0.5,
            fontSize: '0.8rem',
            textTransform: 'none',
          },
        }}
      >
        <ToggleButton value="edit">
          <EditIcon sx={{ fontSize: 16, mr: 0.5 }} />
          编辑
        </ToggleButton>
        <ToggleButton value="background">
          <WallpaperIcon sx={{ fontSize: 16, mr: 0.5 }} />
          背景
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Undo/Redo */}
      {mode === 'edit' && (
        <>
          <Tooltip title="撤销 (Ctrl+Z)" arrow>
            <span>
              <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
                <UndoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="重做 (Ctrl+Shift+Z)" arrow>
            <span>
              <IconButton size="small" onClick={onRedo} disabled={!canRedo}>
                <RedoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}

      {/* Theme selector */}
      <Tooltip title="主题" arrow>
        <IconButton size="small" onClick={e => setThemeAnchor(e.currentTarget)}>
          <PaletteIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={themeAnchor}
        open={Boolean(themeAnchor)}
        onClose={() => setThemeAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 120 } } }}
      >
        {themeOptions.map(opt => (
          <MenuItem
            key={opt.id}
            selected={theme === opt.id}
            onClick={() => {
              onThemeChange(opt.id)
              setThemeAnchor(null)
            }}
          >
            {theme === opt.id && <Check sx={{ fontSize: 16, mr: 1 }} />}
            <ListItemText>{opt.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Voice input */}
      {mode === 'edit' && (
        <Tooltip title={voiceListening ? '识别中...' : '语音输入'} arrow>
          <IconButton
            size="small"
            onClick={onVoiceInput}
            disabled={voiceListening || busy}
            color={voiceListening ? 'error' : 'default'}
          >
            <MicIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Log button */}
      <Tooltip title="查看日志" arrow>
        <IconButton size="small" onClick={onFetchLog} disabled={logLoading}>
          <TerminalIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* Actions */}
      {!isMobile && (
        <>
          <Button
            size="small"
            variant="outlined"
            onClick={onRegenerate}
            disabled={busy || !hasSummary}
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            重新生成
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onApplyAndRegenerate}
            disabled={busy || !hasMarkdown}
            startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            应用并生成
          </Button>
        </>
      )}

      {/* Downloads */}
      {isMobile ? (
        <>
          <Tooltip title="导出" arrow>
            <span>
              <IconButton
                size="small"
                onClick={e => setDownloadAnchor(e.currentTarget)}
                disabled={!exportReady.pdf && !exportReady.pptx}
              >
                <FileDownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Menu
            anchorEl={downloadAnchor}
            open={Boolean(downloadAnchor)}
            onClose={() => setDownloadAnchor(null)}
            slotProps={{ paper: { sx: { minWidth: 140 } } }}
          >
            <MenuItem
              disabled={!exportReady.pdf}
              onClick={() => {
                onDownload('pdf')
                setDownloadAnchor(null)
              }}
            >
              <ListItemText>导出 PDF</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!exportReady.pptx}
              onClick={() => {
                onDownload('pptx')
                setDownloadAnchor(null)
              }}
            >
              <ListItemText>导出 PPTX</ListItemText>
            </MenuItem>
          </Menu>
        </>
      ) : (
        <>
          <Tooltip title="下载 PDF" arrow>
            <span>
              <IconButton
                size="small"
                onClick={() => onDownload('pdf')}
                disabled={!exportReady.pdf}
              >
                <FileDownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          {exportReady.pptx && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onDownload('pptx')}
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}
            >
              PPTX
            </Button>
          )}
        </>
      )}

      {/* Close */}
      <Tooltip title="关闭" arrow>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
