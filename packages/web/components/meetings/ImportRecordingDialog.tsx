'use client'

import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { useToastStore } from '@/libs/stores'
import { importRecording } from '@/libs/api/recordings'
import { enqueueRecording } from '@/libs/offline/recording-queue'

interface ImportRecordingDialogProps {
  open: boolean
  onClose: () => void
  meetingId: string
  onSuccess: () => void
}

export default function ImportRecordingDialog({
  open,
  onClose,
  meetingId,
  onSuccess,
}: ImportRecordingDialogProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'
  const softBgAlt = isDark ? '#151820' : '#F2F2F7'
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToastStore()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
    }
  }

  const handleClose = () => {
    setFile(null)
    setProgress(0)
    onClose()
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setProgress(0)

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueueRecording(meetingId, file)
        toast.success('已加入离线上传队列，联网后自动上传')
        handleClose()
        return
      }

      await importRecording(meetingId, file, value => {
        setProgress(value)
      })
      toast.success('上传成功')
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || '上传失败')
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
      <DialogTitle>导入录音文件</DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <Box
          sx={{
            border: '2px dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.15)',
            borderRadius: 3,
            p: { xs: 3, sm: 4 },
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: softBg,
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
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
          <CloudUploadIcon sx={{ fontSize: 48, color: '#007AFF', mb: 1 }} />
          <Typography variant="body1" gutterBottom>
            点击选择或拖拽音频文件
          </Typography>
          <Typography variant="caption" color="text.secondary">
            支持 MP3, M4A, WAV, AAC 格式
          </Typography>
        </Box>

        {file && (
          <Box sx={{ mt: 2, p: 2, bgcolor: softBgAlt, borderRadius: 2 }}>
            <Typography variant="body2">
              {file.name} ({formatFileSize(file.size)})
            </Typography>
          </Box>
        )}

        {uploading && <LinearProgress variant="determinate" value={progress} sx={{ mt: 2 }} />}
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
        <Button variant="contained" onClick={handleUpload} disabled={!file || uploading}>
          上传
        </Button>
      </DialogActions>
    </Dialog>
  )
}
