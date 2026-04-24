'use client'

import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import type { Recording } from '@/interfaces'

interface AudioPlayerProps {
  recording: Recording
  seekTo?: number
  autoPlay?: boolean
}

const normalizeOrigin = (value?: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  const withoutTrailingSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
  return withoutTrailingSlash.endsWith('/api')
    ? withoutTrailingSlash.slice(0, -4)
    : withoutTrailingSlash
}

const resolveAudioSrc = (audioUri?: string) => {
  if (!audioUri) return ''
  if (/^https?:\/\//i.test(audioUri)) return audioUri
  if (!audioUri.startsWith('/uploads/')) return audioUri

  const directOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_DIRECT_API_URL)
  if (directOrigin) {
    return `${directOrigin}${audioUri}`
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    const directPort = (process.env.NEXT_PUBLIC_DIRECT_API_PORT || '3452').trim()
    if (directPort) {
      return `${protocol}//${hostname}:${directPort}${audioUri}`
    }
  }

  return audioUri
}

export default function AudioPlayer({ recording, seekTo, autoPlay }: AudioPlayerProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [sliderValue, setSliderValue] = useState(0)
  const [duration, setDuration] = useState(recording.duration || 0)
  const [muted, setMuted] = useState(false)
  const [hasSeeked, setHasSeeked] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const audioSrc = resolveAudioSrc(recording.audio_uri)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setSliderValue(0)
    setDuration(recording.duration || 0)
    setHasSeeked(false)
    setLoadError(false)
    setSeeking(false)
  }, [recording.id, recording.audio_uri, recording.duration, audioSrc])

  useEffect(() => {
    if (!seeking) {
      setSliderValue(currentTime)
    }
  }, [currentTime, seeking])

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setPlaying(!playing)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const nextTime = audioRef.current.currentTime
      setCurrentTime(nextTime)
      if (!seeking) {
        setSliderValue(nextTime)
      }
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const nextDuration = Number.isFinite(audioRef.current.duration)
        ? audioRef.current.duration
        : recording.duration || 0
      setDuration(nextDuration)
      setLoadError(false)
      if (seekTo !== undefined && !hasSeeked) {
        audioRef.current.currentTime = seekTo
        setCurrentTime(seekTo)
        setSliderValue(seekTo)
        setHasSeeked(true)
        if (autoPlay) {
          audioRef.current.play()
          setPlaying(true)
        }
      }
    }
  }

  const handleSliderChange = (_: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setSeeking(true)
      setSliderValue(value)
    }
  }

  const handleSliderCommit = (_: Event | SyntheticEvent, value: number | number[]) => {
    if (audioRef.current && typeof value === 'number') {
      audioRef.current.currentTime = value
      setCurrentTime(value)
      setSliderValue(value)
    }
    setSeeking(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2 },
        borderRadius: { xs: 3, sm: 2 },
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        boxShadow: {
          xs: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
          sm: isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
        },
        bgcolor: 'background.paper',
      }}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleLoadedMetadata}
        onEnded={() => setPlaying(false)}
        onError={() => setLoadError(true)}
        muted={muted}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            justifyContent: { xs: 'space-between', sm: 'flex-start' },
          }}
        >
          <IconButton
            onClick={togglePlay}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              boxShadow: '0 8px 16px rgba(25,118,210,0.3)',
            }}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 45, fontWeight: 600 }}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              /
            </Typography>
            <Typography variant="body2" sx={{ minWidth: 45 }}>
              {formatTime(duration)}
            </Typography>
          </Box>

          {!isMobile && (
            <IconButton
              onClick={() => setMuted(!muted)}
              size="small"
              sx={{
                bgcolor: isDark ? '#1A1C24' : 'grey.100',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Slider
            size="small"
            value={sliderValue}
            max={duration || 100}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderCommit}
            sx={{ flexGrow: 1 }}
          />
          {isMobile && (
            <IconButton
              onClick={() => setMuted(!muted)}
              size="small"
              sx={{
                bgcolor: isDark ? '#1A1C24' : 'grey.100',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {loadError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          音频文件加载失败，请检查录音文件是否存在且格式可播放。
        </Typography>
      )}
    </Paper>
  )
}
