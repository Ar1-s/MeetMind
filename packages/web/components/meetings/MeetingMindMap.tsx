'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { useToastStore } from '@/libs/stores/toast'
import { generateMindmap } from '@/libs/api/mindmap'
import { exportMindmapAsSvg } from './mindmap-export'
import MindmapFlow from './MindmapFlow'
import MindmapChatPanel from './MindmapChatPanel'
import type { Summary, MindmapData } from '@/interfaces'

interface MeetingMindMapProps {
  summary: Summary
}

export default function MeetingMindMap({ summary }: MeetingMindMapProps) {
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const softShadow = isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)'
  const router = useRouter()
  const { success, error } = useToastStore()
  const [generating, setGenerating] = useState(false)
  const [mindmap, setMindmap] = useState<MindmapData | null>(summary.mindmap as MindmapData | null)
  const mindmapHeight = isSmallScreen ? '60vh' : '100%'

  const handleGenerateMindMap = async () => {
    try {
      setGenerating(true)
      const newMindmap = await generateMindmap(summary.meeting_id)
      setMindmap(newMindmap)
      success('思维导图生成成功！')
      router.refresh()
    } catch (err: any) {
      error(err.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleMindmapUpdate = useCallback((updatedMindmap: MindmapData) => {
    setMindmap(updatedMindmap)
  }, [])

  // No mindmap yet - show generate button
  if (!mindmap || !mindmap.nodes || mindmap.nodes.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          textAlign: 'center',
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ maxWidth: 400 }}>
          <AutoAwesomeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            生成思维导图
          </Typography>
          <Typography color="text.secondary" paragraph>
            使用 AI 自动分析会议内容，生成交互式思维导图，帮助您快速把握会议脉络。
          </Typography>
          <Button
            variant="contained"
            startIcon={
              generating ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />
            }
            onClick={handleGenerateMindMap}
            disabled={generating}
            size="large"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
              },
            }}
          >
            {generating ? '正在生成...' : '立即生成'}
          </Button>
        </Box>
      </Paper>
    )
  }

  // Has mindmap - show ReactFlow with chat panel
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        height: { xs: 'auto', md: 600 },
        flexDirection: { xs: 'column', md: 'row' },
      }}
    >
      {/* ReactFlow Canvas */}
      <Paper
        sx={{
          flex: 2,
          overflow: 'hidden',
          borderRadius: { xs: 3, sm: 2 },
          border: softBorder,
          boxShadow: { xs: softShadow, sm: softShadow },
          minHeight: { xs: 360, md: 'auto' },
          height: { xs: mindmapHeight, md: '100%' },
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            height: '100%',
            position: 'relative',
          }}
        >
          <MindmapFlow mindmap={mindmap} />

          {/* Regenerate button */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              display: 'flex',
              gap: 1,
            }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportMindmapAsSvg(mindmap, `meeting-${summary.meeting_id}-mindmap`)}
              sx={{
                bgcolor: isDark ? '#1A1C24' : 'white',
                border: softBorder,
                borderRadius: 999,
                '&:hover': { bgcolor: isDark ? '#232633' : 'grey.50' },
              }}
            >
              导出 SVG
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={generating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
              onClick={handleGenerateMindMap}
              disabled={generating}
              sx={{
                bgcolor: isDark ? '#1A1C24' : 'white',
                border: softBorder,
                borderRadius: 999,
                '&:hover': { bgcolor: isDark ? '#232633' : 'grey.50' },
              }}
            >
              {generating ? '重新生成中...' : '重新生成'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Chat Panel */}
      <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 320 } }}>
        <MindmapChatPanel meetingId={summary.meeting_id} onMindmapUpdate={handleMindmapUpdate} />
      </Box>
    </Box>
  )
}
