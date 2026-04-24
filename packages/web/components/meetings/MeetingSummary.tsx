'use client'

import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Divider from '@mui/material/Divider'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import type { Summary } from '@/interfaces'
import MeetingTasks from './MeetingTasks'
import { useState } from 'react'

interface MeetingSummaryProps {
  summary: Summary
  onGenerateOkr?: () => Promise<void> | void
  okrLoading?: boolean
  hasProject?: boolean
}

export default function MeetingSummary({
  summary,
  onGenerateOkr,
  okrLoading = false,
  hasProject = false,
}: MeetingSummaryProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const tabBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const [section, setSection] = useState<'summary' | 'tasks' | 'transcript'>('summary')

  const sections = [
    { key: 'summary', label: '会议纪要' },
    { key: 'tasks', label: '待办事项' },
    { key: 'transcript', label: '会议语音转写' },
  ] as const
  const summaryContent = (
    <Box>
      {summary.abstract && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            摘要
          </Typography>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: softBg,
              border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.04)',
            }}
          >
            <Typography variant="body1">{summary.abstract}</Typography>
          </Paper>
        </Box>
      )}

      {(summary.sentiment_score !== undefined ||
        (summary.emotion_flags && summary.emotion_flags.length > 0)) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            情绪与风险
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Chip
              label={`情绪评分 ${Math.round((summary.sentiment_score || 0) * 100)}`}
              size="small"
              sx={{ borderRadius: 999 }}
            />
            {summary.emotion_flags?.map((flag, idx) => (
              <Chip
                key={idx}
                label={flag}
                size="small"
                color="warning"
                variant={isMobile ? 'filled' : 'outlined'}
                sx={{ borderRadius: 999 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {summary.decisions?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            关键决定
          </Typography>
          <List dense sx={{ p: 0 }}>
            {summary.decisions.map((decision, i) => (
              <ListItem
                key={i}
                sx={{
                  bgcolor: softBg,
                  borderRadius: 2,
                  mb: 1,
                  py: 1,
                  px: 1.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckCircleOutlineIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={decision} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {summary.risks?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            风险与问题
          </Typography>
          <List dense sx={{ p: 0 }}>
            {summary.risks.map((risk, i) => (
              <ListItem
                key={i}
                sx={{
                  bgcolor: isDark ? '#2A1E1A' : '#FFF6F0',
                  borderRadius: 2,
                  mb: 1,
                  py: 1,
                  px: 1.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <WarningAmberIcon color="warning" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={risk} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  )

  const transcriptContent =
    summary.transcript?.length && summary.transcript.length > 0 ? (
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          会议录音转写
        </Typography>
        <List dense sx={{ p: 0 }}>
          {summary.transcript?.map((segment, i) => (
            <ListItem
              key={i}
              sx={{
                borderLeft: { xs: 0, sm: 3 },
                borderColor: segment.speaker === 'Speaker 1' ? 'primary.main' : 'secondary.main',
                pl: { xs: 1.5, sm: 2 },
                mb: 1,
                bgcolor: softBg,
                borderRadius: 2,
              }}
            >
              <ListItemText
                primary={segment.text}
                secondaryTypographyProps={{ component: 'div' }}
                secondary={
                  <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={segment.speaker} size="small" sx={{ borderRadius: 999 }} />
                    <Chip
                      label={`${Math.floor(segment.start / 60)}:${(segment.start % 60).toString().padStart(2, '0')} - ${Math.floor(segment.end / 60)}:${(segment.end % 60).toString().padStart(2, '0')}`}
                      size="small"
                      variant={isMobile ? 'filled' : 'outlined'}
                      sx={{ borderRadius: 999 }}
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    ) : (
      <Typography variant="body2" color="text.secondary">
        暂无转写内容
      </Typography>
    )

  return (
    <Paper
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderRadius: { xs: 3, sm: 2 },
        border: softBorder,
        boxShadow: {
          xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
          sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
        },
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          会议纪要
        </Typography>
        {onGenerateOkr && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<FlagOutlinedIcon />}
            disabled={okrLoading}
            onClick={() => {
              void onGenerateOkr()
            }}
            sx={{ borderRadius: 999 }}
          >
            {okrLoading ? '生成中...' : hasProject ? '查看 OKR' : '生成 OKR'}
          </Button>
        )}
      </Box>

      {isMobile ? (
        <>
          <Tabs
            value={section}
            onChange={(_, value) => {
              setSection(value)
            }}
            variant="scrollable"
            scrollButtons={false}
            sx={{
              bgcolor: tabBg,
              borderRadius: 999,
              p: 0.5,
              minHeight: 40,
              '& .MuiTabs-scroller': {
                overflowX: 'auto',
                '&::-webkit-scrollbar': { display: 'none' },
              },
              '& .MuiTabs-flexContainer': {
                justifyContent: 'center',
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            {sections.map(item => (
              <Tab
                key={item.key}
                value={item.key}
                label={item.label}
                sx={{
                  textTransform: 'none',
                  minHeight: 34,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 999,
                  minWidth: 'auto',
                  px: 1.5,
                  '&.Mui-selected': {
                    bgcolor: isDark ? '#1A1C24' : 'background.paper',
                    boxShadow: isDark
                      ? '0 6px 16px rgba(0,0,0,0.5)'
                      : '0 6px 16px rgba(0,0,0,0.08)',
                  },
                }}
              />
            ))}
          </Tabs>

          <Box sx={{ mt: 2 }}>
            {section === 'summary' && summaryContent}
            {section === 'tasks' && (
              <MeetingTasks
                meetingId={summary.meeting_id}
                actionItems={summary.action_items || []}
                transcript={summary.transcript || []}
              />
            )}
            {section === 'transcript' && transcriptContent}
          </Box>
        </>
      ) : (
        <>
          {summaryContent}

          {/* 
            Replaced static Action Items with dynamic Task Manager. 
            Note: summary.action_items is still used for initial creation, 
            but UI now relies on the API via MeetingTasks.
          */}
          <MeetingTasks
            meetingId={summary.meeting_id}
            actionItems={summary.action_items || []}
            transcript={summary.transcript || []}
          />
          <Divider sx={{ my: 2 }} />
          {transcriptContent}
        </>
      )}
    </Paper>
  )
}
