'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Menu from '@mui/material/Menu'
import Alert from '@mui/material/Alert'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import Avatar from '@mui/material/Avatar'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { getTaskBoard, createTask, updateTask, deleteTask } from '@/libs/api'
import { useToastStore } from '@/libs/stores'
import type { Task, TaskCreate, TaskUpdate, ActionItem } from '@/interfaces'
import type { TranscriptSegment } from '@/interfaces'

interface MeetingTasksProps {
  meetingId: string
  actionItems?: ActionItem[]
  transcript?: TranscriptSegment[]
}

const matchActionItemSegment = (item: ActionItem, transcript: TranscriptSegment[]) => {
  if (item.source_segment_start !== undefined || item.source_segment_end !== undefined) {
    return {
      source_segment_start: item.source_segment_start,
      source_segment_end: item.source_segment_end,
    }
  }

  const title = item.title?.trim().toLowerCase()
  if (!title || transcript.length === 0) {
    return {}
  }

  const compactTitle = title.replace(/\s+/g, '')
  const keywords = compactTitle
    .split(/[，。、；：,.!?！？\s]/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  const candidates = [compactTitle, ...keywords]
    .map(value => value.slice(0, Math.min(10, value.length)))
    .filter(value => value.length >= 2)

  const match = transcript.find(segment => {
    const text = (segment.text || '').toLowerCase().replace(/\s+/g, '')
    return candidates.some(candidate => text.includes(candidate))
  })

  if (!match) {
    return {}
  }

  return {
    source_segment_start: Math.floor(match.start),
    source_segment_end: Math.ceil(match.end),
  }
}

export default function MeetingTasks({
  meetingId,
  actionItems,
  transcript = [],
}: MeetingTasksProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [statusAnchorEl, setStatusAnchorEl] = useState<null | HTMLElement>(null)
  const [statusTask, setStatusTask] = useState<Task | null>(null)

  const toastError = useToastStore(s => s.error)
  const toastSuccess = useToastStore(s => s.success)

  const fetchTasks = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setLoading(true)
      const res = await getTaskBoard({ meeting_id: meetingId })
      setTasks(res.tasks || [])
      setLoadError('')
    } catch (e) {
      console.error(e)
      const message = (e as Error)?.message || '获取任务列表失败'
      setLoadError(message)
      if (!options?.silent) {
        toastError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [meetingId, toastError])

  useEffect(() => {
    fetchTasks({ silent: true })
  }, [fetchTasks])

  const [openDialog, setOpenDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState<Task['status']>('todo')

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setAssignee('')
    setDueDate('')
    setPriority('medium')
    setStatus('todo')
    setEditingTask(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setOpenDialog(true)
  }

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description || '')
    setAssignee(task.assignee || '')
    setDueDate(task.due_date || '')
    setPriority(task.priority)
    setStatus(task.status)
    setOpenDialog(true)
  }

  const handleClose = () => {
    setOpenDialog(false)
    resetForm()
  }

  const handleSubmit = async () => {
    try {
      if (editingTask) {
        // Update
        const updateData: TaskUpdate = {
          title,
          description: description || undefined,
          assignee: assignee || undefined,
          due_date: dueDate || undefined,
          priority: priority as 'high' | 'medium' | 'low',
          status,
        }
        await updateTask(editingTask.id, updateData)
        toastSuccess('任务已更新')
      } else {
        // Create
        const createData: TaskCreate = {
          title,
          description: description || undefined,
          assignee: assignee || undefined,
          due_date: dueDate || undefined,
          priority: priority as 'high' | 'medium' | 'low',
          source_meeting_id: meetingId,
        }
        await createTask(createData)
        toastSuccess('任务已创建')
      }
      fetchTasks()
      handleClose()
    } catch (e) {
      toastError('操作失败')
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return
    try {
      await deleteTask(taskId)
      toastSuccess('任务已删除')
      fetchTasks()
    } catch (e) {
      toastError('删除失败')
    }
  }

  const handleToggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      await updateTask(task.id, { status: newStatus })
      fetchTasks()
    } catch (e) {
      toastError('更新状态失败')
    }
  }

  const normalizeTitle = (value: string) => value.trim().toLowerCase()

  const parseDueDate = (value?: string) => {
    if (!value) return undefined
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined
    return trimmed
  }

  const handleImportActionItems = async () => {
    if (!actionItems || actionItems.length === 0) return
    const existingTitles = new Set(tasks.map(t => normalizeTitle(t.title)))
    const toCreate = actionItems.filter(item => {
      const title = item.title?.trim()
      return title && !existingTitles.has(normalizeTitle(title))
    })
    if (toCreate.length === 0) {
      toastSuccess('待办事项已同步')
      return
    }
    setImporting(true)
    try {
      for (const item of toCreate) {
        const title = item.title?.trim()
        if (!title) continue
        const createData: TaskCreate = {
          title,
          assignee: item.assignee && item.assignee !== '待定' ? item.assignee : undefined,
          due_date: parseDueDate(item.due_date),
          priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
          source_meeting_id: meetingId,
          ...matchActionItemSegment(item, transcript),
        }
        await createTask(createData)
      }
      toastSuccess(`已同步 ${toCreate.length} 条待办`)
      fetchTasks()
    } catch (e) {
      toastError('同步待办失败')
    } finally {
      setImporting(false)
    }
  }

  const openStatusMenu = (event: MouseEvent<HTMLElement>, task: Task) => {
    setStatusAnchorEl(event.currentTarget)
    setStatusTask(task)
  }

  const closeStatusMenu = () => {
    setStatusAnchorEl(null)
    setStatusTask(null)
  }

  const handleStatusChange = async (nextStatus: Task['status']) => {
    if (!statusTask) return
    try {
      await updateTask(statusTask.id, { status: nextStatus })
      fetchTasks()
      closeStatusMenu()
    } catch (e) {
      toastError('更新状态失败')
    }
  }

  const statusMeta: Record<
    Task['status'],
    { label: string; color: 'default' | 'success' | 'warning' | 'error' }
  > = {
    todo: { label: '待处理', color: 'default' },
    in_progress: { label: '进行中', color: 'warning' },
    blocked: { label: '阻塞', color: 'error' },
    done: { label: '已完成', color: 'success' },
  }

  const canImportActionItems = Boolean(
    actionItems?.some(
      item =>
        item.title && !tasks.find(t => normalizeTitle(t.title) === normalizeTitle(item.title)),
    ),
  )

  return (
    <Paper
      sx={{
        p: { xs: 2.5, sm: 3 },
        mb: 3,
        borderRadius: { xs: 3, sm: 2 },
        border: softBorder,
        boxShadow: {
          xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
          sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
        },
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          待办事项 ({tasks.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {actionItems && actionItems.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleImportActionItems}
              disabled={!canImportActionItems || importing}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                borderRadius: 999,
                px: 2,
                bgcolor: { xs: 'background.paper', sm: 'transparent' },
                border: softBorder,
                boxShadow: {
                  xs: isDark ? '0 8px 16px rgba(0,0,0,0.5)' : '0 8px 16px rgba(0,0,0,0.06)',
                  sm: 'none',
                },
              }}
            >
              {importing ? '同步中...' : '同步纪要待办'}
            </Button>
          )}
          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={handleOpenCreate}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
              px: 2,
              bgcolor: { xs: 'background.paper', sm: 'transparent' },
              border: softBorder,
              boxShadow: {
                xs: isDark ? '0 8px 16px rgba(0,0,0,0.5)' : '0 8px 16px rgba(0,0,0,0.06)',
                sm: 'none',
              },
            }}
          >
            添加任务
          </Button>
        </Box>
      </Box>

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {loading && tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          加载中...
        </Typography>
      ) : tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          暂无待办事项
        </Typography>
      ) : (
        <List dense sx={{ p: 0 }}>
          {tasks.map(task => (
            <ListItem
              key={task.id}
              sx={{
                bgcolor: softBg,
                borderRadius: 2,
                mb: 1,
                px: 1.5,
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                opacity: task.status === 'done' ? 0.6 : 1,
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                '&:hover .task-actions': { opacity: 1 },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={task.status === 'done'}
                  onChange={() => handleToggleStatus(task)}
                />
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={{ component: 'div' }}
                secondaryTypographyProps={{ component: 'div' }}
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <span>{task.title}</span>
                    <Chip
                      label={task.priority}
                      size="small"
                      color={
                        task.priority === 'high'
                          ? 'error'
                          : task.priority === 'medium'
                            ? 'warning'
                            : 'success'
                      }
                      variant={isMobile ? 'filled' : 'outlined'}
                      sx={{ height: 20, fontSize: '0.7rem', borderRadius: 999 }}
                    />
                    <Chip
                      label={statusMeta[task.status].label}
                      size="small"
                      color={statusMeta[task.status].color}
                      variant={isMobile ? 'filled' : 'outlined'}
                      onClick={event => openStatusMenu(event, task)}
                      sx={{ height: 20, fontSize: '0.7rem', borderRadius: 999 }}
                    />
                  </Box>
                }
                secondary={
                  <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    {task.assignee && (
                      <Chip
                        avatar={<Avatar sx={{ width: 16, height: 16 }}>{task.assignee[0]}</Avatar>}
                        label={task.assignee}
                        size="small"
                        sx={{ height: 20, fontSize: '0.75rem', borderRadius: 999 }}
                      />
                    )}
                    {task.due_date && (
                      <Chip
                        label={`截止: ${task.due_date}`}
                        size="small"
                        variant={isMobile ? 'filled' : 'outlined'}
                        sx={{ height: 20, fontSize: '0.75rem', borderRadius: 999 }}
                      />
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction
                className="task-actions"
                sx={{
                  opacity: { xs: 1, sm: 0 },
                  transition: 'opacity 0.2s',
                  position: { xs: 'static', sm: 'absolute' },
                  transform: 'none',
                  mt: { xs: 1, sm: 0 },
                  alignSelf: { xs: 'flex-end', sm: 'center' },
                }}
              >
                <IconButton edge="end" size="small" onClick={() => handleOpenEdit(task)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton edge="end" size="small" onClick={() => handleDelete(task.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Menu anchorEl={statusAnchorEl} open={Boolean(statusAnchorEl)} onClose={closeStatusMenu}>
        {Object.entries(statusMeta).map(([value, meta]) => (
          <MenuItem key={value} onClick={() => handleStatusChange(value as Task['status'])}>
            {meta.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={openDialog}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        scroll="paper"
      >
        <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
        <DialogContent dividers sx={{ pb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="任务标题"
              fullWidth
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <TextField
              label="描述"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <TextField
              label="负责人"
              fullWidth
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
            />
            <TextField
              label="截止日期"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
            <TextField
              label="优先级"
              select
              fullWidth
              value={priority}
              onChange={e => setPriority(e.target.value)}
            >
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </TextField>
            {editingTask && (
              <TextField
                label="状态"
                select
                fullWidth
                value={status}
                onChange={e => setStatus(e.target.value as Task['status'])}
              >
                <MenuItem value="todo">待处理</MenuItem>
                <MenuItem value="in_progress">进行中</MenuItem>
                <MenuItem value="blocked">阻塞</MenuItem>
                <MenuItem value="done">已完成</MenuItem>
              </TextField>
            )}
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
          <Button onClick={handleClose}>取消</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!title}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
