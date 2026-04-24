'use client'

import { useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatClearIcon from '@mui/icons-material/FormatClear'
import {
  toggleWrap,
  applyBulletListTransform,
  applyAlignmentTransform,
  clearFormattingTransform,
} from './utils'

interface SlidePropertiesPanelProps {
  title: string
  body: string
  notes: string
  slideIndex: number
  totalSlides: number
  onTitleChange: (value: string) => void
  onBodyChange: (value: string) => void
  onNotesChange: (value: string) => void
  isMobile: boolean
  isDark: boolean
}

export default function SlidePropertiesPanel({
  title,
  body,
  notes,
  slideIndex,
  totalSlides,
  onTitleChange,
  onBodyChange,
  onNotesChange,
  isMobile,
  isDark,
}: SlidePropertiesPanelProps) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const applyTransform = useCallback(
    (transform: (text: string) => string) => {
      const textarea = bodyRef.current
      if (!textarea) {
        onBodyChange(transform(body))
        return
      }
      const start = textarea.selectionStart ?? 0
      const end = textarea.selectionEnd ?? 0

      let selStart = Math.max(0, Math.min(start, body.length))
      let selEnd = Math.max(selStart, Math.min(end, body.length))

      // If no selection, select current line
      if (selStart === selEnd) {
        const before = body.slice(0, selStart)
        const after = body.slice(selStart)
        const lineStart = before.lastIndexOf('\n') + 1
        const nextNewline = after.indexOf('\n')
        const lineEnd = nextNewline === -1 ? body.length : selStart + nextNewline
        selStart = lineStart
        selEnd = lineEnd
      }

      const before = body.slice(0, selStart)
      const selected = body.slice(selStart, selEnd)
      const after = body.slice(selEnd)
      const transformed = transform(selected)
      const next = `${before}${transformed}${after}`
      onBodyChange(next)

      requestAnimationFrame(() => {
        if (!bodyRef.current) return
        const pos = before.length + transformed.length
        bodyRef.current.focus()
        bodyRef.current.selectionStart = pos
        bodyRef.current.selectionEnd = pos
      })
    },
    [body, onBodyChange],
  )

  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 1.5,
        height: '100%',
        overflow: 'auto',
        minWidth: isMobile ? 0 : 280,
        width: isMobile ? '100%' : 300,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          第 {slideIndex + 1} / {totalSlides} 页
        </Typography>
      </Box>

      {/* Title field */}
      <TextField
        label="标题"
        size="small"
        fullWidth
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="幻灯片标题"
        sx={{
          '& .MuiOutlinedInput-root': {
            fontWeight: 600,
            fontSize: '1rem',
          },
        }}
      />

      {/* Formatting mini-toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.25,
          border: softBorder,
          borderRadius: 1.5,
          p: 0.5,
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <Tooltip title="粗体" arrow>
          <IconButton size="small" onClick={() => applyTransform(toggleWrap('**'))}>
            <FormatBoldIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="斜体" arrow>
          <IconButton size="small" onClick={() => applyTransform(toggleWrap('*'))}>
            <FormatItalicIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="下划线" arrow>
          <IconButton size="small" onClick={() => applyTransform(toggleWrap('<u>', '</u>'))}>
            <FormatUnderlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <Tooltip title="列表" arrow>
          <IconButton size="small" onClick={() => applyTransform(applyBulletListTransform)}>
            <FormatListBulletedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <Tooltip title="左对齐" arrow>
          <IconButton size="small" onClick={() => applyTransform(applyAlignmentTransform('left'))}>
            <FormatAlignLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="居中" arrow>
          <IconButton
            size="small"
            onClick={() => applyTransform(applyAlignmentTransform('center'))}
          >
            <FormatAlignCenterIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="右对齐" arrow>
          <IconButton
            size="small"
            onClick={() => applyTransform(applyAlignmentTransform('right'))}
          >
            <FormatAlignRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        {/* Color dots */}
        {['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2'].map((color) => (
          <Tooltip key={color} title={`颜色`} arrow>
            <IconButton
              size="small"
              onClick={() =>
                applyTransform((text) => `<span style="color:${color}">${text}</span>`)
              }
              sx={{ p: 0.25 }}
            >
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: color,
                  border: '1px solid rgba(0,0,0,0.15)',
                }}
              />
            </IconButton>
          </Tooltip>
        ))}
        <Tooltip title="清除格式" arrow>
          <IconButton size="small" onClick={() => applyTransform(clearFormattingTransform)}>
            <FormatClearIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content field */}
      <TextField
        label="内容"
        multiline
        minRows={isMobile ? 4 : 8}
        maxRows={isMobile ? 8 : 16}
        fullWidth
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        inputRef={bodyRef}
        placeholder="在这里编辑本页内容&#10;支持 Markdown 语法&#10;- 列表项&#10;**粗体** *斜体*"
        sx={{
          flex: 1,
          '& .MuiOutlinedInput-root': {
            fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          },
        }}
      />

      {/* Speaker Notes */}
      <Divider />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        演讲者备注
      </Typography>
      <TextField
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="添加演讲者备注（不会显示在幻灯片上）"
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.8rem',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          },
        }}
      />
    </Box>
  )
}
