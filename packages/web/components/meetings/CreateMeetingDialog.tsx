'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { MeetingCreate, Participant } from '@/interfaces'
import { getProjects } from '@/libs/api'

interface Project {
  id: string
  name: string
}

interface CreateMeetingDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: MeetingCreate) => Promise<void>
}

export default function CreateMeetingDialog({ open, onClose, onSubmit }: CreateMeetingDialogProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [participantsInput, setParticipantsInput] = useState('')
  const [formData, setFormData] = useState<MeetingCreate>({
    title: '',
    start_time: '',
    end_time: '',
    anonymize_participants: false,
    tags: [],
    project_id: '',
  })

  useEffect(() => {
    if (open) {
      getProjects()
        .then(setProjects)
        .catch(() => setProjects([]))
    }
  }, [open])

  const resetForm = () => {
    setFormData({
      title: '',
      start_time: '',
      end_time: '',
      anonymize_participants: false,
      tags: [],
      project_id: '',
    })
    setParticipantsInput('')
  }

  const parseParticipants = (input: string): Participant[] => {
    return input
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const participant: Participant = { name: entry }
        if (entry.includes('@')) {
          participant.email = entry
        }
        return participant
      })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      const submitData: MeetingCreate = {
        ...formData,
        participants: participantsInput.trim()
          ? parseParticipants(participantsInput)
          : undefined,
      }
      // Remove empty optional fields
      if (!submitData.start_time) delete submitData.start_time
      if (!submitData.end_time) delete submitData.end_time
      if (!submitData.project_id) delete submitData.project_id

      await onSubmit(submitData)
      resetForm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleChange = (field: keyof MeetingCreate) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 3,
      bgcolor: softBg,
    },
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      scroll="paper"
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>新建会议</DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="会议标题"
              value={formData.title}
              onChange={handleChange('title')}
              required
              fullWidth
              autoFocus
              sx={fieldSx}
            />
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
              <TextField
                label="开始时间"
                type="datetime-local"
                value={formData.start_time || ''}
                onChange={handleChange('start_time')}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={fieldSx}
              />
              <TextField
                label="结束时间"
                type="datetime-local"
                value={formData.end_time || ''}
                onChange={handleChange('end_time')}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={fieldSx}
              />
            </Box>
            <TextField
              label="参会人（逗号分隔）"
              placeholder="张三, 李四, wang@example.com"
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              fullWidth
              sx={fieldSx}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(formData.anonymize_participants)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      anonymize_participants: e.target.checked,
                    }))
                  }
                />
              }
              label="启用匿名显示，参会人员将自动使用化名"
              sx={{
                mx: 0,
                alignItems: 'flex-start',
                '& .MuiFormControlLabel-label': {
                  color: 'text.secondary',
                  fontSize: '0.95rem',
                },
              }}
            />
            <TextField
              label="标签（用逗号分隔）"
              placeholder="周会, 项目A"
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                }))
              }
              fullWidth
              sx={fieldSx}
            />
            <FormControl fullWidth sx={fieldSx}>
              <InputLabel>关联项目</InputLabel>
              <Select
                value={formData.project_id || ''}
                label="关联项目"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, project_id: e.target.value as string }))
                }
                sx={{ borderRadius: 3, bgcolor: softBg }}
              >
                <MenuItem value="">
                  <em>无</em>
                </MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          <Button onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button type="submit" variant="contained" disabled={loading || !formData.title.trim()}>
            创建
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
