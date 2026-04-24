'use client'

import Link from 'next/link'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MicIcon from '@mui/icons-material/Mic'
import SummarizeIcon from '@mui/icons-material/Summarize'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { MeetingListItem } from '@/interfaces'

interface MeetingCardProps {
  meeting: MeetingListItem
  onDelete?: (id: string) => void
}

export default function MeetingCard({ meeting, onDelete }: MeetingCardProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未设置时间'
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: { xs: 3, sm: 2 },
        border: softBorder,
        boxShadow: {
          xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
          sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
        },
        bgcolor: 'background.paper',
      }}
    >
      <CardContent sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              maxWidth: '85%',
              fontWeight: 600,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {meeting.title}
          </Typography>
          <IconButton
            color="error"
            size="small"
            onClick={() => onDelete?.(meeting.id)}
            title="删除会议"
            sx={{
              bgcolor: isDark ? '#1A1C24' : 'grey.100',
              border: softBorder,
            }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {formatDate(meeting.start_time)}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          {meeting.has_recording && (
            <Chip
              icon={<MicIcon />}
              label="有录音"
              size="small"
              color="primary"
              variant={isMobile ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
          )}
          {meeting.has_summary && (
            <Chip
              icon={<SummarizeIcon />}
              label="已总结"
              size="small"
              color="success"
              variant={isMobile ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: '100%' }}>
          {meeting.tags.slice(0, 3).map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant={isMobile ? 'filled' : 'outlined'}
              sx={{
                borderRadius: 999,
                maxWidth: '100%',
                '& .MuiChip-label': {
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          ))}
          {meeting.tags.length > 3 && (
            <Chip
              label={`+${meeting.tags.length - 3}`}
              size="small"
              variant={isMobile ? 'filled' : 'outlined'}
              sx={{
                borderRadius: 999,
                maxWidth: '100%',
                '& .MuiChip-label': {
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          )}
        </Box>
      </CardContent>

      <CardActions
        sx={{
          mt: 'auto',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          pb: 2,
        }}
      >
        <Button
          size="small"
          component={Link}
          href={`/meetings/${meeting.id}`}
          sx={{
            borderRadius: 999,
            px: 2,
            bgcolor: { xs: '#007AFF', sm: 'transparent' },
            color: { xs: 'white', sm: 'primary.main' },
            '&:hover': { bgcolor: { xs: '#0A84FF', sm: 'transparent' } },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          查看详情
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: { xs: 0, sm: 'auto' }, mr: 1 }}
        >
          {meeting.participants_count} 人参会
        </Typography>
      </CardActions>
    </Card>
  )
}
