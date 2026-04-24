'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { TaskCard, TaskDialog } from '@/components/tasks'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  getTaskBoard,
  createTask,
  updateTask,
  completeTask,
  completeTasks,
  deleteTask,
} from '@/libs/api'
import { useToastStore } from '@/libs/stores'
import type { Task, TaskStatistics, TaskCreate, TaskUpdate } from '@/interfaces'
import { useRouter } from 'next/navigation'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Divider from '@mui/material/Divider'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

type ViewType = 'all' | 'todo' | 'in_progress' | 'done' | 'blocked' | 'overdue'
type StatusType = 'todo' | 'in_progress' | 'done' | 'blocked'

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      }
    >
      <TasksContent />
    </Suspense>
  )
}

function TasksContent() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBg = isDark ? '#151820' : '#F2F2F7'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const tabBg = isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewType>('all')
  const [boardMode, setBoardMode] = useState(true)
  const [search, setSearch] = useState('')
  const [meetingFilter, setMeetingFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const router = useRouter()

  // Confirm Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toastError = useToastStore(s => s.error)
  const toastSuccess = useToastStore(s => s.success)
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const forceAll = isMobile && boardMode
      const params = forceAll || view === 'all' || view === 'overdue' ? {} : { status: view }
      const res = await getTaskBoard(params)
      setTasks(res.tasks || [])
      setStats(res.statistics || null)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      toastError('获取任务列表失败')
    } finally {
      setLoading(false)
    }
  }, [view, toastError, isMobile, boardMode])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    if (highlightId && !loading && tasks.length > 0) {
      const element = taskRefs.current[highlightId]
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [highlightId, loading, tasks])

  const handleCreate = async (data: TaskCreate | TaskUpdate) => {
    try {
      await createTask(data as TaskCreate)
      toastSuccess('任务创建成功')
      fetchTasks()
      setDialogOpen(false)
    } catch (error) {
      toastError('创建任务失败')
    }
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleUpdate = async (data: TaskCreate | TaskUpdate) => {
    if (editingTask) {
      try {
        await updateTask(editingTask.id, data as TaskUpdate)
        toastSuccess('任务更新成功')
        fetchTasks()
        handleCloseDialog()
      } catch (error) {
        toastError('更新任务失败')
      }
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await completeTask(id, {})
      toastSuccess('任务已完成')
      fetchTasks()
    } catch (error) {
      toastError('操作失败')
    }
  }

  const handleStart = async (task: Task) => {
    try {
      await updateTask(task.id, { status: 'in_progress' })
      toastSuccess('任务已开始')
      fetchTasks()
    } catch (error) {
      toastError('更新任务状态失败')
    }
  }

  const handlePlay = useCallback(
    (task: Task) => {
      const meetingId = task.source_meeting?.meeting_id

      if (!meetingId) {
        return
      }

      if (typeof task.source_segment_start === 'number' && Number.isFinite(task.source_segment_start)) {
        const seek = Math.max(0, Math.floor(task.source_segment_start))
        router.push(`/meetings/${meetingId}?seek=${seek}`)
        return
      }

      router.push(`/meetings/${meetingId}`)
    },
    [router],
  )

  const handleDeleteRequest = (id: string) => {
    setDeletingId(id)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return

    try {
      await deleteTask(deletingId)
      toastSuccess('任务已删除')
      fetchTasks()
    } catch (error) {
      toastError('删除任务失败')
    } finally {
      setConfirmOpen(false)
      setDeletingId(null)
    }
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingTask(null)
  }

  const filteredTasks = tasks.filter(t => {
    const searchValue = search.trim().toLowerCase()
    const matchesSearch =
      !searchValue ||
      t.title.toLowerCase().includes(searchValue) ||
      t.assignee?.toLowerCase().includes(searchValue) ||
      t.description?.toLowerCase().includes(searchValue) ||
      t.source_meeting?.title?.toLowerCase().includes(searchValue)

    const matchesMeeting = meetingFilter === 'all' || t.source_meeting?.meeting_id === meetingFilter

    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter

    const matchesDue = (() => {
      if (dueFilter === 'all') return true
      if (!t.due_date) return dueFilter === 'none'
      const due = new Date(t.due_date)
      if (Number.isNaN(due.getTime())) return false

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000)

      switch (dueFilter) {
        case 'today':
          return diffDays === 0
        case 'week':
          return diffDays >= 0 && diffDays <= 7
        case 'overdue':
          return diffDays < 0 && t.status !== 'done'
        case 'none':
          return false
        default:
          return true
      }
    })()

    return matchesSearch && matchesMeeting && matchesPriority && matchesDue
  })

  const meetingOptions = Array.from(
    new Map(
      tasks
        .filter(task => task.source_meeting?.meeting_id)
        .map(task => [task.source_meeting!.meeting_id, task.source_meeting!.title]),
    ),
  ).map(([id, title]) => ({ id, title }))

  const pendingFilteredTaskIds = filteredTasks
    .filter(task => task.status !== 'done')
    .map(task => task.id)

  const groupedTasks: Record<StatusType, Task[]> = {
    todo: [],
    in_progress: [],
    done: [],
    blocked: [],
  }
  filteredTasks.forEach(t => {
    groupedTasks[t.status].push(t)
  })

  const overdueTasks = filteredTasks.filter(t => {
    if (t.status === 'done') return false
    if (t.status === 'blocked') return true
    if (!t.due_date) return false
    const due = new Date(t.due_date)
    return !Number.isNaN(due.getTime()) && due.getTime() < Date.now()
  })

  const mobileViews: { key: ViewType; label: string; tasks: Task[] }[] = [
    { key: 'all', label: '全部', tasks: filteredTasks },
    { key: 'todo', label: '待处理', tasks: groupedTasks.todo },
    { key: 'in_progress', label: '进行中', tasks: groupedTasks.in_progress },
    { key: 'done', label: '已完成', tasks: groupedTasks.done },
    { key: 'overdue', label: '逾期', tasks: overdueTasks },
  ]

  const handleMobileTabChange = (_: React.SyntheticEvent, value: ViewType) => {
    setView(value)
  }

  const handleDropStatus = async (taskId: string, status: StatusType) => {
    const prev = tasks
    setTasks(ts => ts.map(t => (t.id === taskId ? { ...t, status } : t)))
    try {
      await updateTask(taskId, { status })
      toastSuccess('状态已更新')
      fetchTasks()
    } catch (e) {
      setTasks(prev)
      toastError('更新状态失败')
    }
  }

  const handleBulkComplete = async () => {
    if (pendingFilteredTaskIds.length === 0) return

    try {
      await completeTasks(pendingFilteredTaskIds)
      toastSuccess(`已批量完成 ${pendingFilteredTaskIds.length} 项任务`)
      fetchTasks()
    } catch (error) {
      toastError('批量完成失败')
    }
  }

  const activeMobileSection = mobileViews.find(section => section.key === view) ?? mobileViews[0]

  return (
    <Box
      sx={{
        bgcolor: { xs: isDark ? 'background.default' : softBg, sm: 'transparent' },
        px: { xs: 2, sm: 0 },
        py: { xs: 2, sm: 0 },
        fontFamily: {
          xs: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif',
          sm: 'inherit',
        },
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            任务看板
          </Typography>
          <Typography variant="body2" color="text.secondary">
            跟踪你的任务流转
          </Typography>
        </Box>
        {isMobile ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{
              borderRadius: 999,
              px: 2.5,
              bgcolor: '#007AFF',
              boxShadow: '0 10px 20px rgba(0,122,255,0.3)',
              '&:hover': { bgcolor: '#0A84FF' },
            }}
          >
            新建
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant={boardMode ? 'contained' : 'outlined'}
              onClick={() => setBoardMode(true)}
            >
              看板视图
            </Button>
            <Button
              variant={!boardMode ? 'contained' : 'outlined'}
              onClick={() => setBoardMode(false)}
            >
              列表视图
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              新建任务
            </Button>
          </Box>
        )}
      </Box>

      {isMobile && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tabs
            value={boardMode ? 0 : 1}
            onChange={(_, v) => setBoardMode(v === 0)}
            variant="fullWidth"
            sx={{
              bgcolor: tabBg,
              borderRadius: 999,
              p: 0.5,
              minHeight: 40,
              flex: 1,
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab
              label="看板"
              sx={{
                textTransform: 'none',
                minHeight: 34,
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 999,
                '&.Mui-selected': {
                  bgcolor: isDark ? '#1A1C24' : 'background.paper',
                  boxShadow: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
                },
              }}
            />
            <Tab
              label="列表"
              sx={{
                textTransform: 'none',
                minHeight: 34,
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 999,
                '&.Mui-selected': {
                  bgcolor: isDark ? '#1A1C24' : 'background.paper',
                  boxShadow: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
                },
              }}
            />
          </Tabs>
        </Box>
      )}

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="搜索任务..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: '100%', sm: 250 } }}
        />
        <TextField
          select
          size="small"
          label="会议"
          value={meetingFilter}
          onChange={e => setMeetingFilter(e.target.value)}
          sx={{ width: { xs: '100%', sm: 170 } }}
        >
          <MenuItem value="all">全部会议</MenuItem>
          {meetingOptions.map(option => (
            <MenuItem key={option.id} value={option.id}>
              {option.title}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="优先级"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          sx={{ width: { xs: '100%', sm: 140 } }}
        >
          <MenuItem value="all">全部优先级</MenuItem>
          <MenuItem value="high">高</MenuItem>
          <MenuItem value="medium">中</MenuItem>
          <MenuItem value="low">低</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="截止时间"
          value={dueFilter}
          onChange={e => setDueFilter(e.target.value)}
          sx={{ width: { xs: '100%', sm: 150 } }}
        >
          <MenuItem value="all">全部</MenuItem>
          <MenuItem value="today">今天到期</MenuItem>
          <MenuItem value="week">7 天内</MenuItem>
          <MenuItem value="overdue">已逾期</MenuItem>
          <MenuItem value="none">未设置</MenuItem>
        </TextField>
        {!loading && pendingFilteredTaskIds.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<DoneAllIcon />}
            onClick={handleBulkComplete}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            批量完成 {pendingFilteredTaskIds.length} 项
          </Button>
        )}
        {stats && !isMobile && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`全部 ${stats.total_tasks}`}
              variant={view === 'all' ? 'filled' : 'outlined'}
              onClick={() => setView('all')}
            />
            <Chip
              label={`待处理 ${stats.todo_count}`}
              color="default"
              variant={view === 'todo' ? 'filled' : 'outlined'}
              onClick={() => setView('todo')}
            />
            <Chip
              label={`进行中 ${stats.in_progress_count}`}
              color="primary"
              variant={view === 'in_progress' ? 'filled' : 'outlined'}
              onClick={() => setView('in_progress')}
            />
            <Chip
              label={`已完成 ${stats.done_count}`}
              color="success"
              variant={view === 'done' ? 'filled' : 'outlined'}
              onClick={() => setView('done')}
            />
            {stats.overdue_count > 0 && (
              <Chip label={`逾期 ${stats.overdue_count}`} color="error" variant="outlined" />
            )}
          </Box>
        )}
        {stats && isMobile && !boardMode && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              pb: 0.5,
              flexWrap: 'nowrap',
              whiteSpace: 'nowrap',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              flex: '1 1 100%',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {[
              { key: 'all', label: `全部 ${stats.total_tasks}` },
              { key: 'todo', label: `待处理 ${stats.todo_count}` },
              { key: 'in_progress', label: `进行中 ${stats.in_progress_count}` },
              { key: 'done', label: `已完成 ${stats.done_count}` },
              ...(stats.overdue_count > 0
                ? [{ key: 'overdue', label: `逾期 ${stats.overdue_count}` }]
                : []),
            ].map(item => (
              <Chip
                key={item.key}
                label={item.label}
                variant={view === (item.key as ViewType) ? 'filled' : 'outlined'}
                onClick={() => setView(item.key as ViewType)}
                sx={{
                  borderRadius: 999,
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  width: 'fit-content !important',
                  maxWidth: 'calc(100% - 8px)',
                  minWidth: 0,
                  alignSelf: 'flex-start',
                  '& .MuiChip-label': {
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {isMobile && boardMode && (
        <Box sx={{ mb: 2 }}>
          <Tabs
            value={view}
            onChange={handleMobileTabChange}
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
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            {mobileViews.map(v => (
              <Tab
                key={v.key}
                value={v.key}
                label={v.label}
                sx={{
                  textTransform: 'none',
                  minHeight: 34,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 999,
                  minWidth: 'auto',
                  maxWidth: 84,
                  px: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
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
        </Box>
      )}

      {/* Task List / Board */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredTasks.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary" gutterBottom>
            暂无任务
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            新建任务
          </Button>
        </Box>
      ) : boardMode ? (
        isMobile ? (
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              height: 'clamp(420px, 70svh, 720px)',
            }}
          >
            <Box
              sx={{
                p: 1.5,
                border: softBorder,
                borderRadius: 3,
                bgcolor: 'background.paper',
                height: '100%',
                minWidth: 0,
                maxWidth: '100%',
                overflowX: 'hidden',
                overflowY: 'auto',
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                {activeMobileSection.label}
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {activeMobileSection.tasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  暂无任务
                </Typography>
              ) : (
                activeMobileSection.tasks.map(task => (
                  <div
                    key={task.id}
                    ref={el => {
                      if (el) taskRefs.current[task.id] = el
                    }}
                  >
                    <TaskCard
                      task={task}
                      onEdit={handleEdit}
                      onStart={handleStart}
                      onComplete={handleComplete}
                      onDelete={handleDeleteRequest}
                      onPlay={handlePlay}
                      highlighted={task.id === highlightId}
                      draggable={false}
                    />
                  </div>
                ))
              )}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {(
              [
                { key: 'todo', label: '待处理' },
                { key: 'in_progress', label: '进行中' },
                { key: 'done', label: '已完成' },
                { key: 'blocked', label: '阻塞' },
              ] as { key: StatusType; label: string }[]
            ).map(col => (
              <Box
                key={col.key}
                sx={{
                  p: 1,
                  border: '1px dashed',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'divider',
                  minHeight: 200,
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  if (id) handleDropStatus(id, col.key)
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  {col.label}
                </Typography>
                <Divider sx={{ mb: 1 }} />
                {groupedTasks[col.key].map(task => (
                  <div
                    key={task.id}
                    ref={el => {
                      if (el) taskRefs.current[task.id] = el
                    }}
                  >
                    <TaskCard
                      task={task}
                      onEdit={handleEdit}
                      onStart={handleStart}
                      onComplete={handleComplete}
                      onDelete={handleDeleteRequest}
                      onPlay={handlePlay}
                      highlighted={task.id === highlightId}
                      draggable
                      onDragStart={(id, e) => {
                        e.dataTransfer.setData('text/plain', id)
                      }}
                    />
                  </div>
                ))}
              </Box>
            ))}
          </Box>
        )
      ) : (
        <Box>
          {filteredTasks.map(task => (
            <div
              key={task.id}
              ref={el => {
                if (el) taskRefs.current[task.id] = el
              }}
            >
              <TaskCard
                task={task}
                onEdit={handleEdit}
                onStart={handleStart}
                onComplete={handleComplete}
                onDelete={handleDeleteRequest}
                onPlay={handlePlay}
                highlighted={task.id === highlightId}
                draggable={false}
              />
            </div>
          ))}
        </Box>
      )}

      <TaskDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSubmit={editingTask ? handleUpdate : handleCreate}
        task={editingTask}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="删除任务"
        content="确定要删除这个任务吗？此操作不可恢复。"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
        confirmColor="error"
        confirmText="删除"
      />
    </Box>
  )
}
