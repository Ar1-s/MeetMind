'use client'

import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import LinearProgress from '@mui/material/LinearProgress'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useToastStore } from '@/libs/stores'
import { createMeeting } from '@/libs/api'
import { importRecording } from '@/libs/api/recordings'
import { enqueueRecording } from '@/libs/offline/recording-queue'

interface CreateFromImportDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateFromImportDialog({
  open,
  onClose,
  onSuccess,
}: CreateFromImportDialogProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const softBgAlt = isDark ? '#151820' : '#F2F2F7'
  const successBg = isDark ? 'rgba(46, 125, 50, 0.18)' : 'rgba(46, 125, 50, 0.04)'
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState<'select' | 'uploading'>('select')

  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToastStore()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      // Auto-fill title with filename if empty
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleClose = () => {
    if (uploading) return
    setFile(null)
    setTitle('')
    setProgress(0)
    setStep('select')
    onClose()
  }

  const handleSubmit = async () => {
    if (!file || !title) return

    setUploading(true)
    setStep('uploading')
    setProgress(0)

    try {
      // 1. Create Meeting
      const meetingRes = await createMeeting({
        title,
        tags: ['导入'],
      })

      const meetingId = meetingRes.id || (meetingRes as any).meeting_id

      if (!meetingId) {
        throw new Error('创建会议失败')
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueueRecording(meetingId, file)
        setProgress(100)
        toast.success('会议已创建，录音已加入离线上传队列')
        onSuccess()
        handleClose()
        return
      }

      // 2. Upload File
      await importRecording(meetingId, file, value => {
        setProgress(value)
      })
      setProgress(100)
      toast.success('会议创建并导入成功')
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Process error:', error)
      toast.error(error.message || '操作失败')
      setStep('select')
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      <DialogTitle>导入录音创建会议</DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        {step === 'select' && (
          <Box sx={{ mt: 1 }}>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: file
                  ? 'success.main'
                  : isDark
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(0,0,0,0.15)',
                borderRadius: 3,
                p: { xs: 3, sm: 4 },
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: file ? successBg : softBg,
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                mb: 3,
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".mp3,.m4a,.wav,.aac"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <CloudUploadIcon
                sx={{ fontSize: 48, color: file ? 'success.main' : '#007AFF', mb: 1 }}
              />
              <Typography
                variant="body1"
                gutterBottom
                color={file ? 'text.primary' : 'text.secondary'}
              >
                {file ? '已选择文件' : '点击选择或拖拽音频文件'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                支持 MP3, M4A, WAV, AAC 格式
              </Typography>
            </Box>

            {file && (
              <>
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    bgcolor: softBgAlt,
                    borderRadius: 2,
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    文件信息
                  </Typography>
                  <Typography variant="body2" noWrap>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    大小: {formatFileSize(file.size)}
                  </Typography>
                </Box>

                <TextField
                  autoFocus
                  margin="dense"
                  id="title"
                  label="会议标题"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="请输入会议标题"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      bgcolor: softBg,
                    },
                  }}
                />
              </>
            )}
          </Box>
        )}

        {step === 'uploading' && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              正在处理...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              正在创建会议并上传录音文件，请勿关闭窗口
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ mb: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              {progress}%
            </Typography>
          </Box>
        )}
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
        <Button onClick={handleClose} disabled={uploading}>
          取消
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!file || !title || uploading}>
          {uploading ? '处理中...' : '创建并导入'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
