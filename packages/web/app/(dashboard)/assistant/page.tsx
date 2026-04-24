'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Drawer from '@mui/material/Drawer'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import PersonIcon from '@mui/icons-material/Person'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import MeetingList from '@/components/assistant/MeetingList'
import TaskList from '@/components/assistant/TaskList'
import ChatSidebar from '@/components/assistant/ChatSidebar'
import CreateMeetingForm from '@/components/assistant/CreateMeetingForm'
import MindmapFlow from '@/components/meetings/MindmapFlow'
import ConfirmDialog from '@/components/ConfirmDialog'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { request } from '@/libs/request'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  suggestions?: string[]
  component?: {
    type: 'meeting_list' | 'task_list' | 'form' | 'mindmap' | 'slides' | 'email' | 'calendar' | 'download' | 'analysis'
    data?: any
    form_type?: string
    fields?: Array<{ name: string; label: string; type: string; required: boolean }>
    prefill?: Record<string, string>
  }
}

interface AgentProfile {
  id: string
  name: string
  description?: string
  prompt: string
  is_default?: boolean
}

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: 'default',
    name: '默认助手',
    description: '通用会议协作与问答',
    prompt: '',
    is_default: true,
  },
]

export default function AssistantPage() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const newChatRef = useRef<string | null>(null)
  const [agents, setAgents] = useState<AgentProfile[]>(DEFAULT_AGENTS)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('default')
  const [agentDialogOpen, setAgentDialogOpen] = useState(false)
  const [agentManageOpen, setAgentManageOpen] = useState(false)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [agentForm, setAgentForm] = useState({ name: '', description: '', prompt: '' })
  const [agentFormError, setAgentFormError] = useState<string | null>(null)
  const [agentDeleteId, setAgentDeleteId] = useState<string | null>(null)
  const [agentDeleteOpen, setAgentDeleteOpen] = useState(false)
  const [agentSaving, setAgentSaving] = useState(false)
  const [sidebarRefreshToken, setSidebarRefreshToken] = useState(0)
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const slidesPollRef = useRef<Record<string, number>>({})
  const analysisPollRef = useRef<Record<string, number>>({})
  const slidesNotifiedRef = useRef<Record<string, boolean>>({})
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const api = useMemo(() => request(), [])

  // Fetch dynamic suggestions
  const fetchSuggestions = async () => {
    try {
      const data = await api.get<{ suggestions: string[] }>('/v1/assistant/suggestions')
      return data.suggestions
    } catch (e) {
      console.error(e)
    }
    return ['查看我的任务', '搜索会议', '分析最近的会议']
  }

  const showWelcome = async () => {
    const suggestions = await fetchSuggestions()
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content:
          '您好！我是 MeetMind 助手。我们可以聊聊会议、任务或日程。\n您可以试着说："查看我的任务" 或 "搜索关于项目的会议"。',
        suggestions: suggestions,
      },
    ])
  }

  const fetchAgents = async (preferredId?: string) => {
    try {
      const data = await api.get<AgentProfile[]>('/v1/agents')
      if (Array.isArray(data) && data.length > 0) {
        setAgents(data)
        const targetId = preferredId || selectedAgentId
        if (targetId && data.find(a => a.id === targetId)) {
          setSelectedAgentId(targetId)
        } else {
          setSelectedAgentId('default')
        }
        return
      }
    } catch (e) {
      console.error('Failed to load agents', e)
    }
    setAgents(DEFAULT_AGENTS)
  }

  // Load chat history when activeChatId changes
  useEffect(() => {
    async function loadChat() {
      // New chat or no chat selected → show welcome
      if (!activeChatId) {
        return
      }

      // Just created this chat in sendMessage — keep current messages, don't reload
      if (newChatRef.current === activeChatId) {
        return
      }

      // Switching to an existing chat → load from server
      setLoading(true)
      try {
        const data = await api.get<{ messages: any[]; agent_id?: string | null }>(
          `/v1/chats/${activeChatId}`,
        )
        const uiMessages: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          type: m.role,
          content: m.content,
          component: m.component_data ? { ...m.component_data } : undefined,
        }))
        if (uiMessages.length > 0) {
          setMessages(uiMessages)
        } else {
          await showWelcome()
        }
        if (data.agent_id !== undefined) {
          setSelectedAgentId(data.agent_id || 'default')
        }
      } catch (e) {
        console.error('Failed to load chat', e)
      } finally {
        setLoading(false)
      }
    }
    loadChat()
  }, [activeChatId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!messages.length) return

    messages.forEach(msg => {
      if (msg.component?.type === 'slides') {
        const slides = msg.component.data
        const meetingId = slides?.meeting_id
        if (!meetingId) return
        const isProcessing = slides?.status === 'processing'
        const hasPoll = Boolean(slidesPollRef.current[meetingId])

        if (isProcessing && !hasPoll) {
          slidesNotifiedRef.current[meetingId] = false
          const intervalId = window.setInterval(async () => {
            try {
              const status = await api.get<any>(`/v1/meetings/${meetingId}/slides/status`)
              const nextData = { ...status, meeting_id: meetingId }
              setMessages(prev =>
                prev.map(m =>
                  m.id === msg.id && m.component
                    ? {
                        ...m,
                        component: { ...m.component, type: m.component.type!, data: nextData },
                      }
                    : m,
                ),
              )
              if (status?.status === 'completed') {
                window.clearInterval(intervalId)
                delete slidesPollRef.current[meetingId]
                if (!slidesNotifiedRef.current[meetingId]) {
                  slidesNotifiedRef.current[meetingId] = true
                  setMessages(prev => [
                    ...prev,
                    {
                      id: `${Date.now()}_slides_done`,
                      type: 'assistant',
                      content: 'PPT 已生成，可直接下载。',
                      component: { type: 'slides', data: nextData },
                    },
                  ])
                }
              }
            } catch (e) {
              console.error('Failed to poll slides status', e)
            }
          }, 3000)
          slidesPollRef.current[meetingId] = intervalId
        }

        if (!isProcessing && hasPoll) {
          window.clearInterval(slidesPollRef.current[meetingId])
          delete slidesPollRef.current[meetingId]
        }
      }

      if (msg.component?.type === 'analysis') {
        const analysis = msg.component.data
        const analysisId = analysis?.analysis_id
        const statusObj = analysis?.status
        if (!analysisId) return
        const isProcessing = statusObj?.status === 'processing'
        const hasPoll = Boolean(analysisPollRef.current[analysisId])

        if (isProcessing && !hasPoll) {
          const intervalId = window.setInterval(async () => {
            try {
              const status = await api.get<any>(`/v1/analysis/${analysisId}/status`)
              setMessages(prev =>
                prev.map(m =>
                  m.id === msg.id && m.component
                    ? {
                        ...m,
                        component: {
                          ...m.component,
                          type: m.component.type!,
                          data: {
                            ...analysis,
                            status,
                          },
                        },
                      }
                    : m,
                ),
              )
              if (status?.status && status.status !== 'processing') {
                window.clearInterval(intervalId)
                delete analysisPollRef.current[analysisId]
              }
            } catch (e) {
              console.error('Failed to poll analysis status', e)
            }
          }, 3000)
          analysisPollRef.current[analysisId] = intervalId
        }

        if (!isProcessing && hasPoll) {
          window.clearInterval(analysisPollRef.current[analysisId])
          delete analysisPollRef.current[analysisId]
        }
      }
    })
  }, [messages, api])

  useEffect(() => {
    fetchAgents(selectedAgentId)
    showWelcome()
  }, [])

  // Track agent changes initiated by the user (not by loading a chat)
  const agentChangedByUser = useRef(false)
  const handleAgentChange = (newAgentId: string) => {
    agentChangedByUser.current = true
    setSelectedAgentId(newAgentId)
  }

  useEffect(() => {
    if (!activeChatId || !agentChangedByUser.current) return
    agentChangedByUser.current = false
    const updateAgent = async () => {
      try {
        await api.patch(`/v1/chats/${activeChatId}`, {
          data: {
            agent_id: selectedAgentId,
          },
        })
        setSidebarRefreshToken(prev => prev + 1)
      } catch (e) {
        console.error('Failed to update chat agent', e)
      }
    }
    updateAgent()
  }, [activeChatId, selectedAgentId, api])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort?.()
        } catch {}
      }
      Object.values(slidesPollRef.current).forEach(id => window.clearInterval(id))
      Object.values(analysisPollRef.current).forEach(id => window.clearInterval(id))
    }
  }, [])

  const handleVoiceInput = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError('当前浏览器不支持语音识别')
      return
    }
    setVoiceError(null)

    if (voiceListening) {
      try {
        recognitionRef.current?.stop?.()
      } catch {}
      setVoiceListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    setVoiceListening(true)

    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim()
      if (text) {
        setInput(prev => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${text}` : text))
      }
    }
    recognition.onerror = () => {
      setVoiceError('语音识别失败，请重试')
      setVoiceListening(false)
    }
    recognition.onend = () => {
      setVoiceListening(false)
    }
    recognition.start()
  }

  const resetAgentForm = () => {
    setAgentForm({ name: '', description: '', prompt: '' })
    setAgentFormError(null)
    setEditingAgentId(null)
  }

  const handleSaveAgent = async () => {
    const name = agentForm.name.trim()
    const prompt = agentForm.prompt.trim()
    if (!name || !prompt) {
      setAgentFormError('请填写机器人名称和角色指令')
      return
    }
    setAgentSaving(true)
    try {
      if (editingAgentId) {
        await api.put<AgentProfile>(`/v1/agents/${editingAgentId}`, {
          data: {
            name,
            description: agentForm.description.trim() || undefined,
            prompt,
          },
        })
        handleAgentChange(editingAgentId)
        await fetchAgents(editingAgentId)
      } else {
        const created = await api.post<AgentProfile>('/v1/agents', {
          data: {
            name,
            description: agentForm.description.trim() || undefined,
            prompt,
          },
        })
        handleAgentChange(created.id)
        await fetchAgents(created.id)
      }
      setAgentDialogOpen(false)
      resetAgentForm()
    } catch (e) {
      console.error('Failed to save agent', e)
      setAgentFormError('保存失败，请稍后重试')
    } finally {
      setAgentSaving(false)
    }
  }

  const handleEditAgent = (agent: AgentProfile) => {
    setEditingAgentId(agent.id)
    setAgentForm({
      name: agent.name,
      description: agent.description || '',
      prompt: agent.prompt || '',
    })
    setAgentFormError(null)
    setAgentDialogOpen(true)
    setAgentManageOpen(false)
  }

  const handleDeleteAgent = (agentId: string) => {
    setAgentDeleteId(agentId)
    setAgentDeleteOpen(true)
  }

  const confirmDeleteAgent = async () => {
    if (!agentDeleteId) return
    try {
      await api.delete(`/v1/agents/${agentDeleteId}`)
      if (selectedAgentId === agentDeleteId) {
        handleAgentChange('default')
        await fetchAgents('default')
      } else {
        await fetchAgents(selectedAgentId)
      }
    } catch (e) {
      console.error('Failed to delete agent', e)
    } finally {
      setAgentDeleteOpen(false)
      setAgentDeleteId(null)
    }
  }

  const getSelectedAgent = () => agents.find(a => a.id === selectedAgentId) || agents[0]
  const customAgents = agents.filter(a => !a.is_default && a.id !== 'default')

  const handleDownload = (download: {
    filename?: string
    content?: string
    mime?: string
    url?: string
  }) => {
    if (!download?.content) return
    const blob = new Blob([download.content], { type: download.mime || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = download.filename || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ChatGPT-style: "New chat" just resets UI, no API call
  const handleNewChat = () => {
    setActiveChatId(null)
    setMessages([])
    showWelcome()
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    // Optimistically show user message + clear input
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
    }
    setMessages(prev => {
      // Remove welcome message when first real message is sent
      const filtered = prev.filter(m => m.id !== 'welcome')
      return [...filtered, userMessage]
    })
    setInput('')
    setLoading(true)

    let currentChatId = activeChatId

    try {
      // 1. If no active chat, create one now (on first message, like ChatGPT)
      if (!currentChatId) {
        const newChat = await api.post<{ id: string }>('/v1/chats', {
          data: {
            title: text.slice(0, 40),
            agent_id: selectedAgentId,
          },
        })
        currentChatId = newChat.id
        newChatRef.current = currentChatId
        setActiveChatId(currentChatId)
        // Sidebar refreshes via activeChatId change in ChatSidebar's useEffect
      }

      // 2. Send message to AI
      const data = await api.post<{
        message?: string
        suggestions?: string[]
        component?: Message['component']
      }>('/v1/assistant/chat', {
        data: {
          instruction: text,
          conversation_id: currentChatId,
          agent_id: selectedAgentId,
        },
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.message || '操作已完成',
        suggestions: data.suggestions,
        component: data.component,
      }
      setMessages(prev => [...prev, assistantMessage])

      // 3. After first reply, update title + refresh sidebar
      if (newChatRef.current === currentChatId) {
        newChatRef.current = null
        setSidebarRefreshToken(prev => prev + 1)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: '抱歉，发生了错误，请稍后重试。',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' }, // viewport - AppBar only
        display: 'flex',
        gap: 0,
        m: { xs: -2, sm: -3 }, // Counteract all parent padding
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          anchor="bottom"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          ModalProps={{ keepMounted: true }}
          BackdropProps={{ invisible: true }}
          PaperProps={{
            sx: {
              height: '45vh',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          }}
        >
          <ChatSidebar
            width="100%"
            activeChatId={activeChatId}
            agents={agents}
            refreshKey={sidebarRefreshToken}
            onSelectChat={id => {
              setActiveChatId(id)
              setSidebarOpen(false)
            }}
            onNewChat={() => {
              handleNewChat()
              setSidebarOpen(false)
            }}
          />
        </Drawer>
      ) : (
        <ChatSidebar
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onNewChat={handleNewChat}
          agents={agents}
          refreshKey={sidebarRefreshToken}
        />
      )}

      {/* Main Chat Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ width: '100%', justifyContent: { sm: 'flex-end' } }}
          >
            {isMobile ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  onClick={() => setAgentPickerOpen(true)}
                  sx={{
                    flexGrow: 1,
                    justifyContent: 'space-between',
                    borderRadius: 16,
                    px: 1.5,
                    py: 1,
                    textTransform: 'none',
                    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.35 : 0.22),
                      }}
                    >
                      <SmartToyIcon color="primary" fontSize="small" />
                    </Box>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {getSelectedAgent()?.name || '默认助手'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getSelectedAgent()?.description || '通用会议协作与问答'}
                      </Typography>
                    </Box>
                  </Box>
                  <ExpandMoreIcon />
                </Button>
                <IconButton
                  onClick={() => setSidebarOpen(true)}
                  size="large"
                  sx={{
                    borderRadius: 14,
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Stack>
            ) : (
              <>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="agent-select-label">机器人</InputLabel>
                  <Select
                    labelId="agent-select-label"
                    value={selectedAgentId}
                    label="机器人"
                    onChange={e => handleAgentChange(e.target.value)}
                  >
                    {agents.map(agent => (
                      <MenuItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </MenuItem>
                    ))}
                    </Select>
                </FormControl>

                <Stack direction="row" spacing={1}>
                  <Button variant="text" onClick={() => setAgentManageOpen(true)}>
                    管理机器人
                  </Button>
                  <Button
                      variant="contained"
                      onClick={() => {
                        resetAgentForm()
                        setAgentDialogOpen(true)
                      }}
                    >
                      创建机器人
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            p: 2,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'background.default',
          }}
        >
          {messages.map(msg => (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                gap: 1,
                alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                width: 'fit-content',
              }}
            >
              {msg.type === 'assistant' && (
                <SmartToyIcon color="primary" sx={{ mt: 0.5, flexShrink: 0 }} />
              )}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: msg.type === 'user' ? 'primary.main' : 'background.paper',
                    color: msg.type === 'user' ? 'white' : 'text.primary',
                    borderRadius: 2,
                    boxShadow: 1,
                    maxWidth: '100%',
                    '& p': { m: 0 },
                    '& p + p': { mt: 1 },
                    '& ul, & ol': { m: 0, pl: 2.5 },
                    '& li': { mb: 0.5 },
                    '& code': {
                      bgcolor: msg.type === 'user' ? 'rgba(255,255,255,0.2)' : 'grey.100',
                      px: 0.5,
                      borderRadius: 0.5,
                      fontFamily: 'monospace',
                      fontSize: '0.875em',
                    },
                    '& pre': {
                      bgcolor: msg.type === 'user' ? 'rgba(255,255,255,0.15)' : 'grey.100',
                      p: 1.5,
                      borderRadius: 1,
                      overflow: 'auto',
                      '& code': { bgcolor: 'transparent', p: 0 },
                    },
                    '& strong': { fontWeight: 600 },
                    '& a': { color: msg.type === 'user' ? 'inherit' : 'primary.main' },
                  }}
                >
                  {msg.type === 'user' ? (
                    <Typography sx={{ whiteSpace: 'pre-line' }}>{msg.content}</Typography>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  )}
                </Paper>

                {/* Component Rendering */}
                {msg.component?.type === 'meeting_list' && (
                  <MeetingList meetings={msg.component.data} />
                )}
                {msg.component?.type === 'task_list' && <TaskList tasks={msg.component.data} />}
                {msg.component?.type === 'form' && msg.component.form_type === 'create_meeting' && (
                  <CreateMeetingForm
                    fields={msg.component.fields || []}
                    prefill={msg.component.prefill}
                    onSubmit={data => {
                      sendMessage(`创建一个新会议，名称为 ${data.title}`)
                    }}
                    onCancel={() => {
                      // Remove form by updating message
                      setMessages(prev =>
                        prev.map(m => (m.id === msg.id ? { ...m, component: undefined } : m)),
                      )
                    }}
                  />
                )}
                {msg.component?.type === 'mindmap' && (
                  <Paper
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      思维导图
                    </Typography>
                    <MindmapFlow mindmap={msg.component.data} />
                  </Paper>
                )}
                {msg.component?.type === 'slides' && (
                  <Paper
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      PPT 生成
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {msg.component.data?.message || '处理中...'}
                    </Typography>
                    {typeof msg.component.data?.progress === 'number' && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, Math.max(0, msg.component.data.progress))}
                        sx={{ mb: 1 }}
                      />
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {msg.component.data?.preview_url && (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={msg.component.data.preview_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          预览
                        </Button>
                      )}
                      {msg.component.data?.export_urls?.pptx && (
                        <Button
                          size="small"
                          variant="contained"
                          component="a"
                          href={msg.component.data.export_urls.pptx}
                          target="_blank"
                          rel="noreferrer"
                        >
                          下载 PPTX
                        </Button>
                      )}
                      {msg.component.data?.export_urls?.pdf && (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={msg.component.data.export_urls.pdf}
                          target="_blank"
                          rel="noreferrer"
                        >
                          下载 PDF
                        </Button>
                      )}
                    </Box>
                  </Paper>
                )}
                {msg.component?.type === 'email' && (
                  <Paper
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      邮件草稿
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {msg.component.data?.subject || '无标题'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.component.data?.body || '无内容'}
                    </Typography>
                    {msg.component.data?.recipients?.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        收件人：{msg.component.data.recipients.join(', ')}
                      </Typography>
                    )}
                  </Paper>
                )}
                {msg.component?.type === 'calendar' && (
                  <Paper
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      日程事件
                    </Typography>
                    {Array.isArray(msg.component.data) && msg.component.data.length > 0 ? (
                      <List dense sx={{ p: 0 }}>
                        {msg.component.data.map((event: any, idx: number) => (
                          <ListItem key={idx} sx={{ px: 0 }}>
                            <ListItemText
                              primary={event.title || '会议事项'}
                              secondary={event.start_time || event.startTime || ''}
                              primaryTypographyProps={{ fontSize: 13 }}
                              secondaryTypographyProps={{ fontSize: 11 }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        暂无事件
                      </Typography>
                    )}
                  </Paper>
                )}
                {msg.component?.type === 'analysis' && (
                  <Paper
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      会议分析进度
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {msg.component.data?.status?.message || '分析中...'}
                    </Typography>
                    {typeof msg.component.data?.status?.progress === 'number' && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, Math.max(0, msg.component.data.status.progress))}
                        sx={{ mb: 1 }}
                      />
                    )}
                    {msg.component.data?.status?.status === 'completed' && (
                      <Typography variant="caption" color="success.main">
                        分析完成
                      </Typography>
                    )}
                  </Paper>
                )}
                {msg.component?.type === 'download' && (
                  <Paper
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      下载文件
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {msg.component.data?.filename || '文件已就绪'}
                    </Typography>
                    {msg.component.data?.url ? (
                      <Button
                        size="small"
                        variant="contained"
                        component="a"
                        href={msg.component.data.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        下载
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleDownload(msg.component!.data)}
                      >
                        下载
                      </Button>
                    )}
                  </Paper>
                )}

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                    {msg.suggestions.map((s, i) => (
                      <Chip
                        key={i}
                        label={s}
                        size="small"
                        onClick={() => sendMessage(s)}
                        clickable
                        sx={{ fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
              {msg.type === 'user' && <PersonIcon sx={{ mt: 0.5, flexShrink: 0 }} />}
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="caption" color="text.secondary">
                正在思考...
              </Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Paper
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            borderRadius: 0,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {voiceError && (
            <Typography variant="caption" color="error">
              {voiceError}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton
              onClick={handleVoiceInput}
              disabled={loading}
              sx={{
                bgcolor: voiceListening ? 'error.main' : isDark ? '#1A1C24' : 'grey.100',
                color: voiceListening ? 'white' : isDark ? 'rgba(255,255,255,0.88)' : 'text.primary',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                '&:hover': {
                  bgcolor: voiceListening ? 'error.dark' : isDark ? '#232633' : 'grey.200',
                },
              }}
            >
              {voiceListening ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
            <TextField
              fullWidth
              placeholder={voiceListening ? '正在聆听...' : '输入您的指令...'}
              variant="outlined"
              size="small"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              disabled={loading}
              autoComplete="off"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 999,
                },
              }}
            />
            <IconButton color="primary" onClick={() => sendMessage(input)} disabled={loading}>
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Box>

      <Dialog
        open={agentDialogOpen}
        onClose={() => {
          setAgentDialogOpen(false)
          resetAgentForm()
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingAgentId ? '编辑机器人' : '创建自定义机器人'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="机器人名称"
            value={agentForm.name}
            onChange={e => {
              setAgentForm(prev => ({ ...prev, name: e.target.value }))
              setAgentFormError(null)
            }}
            placeholder="如：纪要专家 / 会议纪要官"
            autoFocus
          />
          <TextField
            label="描述（可选）"
            value={agentForm.description}
            onChange={e => {
              setAgentForm(prev => ({ ...prev, description: e.target.value }))
              setAgentFormError(null)
            }}
            placeholder="简短说明这个机器人擅长什么"
          />
          <TextField
            label="角色指令"
            value={agentForm.prompt}
            onChange={e => {
              setAgentForm(prev => ({ ...prev, prompt: e.target.value }))
              setAgentFormError(null)
            }}
            placeholder="例如：你是会议纪要分析专家，回答要条理清晰，优先给出结论与行动项。"
            multiline
            minRows={3}
          />
          {agentFormError && (
            <Typography variant="caption" color="error">
              {agentFormError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAgentDialogOpen(false)
              resetAgentForm()
            }}
          >
            取消
          </Button>
          <Button variant="contained" onClick={handleSaveAgent} disabled={agentSaving}>
            {editingAgentId ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={agentManageOpen}
        onClose={() => setAgentManageOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>机器人管理</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {customAgents.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              暂无自定义机器人
            </Typography>
          ) : (
            <List>
              {customAgents.map(agent => (
                <ListItem
                  key={agent.id}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => handleEditAgent(agent)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteAgent(agent.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={agent.name}
                    secondary={agent.description || '无描述'}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: 12 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgentManageOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={agentDeleteOpen}
        title="删除机器人"
        content="确定要删除这个机器人吗？删除后关联对话将回退为默认助手。"
        onConfirm={confirmDeleteAgent}
        onCancel={() => {
          setAgentDeleteOpen(false)
          setAgentDeleteId(null)
        }}
        confirmColor="error"
        confirmText="删除"
      />

      <Drawer
        anchor="bottom"
        open={agentPickerOpen}
        onClose={() => setAgentPickerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            px: 2,
            py: 1,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            选择机器人
          </Typography>
          <IconButton size="small" onClick={() => setAgentPickerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <List sx={{ maxHeight: '40vh', overflow: 'auto' }}>
          {agents.map(agent => (
            <ListItemButton
              key={agent.id}
              selected={selectedAgentId === agent.id}
              onClick={() => {
                handleAgentChange(agent.id)
                setAgentPickerOpen(false)
              }}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={agent.name}
                secondary={agent.description || '通用会议协作与问答'}
                primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: 12 }}
              />
              {selectedAgentId === agent.id && <CheckIcon fontSize="small" color="primary" />}
            </ListItemButton>
          ))}
        </List>
        <Stack direction="row" spacing={1} sx={{ py: 1 }}>
          <Button
            fullWidth
            variant="text"
            onClick={() => {
              setAgentPickerOpen(false)
              setAgentManageOpen(true)
            }}
          >
            管理机器人
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              setAgentPickerOpen(false)
              resetAgentForm()
              setAgentDialogOpen(true)
            }}
          >
            创建机器人
          </Button>
        </Stack>
      </Drawer>
    </Box>
  )
}
