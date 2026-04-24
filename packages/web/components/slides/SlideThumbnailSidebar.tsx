'use client'

import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { useState } from 'react'
import { getSlideTitle, getSlideSnippet } from './utils'

interface SlideThumbnailSidebarProps {
  sections: string[]
  images: string[]
  activeIndex: number
  previewKey: number
  onSelect: (index: number) => void
  onReorder: (from: number, to: number) => void
  onAdd: (afterIndex?: number) => void
  onDelete: (index: number) => void
  onDuplicate: (index: number) => void
  isMobile: boolean
  isDark: boolean
}

export default function SlideThumbnailSidebar({
  sections,
  images,
  activeIndex,
  previewKey,
  onSelect,
  onReorder,
  onAdd,
  onDelete,
  onDuplicate,
  isMobile,
  isDark,
}: SlideThumbnailSidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const softBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        gap: 0.75,
        p: 1,
        overflowX: isMobile ? 'auto' : 'visible',
        overflowY: isMobile ? 'visible' : 'auto',
        maxHeight: isMobile ? 'none' : '100%',
        minWidth: isMobile ? 0 : 180,
        width: isMobile ? '100%' : 180,
        '&::-webkit-scrollbar': { width: 4, height: 4 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          borderRadius: 2,
        },
      }}
    >
      {sections.map((section, idx) => {
        const active = idx === activeIndex
        const hovering = idx === hoverIndex
        const title = getSlideTitle(section, idx)
        const snippet = getSlideSnippet(section)
        const imageUrl = images[idx]
          ? `${images[idx]}${images[idx].includes('?') ? '&' : '?'}v=${previewKey}`
          : null

        return (
          <Box
            key={idx}
            onMouseEnter={() => setHoverIndex(idx)}
            onMouseLeave={() => setHoverIndex(null)}
            sx={{
              position: 'relative',
              flex: isMobile ? '0 0 140px' : 'none',
            }}
          >
            <ButtonBase
              onClick={() => onSelect(idx)}
              draggable={!isMobile}
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) onReorder(dragIndex, idx)
                setDragIndex(null)
              }}
              sx={{
                width: '100%',
                textAlign: 'left',
                display: 'block',
                cursor: isMobile ? 'pointer' : 'grab',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 0.5,
                  borderRadius: 1.5,
                  border: active ? '2px solid' : softBorder,
                  borderColor: active ? 'primary.main' : undefined,
                  bgcolor: active
                    ? isDark
                      ? 'rgba(79,130,255,0.12)'
                      : 'rgba(79,130,255,0.06)'
                    : 'background.paper',
                  transition: 'border-color 0.15s, background 0.15s',
                  overflow: 'hidden',
                }}
              >
                {/* Thumbnail image or text preview */}
                {imageUrl ? (
                  <Box
                    component="img"
                    src={imageUrl}
                    loading="lazy"
                    draggable={false}
                    sx={{
                      width: '100%',
                      aspectRatio: '16/9',
                      objectFit: 'cover',
                      display: 'block',
                      borderRadius: 1,
                      bgcolor: isDark ? '#222' : '#f5f5f5',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '16/9',
                      bgcolor: isDark ? '#1e2130' : '#f0f2f8',
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      px: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, fontSize: 10, textAlign: 'center' }}
                      noWrap
                    >
                      {title}
                    </Typography>
                    {snippet && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: 8, textAlign: 'center', mt: 0.25 }}
                        noWrap
                      >
                        {snippet}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Slide number */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 0.5,
                    py: 0.25,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {idx + 1}
                  </Typography>
                  {isMobile && (
                    <Box sx={{ display: 'flex', gap: 0 }}>
                      <IconButton
                        size="small"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          onReorder(idx, idx - 1)
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={idx === sections.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          onReorder(idx, idx + 1)
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </Paper>
            </ButtonBase>

            {/* Hover actions (desktop only) */}
            {!isMobile && hovering && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  display: 'flex',
                  gap: 0.25,
                  bgcolor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                  borderRadius: 1,
                  p: 0.25,
                  zIndex: 2,
                }}
              >
                <Tooltip title="复制" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicate(idx)
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                {sections.length > 1 && (
                  <Tooltip title="删除" arrow>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(idx)
                      }}
                      sx={{ p: 0.25, color: 'error.main' }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        )
      })}

      {/* Add slide button */}
      <ButtonBase
        onClick={() => onAdd()}
        sx={{
          flex: isMobile ? '0 0 140px' : 'none',
          width: isMobile ? 140 : '100%',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 1.5,
            border: `2px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: 'transparent',
            transition: 'border-color 0.15s',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <AddIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            添加页面
          </Typography>
        </Paper>
      </ButtonBase>
    </Box>
  )
}
