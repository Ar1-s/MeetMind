'use client'

import { Suspense, useState, useEffect, useCallback, use, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import LinearProgress from '@mui/material/LinearProgress'
import ButtonBase from '@mui/material/ButtonBase'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MicIcon from '@mui/icons-material/Mic'
import SummarizeIcon from '@mui/icons-material/Summarize'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EmailIcon from '@mui/icons-material/Email'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import EditIcon from '@mui/icons-material/Edit'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { createProjectFromMeeting, getMeeting, getMeetingSummary, updateMeeting } from '@/libs/api'
import { getMeetingRecordings, deleteRecording } from '@/libs/api/recordings'
import { startAnalysis, getAnalysisStatus, type AnalysisStatusResponse } from '@/libs/api/analysis'
import {
  generateEmailDraft,
  downloadIcs,
  sendEmail,
  getCalendarSubscribeUrl,
} from '@/libs/api/integrations'
import { createMeetingMemory, listMeetingMemories } from '@/libs/api/memory'
import { getRelatedTasks } from '@/libs/api/tasks'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import {
  ImportRecordingDialog,
  MeetingSummary,
  AudioPlayer,
  MeetingMindMap,
} from '@/components/meetings'
import { SlideEditor } from '@/components/slides'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useToastStore } from '@/libs/stores'
import {
  getDisplayParticipants,
  getDisplaySummary,
  replaceParticipantNames,
} from '@/libs/utils/meetingAnonymization'
import type { Meeting, Recording, Summary } from '@/interfaces'

interface PageProps {
  params: Promise<{ id: string }>
}

function MeetingDetailPageContent({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const seekParam = searchParams.get('seek')
  const seekTo = seekParam ? Number(seekParam) : undefined
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [anonymizeSaving, setAnonymizeSaving] = useState(false)
  const [editForm, setEditForm] = useState<{
    title: string
    start_time: string
    tags: string[]
  }>({
    title: '',
    start_time: '',
    tags: [],
  })
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState('md')
  const [okrPromptOpen, setOkrPromptOpen] = useState(false)
  const [okrLoading, setOkrLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<{
    progress: number
    message: string
    steps?: { label: string; progress: number }[]
  }>({ progress: 0, message: '' })
  const [analysisError, setAnalysisError] = useState<string>('')
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailDraft, setEmailDraft] = useState<{
    subject: string
    body: string
    recipients: string[]
  }>({
    subject: '',
    body: '',
    recipients: [],
  })
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false)
  const [smtpErrorMessage, setSmtpErrorMessage] = useState('')
  const [slidesOpen, setSlidesOpen] = useState(false)
  const [deleteRecordingId, setDeleteRecordingId] = useState<string | null>(null)
  const [memories, setMemories] = useState<
    Array<{ id: string; title?: string; content: string; created_at: string }>
  >([])
  const [memoryDraft, setMemoryDraft] = useState('')
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memorySearch, setMemorySearch] = useState('')
  const [relatedTasks, setRelatedTasks] = useState<any[]>([])
  const [relatedTasksExpanded, setRelatedTasksExpanded] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const analysisPollTimeoutRef = useRef<number | null>(null)
  const toastSuccess = useToastStore(state => state.success)
  const toastError = useToastStore(state => state.error)

  const filteredMemories = useMemo(() => {
    if (!memorySearch.trim()) return memories
    const search = memorySearch.toLowerCase()
    return memories.filter(
      m =>
        (m.title && m.title.toLowerCase().includes(search)) ||
      m.content.toLowerCase().includes(search),
    )
  }, [memories, memorySearch])

  const displayParticipants = useMemo(() => getDisplayParticipants(meeting), [meeting])
  const displaySummary = useMemo(() => getDisplaySummary(summary, meeting), [meeting, summary])

  const fetchMeeting = useCallback(async () => {
    try {
      const data = await getMeeting(id)
      // The API returns meeting data, transform to our expected format
      const meetingData = data as unknown as Meeting
      setMeeting(meetingData)
      // Update edit form with current meeting data
      setEditForm({
        title: meetingData.title || '',
        start_time: meetingData.start_time || '',
        tags: meetingData.tags || [],
      })
      const recordingsRes = await getMeetingRecordings(id)
      setRecordings(recordingsRes.recordings || [])
      let summaryData: Summary | null = null
      try {
        const summaryRes = await getMeetingSummary(id)
        summaryData = summaryRes as Summary
        setSummary(summaryData)
      } catch {
        setSummary(null)
      }
      return {
        meeting: meetingData,
        summary: summaryData,
      }
    } catch (error) {
      console.error('Failed to fetch meeting:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchMeeting()
  }, [fetchMeeting])

  const clearAnalysisPolling = useCallback(() => {
    if (analysisPollTimeoutRef.current !== null) {
      window.clearTimeout(analysisPollTimeoutRef.current)
      analysisPollTimeoutRef.current = null
    }
  }, [])

  const normalizeAnalysisProgress = useCallback((status: string, progress?: number) => {
    const rawProgress = typeof progress === 'number' ? progress : 0
    if (status === 'completed' || status === 'done') {
      return 100
    }
    return Math.min(Math.max(rawProgress, 0), 99)
  }, [])

  const applyAnalysisStatus = useCallback(
    async (statusResult: AnalysisStatusResponse, options?: { silentFailure?: boolean }) => {
      setAnalysisStatus({
        progress: normalizeAnalysisProgress(statusResult.status, statusResult.progress),
        message: statusResult.message || '正在处理...',
        steps: statusResult.steps,
      })
      setEtaSeconds(statusResult.eta_seconds ?? null)

      if (statusResult.status === 'completed' || statusResult.status === 'done') {
        clearAnalysisPolling()
        const refreshed = await fetchMeeting()
        setAnalyzing(false)
        setAnalysisStatus({ progress: 0, message: '' })
        setAnalysisError('')
        setEtaSeconds(null)
        if (analyzing && refreshed?.summary && !refreshed.meeting.project_id) {
          setTab(1)
          setOkrPromptOpen(true)
        }
        return true
      }

      if (statusResult.status === 'failed' || statusResult.status === 'error') {
        clearAnalysisPolling()
        setAnalyzing(false)
        setAnalysisError(statusResult.message || '生成纪要失败')
        if (!options?.silentFailure) {
          console.error('Analysis failed:', statusResult.message)
        }
        return true
      }

      setAnalyzing(true)
      return false
    },
    [analyzing, clearAnalysisPolling, fetchMeeting, normalizeAnalysisProgress],
  )

  const pollAnalysisStatus = useCallback(
    async (analysisId: string, options?: { silentFailure?: boolean }) => {
      const statusResult = await getAnalysisStatus(analysisId)
      return applyAnalysisStatus(statusResult, options)
    },
    [applyAnalysisStatus],
  )

  const scheduleAnalysisPoll = useCallback(
    (analysisId: string) => {
      clearAnalysisPolling()
      analysisPollTimeoutRef.current = window.setTimeout(async () => {
        try {
          const finished = await pollAnalysisStatus(analysisId, { silentFailure: true })
          if (!finished) {
            scheduleAnalysisPoll(analysisId)
          }
        } catch (error) {
          console.error('Error checking analysis status:', error)
          scheduleAnalysisPoll(analysisId)
        }
      }, 2000)
    },
    [clearAnalysisPolling, pollAnalysisStatus],
  )

  const resumeAnalysis = useCallback(async () => {
    const analysisId = `analysis_${id}`
    try {
      const finished = await pollAnalysisStatus(analysisId, { silentFailure: true })
      if (!finished) {
        scheduleAnalysisPoll(analysisId)
      }
    } catch {
      setAnalyzing(false)
    }
  }, [id, pollAnalysisStatus, scheduleAnalysisPoll])

  useEffect(() => {
    resumeAnalysis()

    return () => {
      clearAnalysisPolling()
    }
  }, [clearAnalysisPolling, resumeAnalysis])

  const fetchMemories = useCallback(async () => {
    try {
      const res = await listMeetingMemories(id)
      setMemories(res.memories || [])
    } catch (error) {
      console.error('Failed to fetch memories:', error)
    }
  }, [id])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  useEffect(() => {
    if (meeting?.project_id) {
      getRelatedTasks({ project_id: meeting.project_id, exclude_meeting_id: id })
        .then(tasks => setRelatedTasks(tasks || []))
        .catch(err => console.error('Failed to fetch related tasks:', err))
    }
  }, [meeting?.project_id, id])

  const handleAddMemory = async () => {
    if (!memoryDraft.trim()) return
    setMemoryLoading(true)
    try {
      await createMeetingMemory(id, meeting?.title || null, memoryDraft.trim())
      setMemoryDraft('')
      await fetchMemories()
    } catch (error) {
      console.error('Failed to create memory:', error)
    } finally {
      setMemoryLoading(false)
    }
  }

  const handleEditSubmit = async () => {
    try {
      await updateMeeting(id, editForm)
      setEditOpen(false)
      // Refresh meeting data
      await fetchMeeting()
    } catch (error) {
      console.error('Failed to update meeting:', error)
    }
  }

  const handleToggleAnonymization = useCallback(
    async (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      if (!meeting) return

      setAnonymizeSaving(true)
      try {
        const updatedMeeting = await updateMeeting(id, { anonymize_participants: checked })
        setMeeting(updatedMeeting as Meeting)
        toastSuccess(checked ? '已开启参会人匿名' : '已关闭参会人匿名')
      } catch (error) {
        console.error('Failed to update anonymization:', error)
        toastError('更新匿名设置失败')
        await fetchMeeting()
      } finally {
        setAnonymizeSaving(false)
      }
    },
    [fetchMeeting, id, meeting, toastError, toastSuccess],
  )

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  const handleExportSubmit = async () => {
    try {
      if (!displaySummary || !meeting) return

      // Generate export content based on format
      let content = ''
      let fileName = `${meeting.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_会议纪要`
      let mimeType = ''

      switch (exportFormat) {
        case 'md':
          fileName += '.md'
          mimeType = 'text/markdown'
          content = generateMarkdownExport(displaySummary, meeting)
          break
        case 'txt':
          fileName += '.txt'
          mimeType = 'text/plain'
          content = generateTextExport(displaySummary, meeting)
          break
        case 'word':
          fileName += '.doc'
          mimeType = 'application/msword'
          content = generateWordExport(displaySummary, meeting)
          break
        default:
          fileName += '.md'
          mimeType = 'text/markdown'
          content = generateMarkdownExport(displaySummary, meeting)
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportOpen(false)
    } catch (error) {
      console.error('Failed to export summary:', error)
    }
  }

  const generateMarkdownExport = (summary: Summary, meeting: Meeting) => {
    let content = `# ${meeting.title}\n\n`
    content += `## 会议时间\n${formatDateTime(meeting.start_time)}\n\n`

    if (summary.abstract) {
      content += `## 会议摘要\n${summary.abstract}\n\n`
    }

    if (summary.decisions?.length > 0) {
      content += `## 会议决议\n`
      summary.decisions.forEach((decision, i) => {
        content += `${i + 1}. ${decision}\n`
      })
      content += `\n`
    }

    if (summary.risks?.length > 0) {
      content += `## 风险与问题\n`
      summary.risks.forEach((risk, i) => {
        content += `${i + 1}. ${risk}\n`
      })
      content += `\n`
    }

    if (summary.action_items?.length > 0) {
      content += `## 待办事项\n`
      summary.action_items.forEach((item, i) => {
        content += `${i + 1}. ${item.title}\n`
        if (item.assignee) content += `   - 负责人: ${item.assignee}\n`
        if (item.due_date) content += `   - 截止日期: ${item.due_date}\n`
        content += `   - 优先级: ${item.priority}\n`
      })
      content += `\n`
    }

    if ((summary.transcript?.length ?? 0) > 0) {
      content += `## 会议录音转写\n`
      summary.transcript!.forEach((segment, i) => {
        content += `### ${segment.speaker} (${Math.floor(segment.start / 60)}:${(segment.start % 60).toString().padStart(2, '0')} - ${Math.floor(segment.end / 60)}:${(segment.end % 60).toString().padStart(2, '0')})\n`
        content += `${segment.text}\n\n`
      })
    }

    return content
  }

  const generateTextExport = (summary: Summary, meeting: Meeting) => {
    let content = `${meeting.title}\n\n`
    content += `会议时间: ${formatDateTime(meeting.start_time)}\n\n`

    if (summary.abstract) {
      content += `会议摘要:\n${summary.abstract}\n\n`
    }

    if (summary.decisions?.length > 0) {
      content += `会议决议:\n`
      summary.decisions.forEach((decision, i) => {
        content += `${i + 1}. ${decision}\n`
      })
      content += `\n`
    }

    if (summary.risks?.length > 0) {
      content += `风险与问题:\n`
      summary.risks.forEach((risk, i) => {
        content += `${i + 1}. ${risk}\n`
      })
      content += `\n`
    }

    if (summary.action_items?.length > 0) {
      content += `待办事项:\n`
      summary.action_items.forEach((item, i) => {
        content += `${i + 1}. ${item.title}\n`
        if (item.assignee) content += `   - 负责人: ${item.assignee}\n`
        if (item.due_date) content += `   - 截止日期: ${item.due_date}\n`
        content += `   - 优先级: ${item.priority}\n`
      })
      content += `\n`
    }

    if ((summary.transcript?.length ?? 0) > 0) {
      content += `会议录音转写:\n`
      summary.transcript!.forEach((segment, i) => {
        content += `${segment.speaker} (${Math.floor(segment.start / 60)}:${(segment.start % 60).toString().padStart(2, '0')} - ${Math.floor(segment.end / 60)}:${(segment.end % 60).toString().padStart(2, '0')}):\n${segment.text}\n\n`
      })
    }

    return content
  }

  const generateWordExport = (summary: Summary, meeting: Meeting) => {
    // For Word, we'll generate a simple HTML document that Word can open
    let content = `<html><body>`
    content += `<h1>${meeting.title}</h1>`
    content += `<h2>会议时间</h2><p>${formatDateTime(meeting.start_time)}</p>`

    if (summary.abstract) {
      content += `<h2>会议摘要</h2><p>${summary.abstract}</p>`
    }

    if (summary.decisions?.length > 0) {
      content += `<h2>会议决议</h2><ul>`
      summary.decisions.forEach(decision => {
        content += `<li>${decision}</li>`
      })
      content += `</ul>`
    }

    if (summary.risks?.length > 0) {
      content += `<h2>风险与问题</h2><ul>`
      summary.risks.forEach(risk => {
        content += `<li>${risk}</li>`
      })
      content += `</ul>`
    }

    if (summary.action_items?.length > 0) {
      content += `<h2>待办事项</h2><ul>`
      summary.action_items.forEach(item => {
        content += `<li>${item.title}<br>`
        if (item.assignee) content += `负责人: ${item.assignee}<br>`
        if (item.due_date) content += `截止日期: ${item.due_date}<br>`
        content += `优先级: ${item.priority}</li>`
      })
      content += `</ul>`
    }

    if ((summary.transcript?.length ?? 0) > 0) {
      content += `<h2>会议录音转写</h2>`
      summary.transcript!.forEach(segment => {
        content += `<h3>${segment.speaker} (${Math.floor(segment.start / 60)}:${(segment.start % 60).toString().padStart(2, '0')} - ${Math.floor(segment.end / 60)}:${(segment.end % 60).toString().padStart(2, '0')})</h3>`
        content += `<p>${segment.text}</p>`
      })
    }

    content += `</body></html>`
    return content
  }

  const handleCalendarImport = async () => {
    try {
      await downloadIcs(id)
    } catch (error) {
      console.error('Failed to import calendar:', error)
    }
  }

  const handleGenerateSummary = async () => {
    if (recordings.length === 0) return

    setAnalyzing(true)
    setAnalysisError('')
    setOkrPromptOpen(false)
    try {
      // 使用第一个录音进行分析
      const recording = recordings[0]
      if (!recording?.id || typeof recording.id !== 'string') {
        throw new Error(`录音数据缺少有效 id: ${JSON.stringify(recording)}`)
      }
      const analysisResult = await startAnalysis(id, recording.id)
      setAnalysisStatus({ progress: 5, message: '分析任务已提交到后台' })
      setEtaSeconds(null)

      const finished = await pollAnalysisStatus(analysisResult.analysis_id)
      if (!finished) {
        scheduleAnalysisPoll(analysisResult.analysis_id)
      }
    } catch (error) {
      console.error('Error generating summary:', error)
      clearAnalysisPolling()
      setAnalyzing(false)
      setAnalysisError((error as Error)?.message || '生成纪要失败')
    }
  }

  const handleGenerateOkr = useCallback(async () => {
    if (meeting?.project_id) {
      setOkrPromptOpen(false)
      router.push('/projects')
      return
    }

    if (!summary?.meeting_id) return

    setOkrLoading(true)
    try {
      await createProjectFromMeeting(summary.meeting_id)
      await fetchMeeting()
      setOkrPromptOpen(false)
      toastSuccess('OKR 已生成')
      router.push('/projects')
    } catch (error) {
      console.error('Failed to generate OKR:', error)
      toastError('生成 OKR 失败')
    } finally {
      setOkrLoading(false)
    }
  }, [fetchMeeting, meeting?.project_id, router, summary?.meeting_id, toastError, toastSuccess])

  const handleGenerateEmail = async () => {
    if (!summary || !meeting) return
    setEmailLoading(true)
    try {
      const recipients = emailRecipients
        .split(',')
        .map(r => r.trim())
        .filter(Boolean)
      const draft = await generateEmailDraft(meeting.id, 'meeting_summary', recipients)
      setEmailDraft({
        ...draft,
        subject: replaceParticipantNames(draft.subject, meeting) || draft.subject,
        body: replaceParticipantNames(draft.body, meeting) || draft.body,
      })
      setEmailOpen(true)
    } catch (e) {
      console.error(e)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!summary || !meeting) return
    const recipients = emailRecipients
      .split(',')
      .map(r => r.trim())
      .filter(Boolean)
    if (recipients.length === 0) {
      setSmtpErrorMessage('请填写收件人')
      return
    }
    setEmailSending(true)
    try {
      await sendEmail(
        meeting.meeting_id || meeting.id,
        recipients,
        emailDraft.subject,
        emailDraft.body,
      )
    } catch (error) {
      const message = (error as Error)?.message || '发送邮件失败'
      if (message.includes('SMTP')) {
        setSmtpErrorMessage(message)
        setSmtpDialogOpen(true)
        return
      }
      setSmtpErrorMessage(message)
    } finally {
      setEmailSending(false)
    }
  }

  const handleCalendarSubscribe = async () => {
    try {
      const res = await getCalendarSubscribeUrl()
      window.open(res.webcal_url, '_blank')
    } catch (error) {
      console.error('Failed to get calendar subscribe URL:', error)
    }
  }

  const handleGenerateSlides = () => {
    setSlidesOpen(true)
  }

  const handleDeleteRecording = async () => {
    if (!deleteRecordingId) return

    try {
      await deleteRecording(deleteRecordingId)
      setRecordings(prev => prev.filter(recording => recording.id !== deleteRecordingId))
      setDeleteRecordingId(null)
    } catch (error) {
      console.error('Failed to delete recording:', error)
    }
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '未设置'
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="rounded" height={200} sx={{ mt: 2 }} />
      </Box>
    )
  }

  if (!meeting) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          会议不存在
        </Typography>
        <Button component={Link} href="/meetings" sx={{ mt: 2 }}>
          返回列表
        </Button>
      </Box>
    )
  }

  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const softBorderStrong = isDark
    ? '1px solid rgba(255,255,255,0.12)'
    : '1px solid rgba(0,0,0,0.12)'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const softBgAlt = isDark ? '#151820' : '#F2F2F7'

  const iosSurfaceSx = {
    borderRadius: { xs: 3, sm: 2 },
    border: { xs: softBorder, sm: softBorderStrong },
    boxShadow: {
      xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
      sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
    },
    bgcolor: 'background.paper',
  }

  return (
    <Box
      sx={{
        bgcolor: { xs: 'background.default', sm: 'transparent' },
        px: { xs: 2, sm: 0 },
        py: { xs: 2, sm: 0 },
        fontFamily: {
          xs: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif',
          sm: 'inherit',
        },
        '& .MuiOutlinedInput-root': {
          borderRadius: { xs: 3, sm: 2 },
          bgcolor: { xs: 'background.paper', sm: 'inherit' },
        },
      }}
    >
      <Button
        component={Link}
        href="/meetings"
        startIcon={<ArrowBackIcon />}
        sx={{
          mb: { xs: 2, sm: 2 },
          borderRadius: 999,
          px: 2,
          bgcolor: { xs: 'background.paper', sm: 'transparent' },
          boxShadow: {
            xs: isDark ? '0 8px 20px rgba(0,0,0,0.5)' : '0 8px 20px rgba(0,0,0,0.06)',
            sm: 'none',
          },
          border: { xs: softBorder, sm: 'none' },
          alignSelf: 'flex-start',
        }}
      >
        返回列表
      </Button>

      {/* Meeting Info */}
      <Paper
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: { xs: 2, sm: 3 },
          ...iosSurfaceSx,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
          }}
        >
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontSize: { xs: '1.4rem', sm: '2.125rem' },
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {meeting.title}
          </Typography>
          <Button
            startIcon={<EditIcon />}
            onClick={() => setEditOpen(true)}
            sx={{
              alignSelf: { xs: 'flex-start', sm: 'center' },
              borderRadius: 999,
              px: 2,
              bgcolor: { xs: softBg, sm: 'transparent' },
              border: { xs: softBorder, sm: softBorderStrong },
            }}
          >
            编辑
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {formatDateTime(meeting.start_time)}
        </Typography>

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              参会人员
            </Typography>
            {displayParticipants.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {displayParticipants.map((participant, index) => (
                  <Chip
                    key={`${participant.name}-${participant.email || index}`}
                    label={participant.name}
                    size="small"
                    sx={{
                      borderRadius: 999,
                      bgcolor: softBg,
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                暂无参会人员
              </Typography>
            )}
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={Boolean(meeting.anonymize_participants)}
                onChange={handleToggleAnonymization}
                disabled={anonymizeSaving || !meeting.participants?.length}
              />
            }
            label="匿名显示参会人员"
            sx={{
              m: 0,
              alignItems: 'center',
              '& .MuiFormControlLabel-label': {
                fontSize: '0.95rem',
                color: 'text.secondary',
              },
            }}
          />
        </Box>

        {meeting.anonymize_participants && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            当前页面展示和纪要导出将使用化名，原始参会信息仍保存在会议数据中。
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          {meeting.tags?.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{
                borderRadius: 999,
                bgcolor: softBg,
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<MicIcon />}
            label={recordings.length > 0 ? '有录音' : '无录音'}
            color={recordings.length > 0 ? 'primary' : 'default'}
            variant={isMobile ? 'filled' : 'outlined'}
            sx={{ borderRadius: 999 }}
          />
          <Chip
            icon={<SummarizeIcon />}
            label={summary ? '已总结' : '未总结'}
            color={summary ? 'success' : 'default'}
            variant={isMobile ? 'filled' : 'outlined'}
            sx={{ borderRadius: 999 }}
          />
        </Box>
      </Paper>

      {/* Tabs */}
      <Box sx={{ mb: { xs: 2, sm: 2 } }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'fullWidth' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          allowScrollButtonsMobile={!isMobile}
          sx={{
            bgcolor: { xs: isDark ? 'rgba(255,255,255,0.08)' : 'grey.200', sm: 'transparent' },
            borderRadius: { xs: 999, sm: 0 },
            p: { xs: 0.5, sm: 0 },
            minHeight: { xs: 40, sm: 48 },
            '& .MuiTabs-indicator': { display: 'none' },
          }}
        >
          {['录音', '纪要', '思维导图', '快速操作'].map(label => (
            <Tab
              key={label}
              label={label}
              sx={{
                textTransform: 'none',
                minHeight: { xs: 36, sm: 48 },
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                fontWeight: 600,
                borderRadius: { xs: 999, sm: 2 },
                '&.Mui-selected': {
                  bgcolor: { xs: 'background.paper', sm: 'transparent' },
                  boxShadow: { xs: '0 6px 16px rgba(0,0,0,0.08)', sm: 'none' },
                },
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tab === 0 && (
        <Box>
          {recordings.length > 0 ? (
            recordings.map((rec, index) => (
              <Paper key={rec.id || index} sx={{ ...iosSurfaceSx, mb: 2, p: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {rec.type === 'import' ? '导入录音' : '实时录音'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(rec.created_at).toLocaleString('zh-CN')}
                    </Typography>
                  </Box>
                  <IconButton
                    color="error"
                    onClick={() => setDeleteRecordingId(rec.id)}
                    title="删除录音"
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>
                <AudioPlayer
                  recording={rec}
                  seekTo={index === 0 ? seekTo : undefined}
                  autoPlay={index === 0 && seekTo !== undefined}
                />
              </Paper>
            ))
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', ...iosSurfaceSx }}>
              <Typography color="text.secondary" gutterBottom>
                暂无录音
              </Typography>
              <Button
                variant="contained"
                startIcon={<MicIcon />}
                onClick={() => setImportOpen(true)}
                sx={{ borderRadius: 999, px: 3 }}
              >
                导入录音
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          {displaySummary ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <MeetingSummary
                summary={displaySummary}
                onGenerateOkr={handleGenerateOkr}
                okrLoading={okrLoading}
                hasProject={Boolean(meeting?.project_id)}
              />
              <Paper sx={{ p: 3, ...iosSurfaceSx }}>
                <Typography variant="subtitle1" gutterBottom>
                  会议记忆
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  将关键信息沉淀为项目记忆，便于后续检索。
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    mb: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="记录这次会议的关键点..."
                    value={memoryDraft}
                    onChange={e => setMemoryDraft(e.target.value)}
                  />
                  <Button
                    variant="contained"
                    onClick={handleAddMemory}
                    disabled={memoryLoading || !memoryDraft.trim()}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    记录
                  </Button>
                </Box>
                {memories.length > 0 && (
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="搜索记忆..."
                    value={memorySearch}
                    onChange={e => setMemorySearch(e.target.value)}
                    sx={{ mb: 2 }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                )}
                {filteredMemories.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {memorySearch ? '未找到匹配的记忆' : '暂无记忆记录'}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {filteredMemories.map(memory => (
                      <Paper key={memory.id} sx={{ p: 2, borderRadius: 2, bgcolor: softBg }}>
                        <Typography variant="subtitle2">
                          {replaceParticipantNames(memory.title || '会议记忆', meeting)}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {replaceParticipantNames(memory.content, meeting)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(memory.created_at).toLocaleString('zh-CN')}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Paper>
              {relatedTasks.length > 0 && (
                <Accordion
                  expanded={relatedTasksExpanded}
                  onChange={(_, expanded) => setRelatedTasksExpanded(expanded)}
                  sx={{ ...iosSurfaceSx, borderRadius: '12px !important', overflow: 'hidden' }}
                  disableGutters
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      相关任务
                      <Chip label={relatedTasks.length} size="small" sx={{ ml: 1 }} />
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {relatedTasks.map(task => (
                        <Paper
                          key={task.id}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: softBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Typography variant="body2" sx={{ flex: 1, minWidth: 120 }}>
                            {replaceParticipantNames(task.title, meeting)}
                          </Typography>
                          <Chip
                            label={
                              task.status === 'todo'
                                ? '待办'
                                : task.status === 'in_progress'
                                  ? '进行中'
                                  : task.status
                            }
                            size="small"
                            color={
                              task.status === 'todo'
                                ? 'default'
                                : task.status === 'in_progress'
                                  ? 'primary'
                                  : 'success'
                            }
                          />
                          {task.assignee && (
                            <Typography variant="caption" color="text.secondary">
                              {replaceParticipantNames(task.assignee, meeting)}
                            </Typography>
                          )}
                          {task.due_date && (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(task.due_date).toLocaleDateString('zh-CN')}
                            </Typography>
                          )}
                        </Paper>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', ...iosSurfaceSx }}>
              <Typography color="text.secondary" gutterBottom>
                暂无纪要
              </Typography>
              <Typography variant="body2" color="text.secondary">
                请先导入录音，然后进行 AI 分析生成纪要
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          {displaySummary ? (
            <MeetingMindMap summary={displaySummary} />
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', ...iosSurfaceSx }}>
              <Typography color="text.secondary" gutterBottom>
                暂无纪要
              </Typography>
              <Typography variant="body2" color="text.secondary">
                思维导图基于会议纪要生成，请先生成纪要
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {tab === 3 && (
        <>
          {isMobile ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 1.5,
              }}
            >
              {[
                {
                  key: 'import',
                  label: '导入录音',
                  icon: MicIcon,
                  onClick: () => setImportOpen(true),
                  disabled: false,
                },
                {
                  key: 'summary',
                  label: analyzing ? analysisStatus.message || '生成中...' : '生成纪要',
                  icon: SummarizeIcon,
                  onClick: handleGenerateSummary,
                  disabled: recordings.length === 0 || analyzing,
                },
                {
                  key: 'calendar-import',
                  label: '导入日历',
                  icon: CalendarMonthIcon,
                  onClick: () => handleCalendarImport(),
                  disabled: !summary,
                },
                {
                  key: 'calendar-subscribe',
                  label: '系统日历订阅',
                  icon: CalendarMonthIcon,
                  onClick: handleCalendarSubscribe,
                  disabled: false,
                },
                {
                  key: 'email',
                  label: emailLoading ? '生成中...' : '生成邮件',
                  icon: EmailIcon,
                  onClick: handleGenerateEmail,
                  disabled: !summary || emailLoading,
                },
                {
                  key: 'ppt',
                  label: '生成 PPT',
                  icon: SlideshowIcon,
                  onClick: () => handleGenerateSlides(),
                  disabled: !summary,
                },
                {
                  key: 'export',
                  label: '导出纪要',
                  icon: FileDownloadIcon,
                  onClick: () => setExportOpen(true),
                  disabled: !summary,
                  span: 2,
                },
              ].map((action, idx, arr) => {
                const Icon = action.icon
                const isLastOdd = arr.length % 2 === 1 && idx === arr.length - 1
                return (
                  <ButtonBase
                    key={action.key}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      textAlign: 'left',
                      ...(action.span || isLastOdd ? { gridColumn: 'span 2' } : {}),
                      opacity: action.disabled ? 0.5 : 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        minHeight: 110,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        border: softBorder,
                        boxShadow: isDark
                          ? '0 10px 20px rgba(0,0,0,0.5)'
                          : '0 10px 20px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          bgcolor: softBgAlt,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#007AFF',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {action.label}
                      </Typography>
                    </Box>
                  </ButtonBase>
                )
              })}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                flexWrap: 'wrap',
                '& .MuiButton-root': {
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                  bgcolor: { xs: 'background.paper', sm: 'transparent' },
                  border: { xs: softBorder, sm: softBorderStrong },
                  boxShadow: {
                    xs: isDark ? '0 8px 16px rgba(0,0,0,0.5)' : '0 8px 16px rgba(0,0,0,0.06)',
                    sm: 'none',
                  },
                },
              }}
            >
              <Button
                variant="outlined"
                startIcon={<MicIcon />}
                onClick={() => setImportOpen(true)}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                导入录音
              </Button>
              <Button
                variant="outlined"
                startIcon={<SummarizeIcon />}
                disabled={recordings.length === 0 || analyzing}
                onClick={handleGenerateSummary}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {analyzing ? analysisStatus.message || '生成中...' : '生成纪要'}
              </Button>
              {analysisError && (
                <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
                  {analysisError}
                </Alert>
              )}
              {analyzing && (
                <Paper
                  sx={{
                    width: '100%',
                    mt: 1,
                    p: 2,
                    ...iosSurfaceSx,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <LinearProgress variant="determinate" value={analysisStatus.progress} />
                    <Typography variant="caption" color="text.secondary">
                      {analysisStatus.message}
                      {etaSeconds !== null ? ` · 预计 ${Math.max(etaSeconds, 0)} 秒` : ''}
                    </Typography>
                    {analysisStatus.steps && analysisStatus.steps.length > 0 && (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 1,
                        }}
                      >
                        {analysisStatus.steps.map((s, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              p: 1,
                              border: softBorder,
                              borderRadius: 2,
                              bgcolor: softBg,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {s.label}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={s.progress}
                              sx={{ mt: 0.5, height: 6, borderRadius: 1 }}
                            />
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}
              <Button
                variant="outlined"
                startIcon={<CalendarMonthIcon />}
                disabled={!summary}
                onClick={() => handleCalendarImport()}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                导入日历
              </Button>
              <Button
                variant="outlined"
                startIcon={<CalendarMonthIcon />}
                onClick={handleCalendarSubscribe}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                系统日历订阅
              </Button>
              <Button
                variant="outlined"
                startIcon={<EmailIcon />}
                disabled={!summary || emailLoading}
                onClick={handleGenerateEmail}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {emailLoading ? '生成中...' : '生成邮件'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<SlideshowIcon />}
                disabled={!summary}
                onClick={() => handleGenerateSlides()}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {'生成 PPT'}
              </Button>
              <Button
                variant="outlined"
                disabled={!summary}
                onClick={() => setExportOpen(true)}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                导出纪要
              </Button>
            </Box>
          )}
        </>
      )}

      <ImportRecordingDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        meetingId={id}
        onSuccess={fetchMeeting}
      />

      {/* Edit Meeting Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullScreen={isMobile}
        scroll="paper"
      >
        <DialogTitle>编辑会议信息</DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <TextField
            autoFocus
            margin="dense"
            name="title"
            label="会议名称"
            type="text"
            fullWidth
            variant="outlined"
            value={editForm.title}
            onChange={handleEditChange}
          />
          <TextField
            margin="dense"
            name="start_time"
            label="会议时间"
            type="datetime-local"
            fullWidth
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            value={editForm.start_time ? editForm.start_time.replace('Z', '') : ''}
            onChange={handleEditChange}
          />
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            pb: 2,
            ...(isMobile
              ? {
                  position: 'sticky',
                  bottom: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }
              : {}),
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
            },
          }}
        >
          <Button onClick={() => setEditOpen(false)}>取消</Button>
          <Button onClick={handleEditSubmit}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Export Summary Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} fullScreen={isMobile}>
        <DialogTitle>导出会议纪要</DialogTitle>
        <DialogContent>
          <TextField
            select
            margin="dense"
            name="exportFormat"
            label="导出格式"
            fullWidth
            variant="outlined"
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="md">Markdown (.md)</option>
            <option value="txt">文本文件 (.txt)</option>
            <option value="word">Word 文档 (.doc)</option>
          </TextField>
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            pb: 2,
            ...(isMobile
              ? {
                  position: 'sticky',
                  bottom: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }
              : {}),
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
            },
          }}
        >
          <Button onClick={() => setExportOpen(false)}>取消</Button>
          <Button onClick={handleExportSubmit}>导出</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={okrPromptOpen}
        onClose={() => {
          if (!okrLoading) {
            setOkrPromptOpen(false)
          }
        }}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>已可生成 OKR</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            会议纪要已经生成完成。现在可以基于本次会议的摘要、决议和行动项生成 OKR 项目。
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            pb: 2,
            ...(isMobile
              ? {
                  position: 'sticky',
                  bottom: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }
              : {}),
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
            },
          }}
        >
          <Button onClick={() => setOkrPromptOpen(false)} disabled={okrLoading}>
            稍后再说
          </Button>
          <Button variant="contained" onClick={handleGenerateOkr} disabled={okrLoading}>
            {okrLoading ? '生成中...' : '立即生成 OKR'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Slides Editor (fullscreen component) */}
      <SlideEditor
        open={slidesOpen}
        meetingId={id}
        meeting={meeting}
        summary={displaySummary}
        onClose={() => setSlidesOpen(false)}
      />

      {/* Email Draft Dialog */}
      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        scroll="paper"
      >
        <DialogTitle>邮件草稿</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="收件人（逗号分隔）"
            value={emailRecipients}
            onChange={e => setEmailRecipients(e.target.value)}
            placeholder="example@company.com, teammate@company.com"
            fullWidth
          />
          <TextField
            label="主题"
            value={emailDraft.subject}
            onChange={e => setEmailDraft(prev => ({ ...prev, subject: e.target.value }))}
            fullWidth
          />
          <TextField
            label="正文"
            value={emailDraft.body}
            onChange={e => setEmailDraft(prev => ({ ...prev, body: e.target.value }))}
            fullWidth
            multiline
            minRows={10}
          />
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            pb: 2,
            ...(isMobile
              ? {
                  position: 'sticky',
                  bottom: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }
              : {}),
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
            },
          }}
        >
          <Button onClick={() => setEmailOpen(false)}>关闭</Button>
          <Button onClick={handleSendEmail} disabled={emailSending}>
            {emailSending ? '发送中...' : '发送邮件'}
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)
            }}
          >
            复制
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={smtpDialogOpen}
        onClose={() => setSmtpDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>邮件服务未配置</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {smtpErrorMessage || '需要先配置 SMTP 才能发送邮件。'}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            请在后端环境变量中配置以下项：
          </Typography>
          <Box component="pre" sx={{ m: 0, p: 2, bgcolor: softBg, borderRadius: 1 }}>
            SMTP_HOST= SMTP_PORT= SMTP_USERNAME= SMTP_PASSWORD= SMTP_FROM=
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            pb: 2,
            ...(isMobile
              ? {
                  position: 'sticky',
                  bottom: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }
              : {}),
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
            },
          }}
        >
          <Button onClick={() => setSmtpDialogOpen(false)}>关闭</Button>
          <Button component={Link} href="/settings" onClick={() => setSmtpDialogOpen(false)}>
            去设置
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteRecordingId)}
        title="删除录音"
        content="确定要删除这条录音吗？删除后将无法恢复。"
        onConfirm={handleDeleteRecording}
        onCancel={() => setDeleteRecordingId(null)}
        confirmColor="error"
        confirmText="删除"
      />
    </Box>
  )
}

export default function MeetingDetailPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />
        </Box>
      }
    >
      <MeetingDetailPageContent {...props} />
    </Suspense>
  )
}
