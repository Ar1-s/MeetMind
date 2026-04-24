'use client'

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Checkbox from '@mui/material/Checkbox'
import ListItemIcon from '@mui/material/ListItemIcon'
import LinkIcon from '@mui/icons-material/Link'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  getTaskBoard,
  updateTask,
} from '@/libs/api'
import { useToastStore } from '@/libs/stores'
import type { Project, Objective, KeyResult, Task } from '@/interfaces'

const projectStatuses = [
  { value: 'planning', label: '规划中', color: 'info' },
  { value: 'active', label: '进行中', color: 'primary' },
  { value: 'on_hold', label: '暂停', color: 'warning' },
  { value: 'done', label: '已完成', color: 'success' },
]

const objectiveStatuses = [
  { value: 'on_track', label: '正常', color: 'success' },
  { value: 'at_risk', label: '有风险', color: 'warning' },
  { value: 'off_track', label: '偏离', color: 'error' },
  { value: 'completed', label: '完成', color: 'success' },
]

const keyResultStatuses = [
  { value: 'on_track', label: '正常', color: 'success' },
  { value: 'at_risk', label: '有风险', color: 'warning' },
  { value: 'off_track', label: '偏离', color: 'error' },
  { value: 'completed', label: '完成', color: 'success' },
]

export default function ProjectsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const panelBg = isDark ? 'rgba(17,19,25,0.92)' : 'rgba(255,255,255,0.95)'
  const subBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const toastSuccess = useToastStore(state => state.success)
  const toastError = useToastStore(state => state.error)
  const toast = { success: toastSuccess, error: toastError }

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false)
  const [keyResultDialogOpen, setKeyResultDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
  const [editingKeyResult, setEditingKeyResult] = useState<KeyResult | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeObjectiveId, setActiveObjectiveId] = useState<string | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importTasks, setImportTasks] = useState<Task[]>([])
  const [importSelectedTaskIds, setImportSelectedTaskIds] = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importSaving, setImportSaving] = useState(false)
  const [importSearch, setImportSearch] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmContent, setConfirmContent] = useState('')
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkingKeyResult, setLinkingKeyResult] = useState<{
    id: string
    title: string
    projectName: string
    objectiveTitle: string
  } | null>(null)
  const [linkTasks, setLinkTasks] = useState<Task[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
  })

  const [objectiveForm, setObjectiveForm] = useState({
    title: '',
    description: '',
    status: 'on_track',
  })

  const [keyResultForm, setKeyResultForm] = useState({
    title: '',
    status: 'on_track',
  })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getProjects()
      setProjects(res || [])
    } catch (error) {
      toast.error('获取项目列表失败')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const resetProjectForm = () => {
    setProjectForm({
      name: '',
      description: '',
      status: 'active',
      start_date: '',
      end_date: '',
    })
    setImportSelectedTaskIds([])
    setImportSearch('')
  }

  const resetObjectiveForm = () => {
    setObjectiveForm({
      title: '',
      description: '',
      status: 'on_track',
    })
  }

  const resetKeyResultForm = () => {
    setKeyResultForm({
      title: '',
      status: 'on_track',
    })
  }

  const openLinkDialog = async (kr: KeyResult, objective: Objective, project: Project) => {
    setLinkingKeyResult({
      id: kr.id,
      title: kr.title,
      projectName: project.name,
      objectiveTitle: objective.title,
    })
    setSelectedTaskIds([])
    setTaskSearch('')
    setLinkDialogOpen(true)
    setLinkLoading(true)
    try {
      const res = await getTaskBoard()
      setLinkTasks(res.tasks || [])
    } catch (error) {
      toast.error('获取任务列表失败')
      setLinkTasks([])
    } finally {
      setLinkLoading(false)
    }
  }

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId],
    )
  }

  const handleSaveLink = async () => {
    if (!linkingKeyResult) return
    if (selectedTaskIds.length === 0) {
      toast.error('请选择要关联的任务')
      return
    }
    setLinkSaving(true)
    try {
      await Promise.all(
        selectedTaskIds.map(taskId => updateTask(taskId, { key_result_id: linkingKeyResult.id })),
      )
      toast.success('已关联任务')
      setLinkDialogOpen(false)
      setSelectedTaskIds([])
      fetchProjects()
    } catch (error) {
      toast.error('关联任务失败')
    } finally {
      setLinkSaving(false)
    }
  }

  const openImportDialog = async () => {
    setImportDialogOpen(true)
    setImportLoading(true)
    try {
      const res = await getTaskBoard()
      const tasks = res.tasks || []
      setImportTasks(tasks.filter(task => task.status !== 'done'))
    } catch (error) {
      toast.error('获取任务列表失败')
      setImportTasks([])
    } finally {
      setImportLoading(false)
    }
  }

  const handleToggleImportTask = (taskId: string) => {
    setImportSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId],
    )
  }

  const openProjectDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project)
      setProjectForm({
        name: project.name,
        description: project.description || '',
        status: project.status,
        start_date: project.start_date || '',
        end_date: project.end_date || '',
      })
      setImportSelectedTaskIds([])
      setImportSearch('')
    } else {
      setEditingProject(null)
      resetProjectForm()
    }
    setProjectDialogOpen(true)
  }

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }))
  }

  const openObjectiveDialog = (projectId: string, objective?: Objective) => {
    setActiveProjectId(projectId)
    if (objective) {
      setEditingObjective(objective)
      setObjectiveForm({
        title: objective.title,
        description: objective.description || '',
        status: objective.status,
      })
    } else {
      setEditingObjective(null)
      resetObjectiveForm()
    }
    setObjectiveDialogOpen(true)
  }

  const openKeyResultDialog = (objectiveId: string, keyResult?: KeyResult) => {
    setActiveObjectiveId(objectiveId)
    if (keyResult) {
      setEditingKeyResult(keyResult)
      setKeyResultForm({
        title: keyResult.title,
        status: keyResult.status,
      })
    } else {
      setEditingKeyResult(null)
      resetKeyResultForm()
    }
    setKeyResultDialogOpen(true)
  }

  const handleSaveProject = async () => {
    if (!projectForm.name.trim()) {
      toast.error('请输入项目名称')
      return
    }
    try {
      const payload = {
        name: projectForm.name.trim(),
        description: projectForm.description.trim() || null,
        status: projectForm.status,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
      }
      let projectId = editingProject?.id
      if (editingProject) {
        await updateProject(editingProject.id, payload)
        projectId = editingProject.id
        toast.success('项目已更新')
      } else {
        const created = await createProject(payload)
        projectId = created.id
        toast.success('项目已创建')
      }
      if (projectId && importSelectedTaskIds.length > 0) {
        setImportSaving(true)
        const objective = await createObjective(projectId, {
          title: '任务推进',
          description: '从任务看板导入',
          status: 'on_track',
        })
        const taskMap = new Map(importTasks.map(t => [t.id, t]))
        for (const taskId of importSelectedTaskIds) {
          const task = taskMap.get(taskId)
          if (!task) continue
          const kr = await createKeyResult(objective.id, {
            title: task.title,
            current_value: 0,
            target_value: 1,
            unit: '项',
            status: 'on_track',
          })
          await updateTask(taskId, { key_result_id: kr.id })
        }
        toast.success('已导入任务并关联 OKR')
      }
      setProjectDialogOpen(false)
      resetProjectForm()
      setEditingProject(null)
      fetchProjects()
    } catch (error) {
      toast.error('保存项目失败')
    } finally {
      setImportSaving(false)
    }
  }

  const handleSaveObjective = async () => {
    if (!objectiveForm.title.trim() || !activeProjectId) {
      toast.error('请输入目标标题')
      return
    }
    try {
      const payload = {
        title: objectiveForm.title.trim(),
        description: objectiveForm.description.trim() || null,
        status: objectiveForm.status,
      }
      if (editingObjective) {
        await updateObjective(editingObjective.id, payload)
        toast.success('目标已更新')
      } else {
        await createObjective(activeProjectId, payload)
        toast.success('目标已创建')
      }
      setObjectiveDialogOpen(false)
      resetObjectiveForm()
      setEditingObjective(null)
      fetchProjects()
    } catch (error) {
      toast.error('保存目标失败')
    }
  }

  const handleSaveKeyResult = async () => {
    if (!keyResultForm.title.trim() || !activeObjectiveId) {
      toast.error('请输入关键结果')
      return
    }
    try {
      const payload = {
        title: keyResultForm.title.trim(),
        status: keyResultForm.status,
      }
      if (editingKeyResult) {
        await updateKeyResult(editingKeyResult.id, payload)
        toast.success('关键结果已更新')
      } else {
        await createKeyResult(activeObjectiveId, payload)
        toast.success('关键结果已创建')
      }
      setKeyResultDialogOpen(false)
      resetKeyResultForm()
      setEditingKeyResult(null)
      fetchProjects()
    } catch (error) {
      toast.error('保存关键结果失败')
    }
  }

  const openConfirm = (title: string, content: string, action: () => Promise<void>) => {
    setConfirmTitle(title)
    setConfirmContent(content)
    setConfirmAction(() => action)
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    try {
      await confirmAction()
    } finally {
      setConfirmOpen(false)
      setConfirmAction(null)
    }
  }

  const statusChip = useCallback((status: string, type: 'project' | 'objective' | 'key') => {
    const list =
      type === 'project'
        ? projectStatuses
        : type === 'objective'
          ? objectiveStatuses
          : keyResultStatuses
    const match = list.find(item => item.value === status)
    return (
      <Chip
        label={match?.label || status}
        size="small"
        color={
          (match?.color as 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info') ||
          'default'
        }
        sx={{ borderRadius: 999 }}
      />
    )
  }, [])

  const filteredTasks = linkTasks.filter(task => {
    if (!taskSearch.trim()) return true
    const keyword = taskSearch.trim().toLowerCase()
    return (
      task.title.toLowerCase().includes(keyword) ||
      task.assignee?.toLowerCase().includes(keyword) ||
      task.description?.toLowerCase().includes(keyword)
    )
  })

  const filteredImportTasks = importTasks.filter(task => {
    if (!importSearch.trim()) return true
    const keyword = importSearch.trim().toLowerCase()
    return (
      task.title.toLowerCase().includes(keyword) ||
      task.assignee?.toLowerCase().includes(keyword) ||
      task.description?.toLowerCase().includes(keyword)
    )
  })

  const emptyState = (
    <Paper
      sx={{
        p: { xs: 3, sm: 4 },
        borderRadius: 3,
        border: softBorder,
        bgcolor: panelBg,
        textAlign: 'center',
      }}
    >
      <FlagOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
      <Typography variant="h6">还没有项目 OKR</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        创建项目并拆解目标与关键结果，形成可追踪的执行闭环。
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        sx={{ mt: 2, borderRadius: 999 }}
        onClick={() => openProjectDialog()}
      >
        新建项目
      </Button>
    </Paper>
  )

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            项目 / OKR
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            把目标拆解成可执行的关键结果，并持续跟踪进度。
          </Typography>
        </Box>
        {!loading && projects.length > 0 && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openProjectDialog()}>
            新建项目
          </Button>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : projects.length === 0 ? (
        emptyState
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5 }}>
          {projects.map(project => (
            <Paper
              key={project.id}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                border: softBorder,
                bgcolor: panelBg,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {project.name}
                  </Typography>
                  {project.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {project.description}
                    </Typography>
                  )}
                  <Box
                    sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    {statusChip(project.status, 'project')}
                    {project.start_date && (
                      <Chip
                        label={`开始 ${project.start_date}`}
                        size="small"
                        sx={{ borderRadius: 999 }}
                      />
                    )}
                    {project.end_date && (
                      <Chip
                        label={`截止 ${project.end_date}`}
                        size="small"
                        sx={{ borderRadius: 999 }}
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ minWidth: 160 }}>
                  <Typography variant="body2" color="text.secondary">
                    总体进度
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {Math.round(project.progress)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={project.progress}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => openObjectiveDialog(project.id)}
                >
                  添加目标
                </Button>
                <Button
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => openProjectDialog(project)}
                >
                  编辑项目
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() =>
                    openConfirm(
                      '删除项目',
                      `确认删除项目「${project.name}」及其 OKR 吗？`,
                      async () => {
                        await deleteProject(project.id)
                        toast.success('项目已删除')
                        fetchProjects()
                      },
                    )
                  }
                >
                  删除
                </Button>
              </Box>
              <Divider />
              {expandedProjects[project.id] ? (
                project.objectives.length === 0 ? (
                  <Box sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      还没有目标，点击“添加目标”开始拆解。
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => toggleProjectExpand(project.id)}
                        endIcon={<ExpandLessIcon fontSize="small" />}
                      >
                        收起目标
                      </Button>
                    </Box>
                    {project.objectives.map(objective => (
                      <Box
                        key={objective.id}
                        sx={{
                          borderRadius: 2,
                          border: softBorder,
                          bgcolor: subBg,
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 2,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {objective.title}
                            </Typography>
                            {objective.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {objective.description}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                              {statusChip(objective.status, 'objective')}
                            </Box>
                          </Box>
                          <Box sx={{ minWidth: 140 }}>
                            <Typography variant="body2" color="text.secondary">
                              目标进度
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {Math.round(objective.progress)}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={objective.progress}
                              sx={{
                                height: 6,
                                borderRadius: 999,
                                bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                              }}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => openKeyResultDialog(objective.id)}
                          >
                            添加关键结果
                          </Button>
                          <Button
                            size="small"
                            startIcon={<EditOutlinedIcon />}
                            onClick={() => openObjectiveDialog(project.id, objective)}
                          >
                            编辑目标
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() =>
                              openConfirm(
                                '删除目标',
                                `确认删除目标「${objective.title}」吗？`,
                                async () => {
                                  await deleteObjective(objective.id)
                                  toast.success('目标已删除')
                                  fetchProjects()
                                },
                              )
                            }
                          >
                            删除
                          </Button>
                        </Box>
                        {objective.key_results.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            暂无关键结果
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {objective.key_results.map(kr => (
                              <Box
                                key={kr.id}
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 0.75,
                                  p: 1.5,
                                  borderRadius: 2,
                                  border: softBorder,
                                  bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.85)',
                                }}
                              >
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                      {kr.title}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {kr.linked_task_count > 0
                                        ? `已完成 ${kr.completed_task_count} / ${kr.linked_task_count} 个任务`
                                        : '未关联任务，进度会按关联任务自动计算'}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    {statusChip(kr.status, 'key')}
                                    <IconButton
                                      size="small"
                                      onClick={() => openLinkDialog(kr, objective, project)}
                                      title="关联任务"
                                    >
                                      <LinkIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() => openKeyResultDialog(objective.id, kr)}
                                    >
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        openConfirm(
                                          '删除关键结果',
                                          `确认删除关键结果「${kr.title}」吗？`,
                                          async () => {
                                            await deleteKeyResult(kr.id)
                                            toast.success('关键结果已删除')
                                            fetchProjects()
                                          },
                                        )
                                      }
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={kr.progress}
                                  sx={{
                                    height: 6,
                                    borderRadius: 999,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                                  }}
                                />
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )
              ) : (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    目标已折叠，点击展开查看。
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => toggleProjectExpand(project.id)}
                    endIcon={<ExpandMoreIcon fontSize="small" />}
                  >
                    展开目标
                  </Button>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      <Dialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingProject ? '编辑项目' : '新建项目'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="项目名称"
            value={projectForm.name}
            onChange={e => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
          />
          <TextField
            label="项目描述"
            value={projectForm.description}
            onChange={e => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            select
            label="项目状态"
            value={projectForm.status}
            onChange={e => setProjectForm(prev => ({ ...prev, status: e.target.value }))}
            fullWidth
          >
            {projectStatuses.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="开始日期"
              type="date"
              value={projectForm.start_date}
              onChange={e => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <TextField
              label="截止日期"
              type="date"
              value={projectForm.end_date}
              onChange={e => setProjectForm(prev => ({ ...prev, end_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 160 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle2">导入任务（可选）</Typography>
              <Typography variant="caption" color="text.secondary">
                将任务看板中的待办导入为关键结果
              </Typography>
            </Box>
            <Button variant="outlined" size="small" onClick={openImportDialog}>
              选择任务
            </Button>
          </Box>
          {importSelectedTaskIds.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              已选择 {importSelectedTaskIds.length} 个任务
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setProjectDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button variant="contained" onClick={handleSaveProject} disabled={importSaving}>
            {importSaving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={objectiveDialogOpen}
        onClose={() => setObjectiveDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingObjective ? '编辑目标' : '新建目标'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="目标标题"
            value={objectiveForm.title}
            onChange={e => setObjectiveForm(prev => ({ ...prev, title: e.target.value }))}
            fullWidth
          />
          <TextField
            label="目标描述"
            value={objectiveForm.description}
            onChange={e => setObjectiveForm(prev => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            select
            label="目标状态"
            value={objectiveForm.status}
            onChange={e => setObjectiveForm(prev => ({ ...prev, status: e.target.value }))}
            fullWidth
          >
            {objectiveStatuses.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setObjectiveDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button variant="contained" onClick={handleSaveObjective}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={keyResultDialogOpen}
        onClose={() => setKeyResultDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingKeyResult ? '编辑关键结果' : '新建关键结果'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="关键结果"
            value={keyResultForm.title}
            onChange={e => setKeyResultForm(prev => ({ ...prev, title: e.target.value }))}
            fullWidth
          />
          <Typography variant="body2" color="text.secondary">
            关键结果进度将根据关联任务的完成情况自动计算，无需手动填写当前值或目标值。
          </Typography>
          <TextField
            select
            label="关键结果状态"
            value={keyResultForm.status}
            onChange={e => setKeyResultForm(prev => ({ ...prev, status: e.target.value }))}
            fullWidth
          >
            {keyResultStatuses.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setKeyResultDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button variant="contained" onClick={handleSaveKeyResult}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        content={confirmContent}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        confirmColor="error"
      />

      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>关联任务到 OKR</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {linkingKeyResult && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="subtitle2">{linkingKeyResult.projectName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {linkingKeyResult.objectiveTitle} · {linkingKeyResult.title}
              </Typography>
            </Box>
          )}
          <TextField
            placeholder="搜索任务标题/负责人"
            value={taskSearch}
            onChange={e => setTaskSearch(e.target.value)}
            fullWidth
          />
          {linkLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} />
            </Box>
          ) : filteredTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              暂无可关联任务
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: isMobile ? '60vh' : 360, overflowY: 'auto' }}>
              {filteredTasks.map(task => {
                const checked = selectedTaskIds.includes(task.id)
                const linkedLabel = task.okr
                  ? `已关联：${task.okr.project_name} / ${task.okr.key_result_title}`
                  : ''
                return (
                  <ListItem key={task.id} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      onClick={() => handleToggleTask(task.id)}
                      sx={{
                        borderRadius: 1.5,
                        border: softBorder,
                        alignItems: 'flex-start',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          checked={checked}
                          onChange={() => handleToggleTask(task.id)}
                          onClick={event => event.stopPropagation()}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.title}
                        secondary={
                          linkedLabel
                            ? linkedLabel
                            : task.assignee
                              ? `负责人：${task.assignee}`
                              : task.description || ''
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setLinkDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button variant="contained" onClick={handleSaveLink} disabled={linkSaving}>
            {linkSaving ? '保存中...' : '确认关联'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>选择任务导入</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            placeholder="搜索任务标题/负责人"
            value={importSearch}
            onChange={e => setImportSearch(e.target.value)}
            fullWidth
          />
          {importLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} />
            </Box>
          ) : filteredImportTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              暂无可导入任务
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: isMobile ? '60vh' : 360, overflowY: 'auto' }}>
              {filteredImportTasks.map(task => {
                const checked = importSelectedTaskIds.includes(task.id)
                const linkedLabel = task.okr
                  ? `已关联：${task.okr.project_name} / ${task.okr.key_result_title}`
                  : ''
                return (
                  <ListItem key={task.id} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      onClick={() => handleToggleImportTask(task.id)}
                      sx={{
                        borderRadius: 1.5,
                        border: softBorder,
                        alignItems: 'flex-start',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          checked={checked}
                          onChange={() => handleToggleImportTask(task.id)}
                          onClick={event => event.stopPropagation()}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.title}
                        secondary={
                          linkedLabel
                            ? linkedLabel
                            : task.assignee
                              ? `负责人：${task.assignee}`
                              : task.description || ''
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setImportDialogOpen(false)} color="inherit">
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => setImportDialogOpen(false)}
            disabled={importLoading}
          >
            确认选择
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
