'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { getProjects } from '@/libs/api'
import type { Task, TaskCreate, TaskUpdate } from '@/interfaces'

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TaskCreate | TaskUpdate) => Promise<void>
  task?: Task | null // If provided, it's edit mode
}

export default function TaskDialog({ open, onClose, onSubmit, task }: TaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    due_date: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    key_result_id: '',
  })
  const [okrOptions, setOkrOptions] = useState<Array<{ id: string; label: string }>>([])
  const [okrLoading, setOkrLoading] = useState(false)

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        assignee: task.assignee || '',
        due_date: task.due_date || '',
        priority: task.priority || 'medium',
        key_result_id: task.key_result_id || '',
      })
    } else {
      setFormData({
        title: '',
        description: '',
        assignee: '',
        due_date: '',
        priority: 'medium',
        key_result_id: '',
      })
    }
  }, [task, open])

  useEffect(() => {
    if (!open) return
    let active = true
    setOkrLoading(true)
    getProjects()
      .then(res => {
        if (!active) return
        const options: Array<{ id: string; label: string }> = []
        res.forEach(project => {
          project.objectives?.forEach(objective => {
            objective.key_results?.forEach(kr => {
              options.push({
                id: kr.id,
                label: `${project.name} / ${objective.title} / ${kr.title}`,
              })
            })
          })
        })
        setOkrOptions(options)
      })
      .catch(() => {
        if (active) setOkrOptions([])
      })
      .finally(() => {
        if (active) setOkrLoading(false)
      })
    return () => {
      active = false
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      await onSubmit({
        title: formData.title,
        description: formData.description || undefined,
        assignee: formData.assignee || undefined,
        due_date: formData.due_date || undefined,
        priority: formData.priority,
        key_result_id: formData.key_result_id || null,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{task ? '编辑任务' : '新建任务'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="任务标题"
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="描述"
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="负责人"
              value={formData.assignee}
              onChange={e => setFormData(p => ({ ...p, assignee: e.target.value }))}
              fullWidth
            />
            <TextField
              label="截止日期"
              type="date"
              value={formData.due_date}
              onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>优先级</InputLabel>
              <Select
                value={formData.priority}
                label="优先级"
                onChange={e => setFormData(p => ({ ...p, priority: e.target.value as any }))}
              >
                <MenuItem value="high">高</MenuItem>
                <MenuItem value="medium">中</MenuItem>
                <MenuItem value="low">低</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>关联 OKR（可选）</InputLabel>
              <Select
                value={formData.key_result_id}
                label="关联 OKR（可选）"
                onChange={e => setFormData(p => ({ ...p, key_result_id: e.target.value as string }))}
                disabled={okrLoading}
              >
                <MenuItem value="">不关联</MenuItem>
                {okrOptions.map(option => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button type="submit" variant="contained" disabled={loading || !formData.title.trim()}>
            {task ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
