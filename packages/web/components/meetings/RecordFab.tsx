'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Tooltip from '@mui/material/Tooltip'
import Fab from '@mui/material/Fab'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { recordingService } from '@/libs/services/recording'
import { request } from '@/libs/request'

export default function RecordFab() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [isRecording, setIsRecording] = useState(false)
  const router = useRouter()

  const handleRecordingToggle = async () => {
    if (!isRecording) {
      const started = await recordingService.startRecording()
      if (started) {
        setIsRecording(true)
      } else {
        console.error('开始录音失败，请检查麦克风权限')
      }
      return
    }

    setIsRecording(false)
    try {
      const audioBlob = await recordingService.stopRecording()
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' })
      const api = request()

      const meetingData = await api.post<{ meeting_id?: string; id?: string }>('/v1/meetings', {
        data: {
          title: `录音会议 ${new Date().toLocaleString()}`,
          tags: ['录音'],
        },
      })

      const meetingId = meetingData.meeting_id || meetingData.id
      if (!meetingId) {
        throw new Error('创建会议失败：未返回会议 ID')
      }

      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('storage_preference', 'local')

      await api.fetch(`/v1/recordings/meetings/${meetingId}/import`, {
        method: 'POST',
        data: formData,
      })

      router.push(`/meetings/${meetingId}`)
    } catch (error) {
      console.error('处理录音失败:', error)
    }
  }

  return (
    <Tooltip title={isRecording ? '停止录音' : '开始录音'}>
      <Fab
        color="primary"
        aria-label="录音"
        sx={{
          position: 'fixed',
          bottom: `calc(${isMobile ? 20 : 24}px + env(safe-area-inset-bottom))`,
          right: `calc(${isMobile ? 18 : 24}px + env(safe-area-inset-right))`,
          zIndex: 1000,
          boxShadow: '0 16px 32px rgba(0,122,255,0.35)',
          bgcolor: '#007AFF',
          '&:hover': { boxShadow: '0 20px 36px rgba(0,122,255,0.4)', bgcolor: '#0A84FF' },
        }}
        onClick={handleRecordingToggle}
      >
        {isRecording ? <MicOffIcon /> : <MicIcon />}
      </Fab>
    </Tooltip>
  )
}
