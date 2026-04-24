'use client'

import type React from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkIcon from '@mui/icons-material/Link'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { useTheme } from '@mui/material/styles'
import type { Task } from '@/interfaces'

interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
  onDelete?: (id: string) => void
  onComplete?: (id: string) => void
  onPlay?: (task: Task) => void
  onStart?: (task: Task) => void
  highlighted?: boolean
  draggable?: boolean
  onDragStart?: (id: string, e: React.DragEvent<HTMLDivElement>) => void
}

const priorityColors: Record<string, 'error' | 'warning' | 'success'> = {
  high: 'error',
  medium: 'warning',
  low: 'success',
}

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  todo: 'default',
  in_progress: 'primary',
  done: 'success',
  blocked: 'error',
}

const statusLabels: Record<string, string> = {
  todo: '待处理',
  in_progress: '进行中',
  done: '已完成',
  blocked: '阻塞',
}

const formatPlaybackTime = (seconds?: number) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return null
  }

  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onComplete,
  onPlay,
  onStart,
  highlighted,
  draggable,
  onDragStart,
}: TaskCardProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const hasPlayback = Boolean(task.source_meeting?.meeting_id)
  const playbackTime = formatPlaybackTime(task.source_segment_start)
  return (
    <Paper
      draggable={draggable}
      onDragStart={draggable ? e => onDragStart?.(task.id, e) : undefined}
      sx={{
        p: 2,
        mb: 1.5,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        border: highlighted ? '2px solid' : `1px solid ${softBorder}`,
        borderColor: highlighted ? 'primary.main' : softBorder,
        bgcolor: highlighted ? (isDark ? 'rgba(255,255,255,0.04)' : 'action.hover') : 'background.paper',
        transition: 'all 0.3s',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip
              label={statusLabels[task.status]}
              color={statusColors[task.status]}
              size="small"
            />
            <Chip
              label={task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
              color={priorityColors[task.priority]}
              size="small"
              variant="outlined"
            />
          </Box>

          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 500,
              overflowWrap: 'anywhere',
              wordBreak: 'break-all',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            {task.title}
          </Typography>

          {task.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                overflowWrap: 'anywhere',
                wordBreak: 'break-all',
                maxWidth: '100%',
                minWidth: 0,
              }}
            >
              {task.description}
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              mt: 1,
              flexWrap: 'wrap',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            {task.assignee && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                  maxWidth: '100%',
                  minWidth: 0,
                }}
              >
                👤 {task.assignee}
              </Typography>
            )}
            {task.due_date && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                  maxWidth: '100%',
                  minWidth: 0,
                }}
              >
                📅 {task.due_date}
              </Typography>
            )}
            {task.source_meeting && (
              <Typography
                variant="caption"
                color="primary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  maxWidth: '100%',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                  minWidth: 0,
                  flex: '1 1 100%',
                  '& .MuiSvgIcon-root': { flexShrink: 0 },
                }}
              >
                <LinkIcon fontSize="inherit" /> {task.source_meeting.title}
              </Typography>
            )}
            {playbackTime && (
              <Chip
                label={`时间点 ${playbackTime}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ borderRadius: 999 }}
              />
            )}
            {task.okr && (
              <Chip
                label={`OKR ${Math.round(task.okr.progress)}% · ${task.okr.key_result_title}`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 999 }}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
          {hasPlayback && onPlay && (
            <IconButton
              size="small"
              color="primary"
              onClick={() => onPlay(task)}
              title={playbackTime ? '回放' : '查看会议'}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          )}
          {(task.status === 'todo' || task.status === 'blocked') && onStart && (
            <IconButton size="small" color="warning" onClick={() => onStart(task)} title="Start">
              <AutorenewIcon fontSize="small" />
            </IconButton>
          )}
          {task.status !== 'done' && onComplete && (
            <IconButton
              size="small"
              color="success"
              onClick={() => onComplete(task.id)}
              title="完成"
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
          {onEdit && (
            <IconButton size="small" onClick={() => onEdit(task)} title="编辑">
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton size="small" color="error" onClick={() => onDelete(task.id)} title="删除">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>
    </Paper>
  )
}
