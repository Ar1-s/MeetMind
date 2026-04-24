'use client'

import { useState, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import SendIcon from '@mui/icons-material/Send'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { editMindmap, fetchMindmapChatHistory } from '@/libs/api/mindmap'
import type { MindmapData } from '@/interfaces'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface MindmapChatPanelProps {
  meetingId: string
  onMindmapUpdate: (mindmap: MindmapData) => void
}

export default function MindmapChatPanel({ meetingId, onMindmapUpdate }: MindmapChatPanelProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const softBgAlt = isDark ? '#151820' : '#F2F2F7'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const bubbleBg = isDark ? '#1E212B' : 'white'
  const bubbleShadow = isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)'
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await fetchMindmapChatHistory(meetingId)
        if (history && history.length > 0) {
          const formattedHistory: ChatMessage[] = history.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at),
          }))
          setMessages(formattedHistory)
        }
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    }
    loadHistory()
  }, [meetingId])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }])

    setLoading(true)
    try {
      const updatedMindmap = await editMindmap(meetingId, userMessage)
      onMindmapUpdate(updatedMindmap)

      // Add assistant response
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `已根据您的指令更新思维导图 (${updatedMindmap.nodes.length} 个节点)`,
          timestamp: new Date(),
        },
      ])
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `操作失败: ${error.message || '未知错误'}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: { xs: 3, sm: 2 },
        border: softBorder,
        boxShadow: {
          xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
          sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
        },
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: softBorder,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: softBg,
        }}
      >
        <AutoAwesomeIcon sx={{ color: '#007AFF' }} />
        <Typography variant="subtitle1" fontWeight={600}>
          编辑助手
        </Typography>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: softBgAlt,
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              py: 4,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">输入指令来编辑思维导图</Typography>
            <Typography variant="caption" color="text.disabled">
              例如：&quot;添加一个关于预算的节点&quot;
            </Typography>
          </Box>
        )}

        {messages.map((msg, index) => (
          <Box
            key={index}
            sx={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 3,
                bgcolor: msg.role === 'user' ? '#007AFF' : bubbleBg,
                color: msg.role === 'user' ? 'white' : 'text.primary',
                boxShadow: msg.role === 'user' ? 'none' : bubbleShadow,
              }}
            >
              <Typography variant="body2">{msg.content}</Typography>
            </Paper>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              正在处理...
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 2,
          borderTop: softBorder,
          display: 'flex',
          gap: 1,
          bgcolor: softBg,
          position: isMobile ? 'sticky' : 'static',
          bottom: 0,
          zIndex: 1,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="输入编辑指令..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: isDark ? '#101217' : 'white',
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)',
              },
            },
          }}
        />
        <IconButton
          type="submit"
          color="primary"
          disabled={!input.trim() || loading}
          sx={{
            bgcolor: '#007AFF',
            color: 'white',
            '&:hover': { bgcolor: '#0A84FF' },
            '&:disabled': { bgcolor: 'action.disabledBackground' },
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  )
}
