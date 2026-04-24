'use client'

import { useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import MicIcon from '@mui/icons-material/Mic'
import StopIcon from '@mui/icons-material/Stop'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { translateText } from '@/libs/api'
import { useToastStore } from '@/libs/stores'

const languageOptions = [
  { code: 'auto', label: '自动识别' },
  { code: 'zh-CN', label: '中文（简体）' },
  { code: 'zh-TW', label: '中文（繁体）' },
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'es', label: '西班牙语' },
  { code: 'ru', label: '俄语' },
  { code: 'pt', label: '葡萄牙语' },
  { code: 'it', label: '意大利语' },
  { code: 'ar', label: '阿拉伯语' },
  { code: 'hi', label: '印地语' },
]

const targetOptions = languageOptions.filter(item => item.code !== 'auto')

export default function TranslatePage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const cardBg = isDark ? 'rgba(17,19,25,0.92)' : 'rgba(255,255,255,0.9)'
  const accent = isDark ? '#0A84FF' : '#1774FF'
  const toast = useToastStore()

  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [autoDetect, setAutoDetect] = useState(true)
  const [sourceLang, setSourceLang] = useState('zh-CN')
  const [targetLang, setTargetLang] = useState('en')
  const [enhance, setEnhance] = useState(true)
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [detectedLang, setDetectedLang] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const baseTranscriptRef = useRef('')
  const finalTranscriptRef = useRef('')

  const detectedLabel = useMemo(() => {
    if (!detectedLang) return null
    return languageOptions.find(item => item.code === detectedLang)?.label || detectedLang
  }, [detectedLang])

  const swapLanguages = () => {
    if (autoDetect) return
    const prevSource = sourceLang
    const prevTarget = targetLang
    setSourceLang(prevTarget)
    setTargetLang(prevSource)
  }

  const startListening = () => {
    if (listening) return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('当前浏览器不支持语音输入')
      return
    }
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = autoDetect ? 'zh-CN' : sourceLang
    baseTranscriptRef.current = inputText
    finalTranscriptRef.current = ''
    recognition.onresult = (event: any) => {
      let interim = ''
      let finalSegment = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript || ''
        if (result.isFinal) {
          finalSegment += transcript
        } else {
          interim += transcript
        }
      }
      if (finalSegment) {
        finalTranscriptRef.current += finalSegment
      }
      setInputText(`${baseTranscriptRef.current}${finalTranscriptRef.current}${interim}`)
    }
    recognition.onerror = () => {
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
    }
    recognition.start()
    setListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const handleTranslate = async () => {
    if (!inputText.trim()) return
    setTranslating(true)
    setOutputText('')
    setDetectedLang(null)
    try {
      const res = await translateText({
        text: inputText.trim(),
        source_lang: autoDetect ? 'auto' : sourceLang,
        target_lang: targetLang,
        enhance,
      })
      setOutputText(res.translation || '')
      if (res.detected_language) {
        setDetectedLang(res.detected_language)
      }
    } catch (error) {
      toast.error('翻译失败，请稍后重试')
    } finally {
      setTranslating(false)
    }
  }

  const handleCopy = async () => {
    if (!outputText) return
    await navigator.clipboard.writeText(outputText)
    toast.success('已复制译文')
  }

  const handleSpeak = () => {
    if (!outputText || typeof window === 'undefined') return
    const utter = new SpeechSynthesisUtterance(outputText)
    utter.lang = targetLang
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  const handleClearInput = () => {
    if (listening) {
      stopListening()
    }
    setInputText('')
    setDetectedLang(null)
  }

  const contentMinHeight = isMobile ? 220 : 260

  const inputCard = (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: softBorder,
        bgcolor: cardBg,
        backdropFilter: 'blur(12px)',
        boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.4)' : '0 16px 40px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
      }}
    >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'nowrap',
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60, flexShrink: 0 }}>
            输入语言
          </Typography>
          <TextField
            select
            size="small"
            value={autoDetect ? 'auto' : sourceLang}
            onChange={e => setSourceLang(e.target.value)}
            disabled={autoDetect}
            sx={{
              minWidth: { xs: 140, sm: 180 },
              flexShrink: 0,
              '& .MuiOutlinedInput-root': { borderRadius: 999 },
            }}
          >
            {languageOptions.map(option => (
              <MenuItem key={option.code} value={option.code}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {detectedLabel && (
            <Chip
              label={`识别：${detectedLabel}`}
              size="small"
              sx={{ borderRadius: 999, flexShrink: 0 }}
            />
          )}
        </Box>
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 0.5, sm: 1 },
          flexWrap: 'nowrap',
          alignItems: 'center',
          width: '100%',
          minWidth: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <Button
          size="small"
          onClick={() => setAutoDetect(prev => !prev)}
          variant={autoDetect ? 'contained' : 'outlined'}
          sx={{
            borderRadius: 999,
            px: { xs: 1, sm: 1.6 },
            fontSize: { xs: '0.72rem', sm: '0.8rem' },
            whiteSpace: 'nowrap',
            flexShrink: 0,
            bgcolor: autoDetect ? accent : 'transparent',
            borderColor: autoDetect
              ? 'transparent'
              : isDark
                ? 'rgba(255,255,255,0.24)'
                : 'rgba(0,0,0,0.16)',
            color: autoDetect ? 'white' : isDark ? 'rgba(255,255,255,0.82)' : 'text.secondary',
          }}
        >
          自动识别
        </Button>
        <Button
          size="small"
          onClick={() => setEnhance(prev => !prev)}
          variant={enhance ? 'contained' : 'outlined'}
          sx={{
            borderRadius: 999,
            px: { xs: 1, sm: 1.6 },
            fontSize: { xs: '0.72rem', sm: '0.8rem' },
            whiteSpace: 'nowrap',
            flexShrink: 0,
            bgcolor: enhance ? accent : 'transparent',
            borderColor: enhance
              ? 'transparent'
              : isDark
                ? 'rgba(255,255,255,0.24)'
                : 'rgba(0,0,0,0.16)',
            color: enhance ? 'white' : isDark ? 'rgba(255,255,255,0.82)' : 'text.secondary',
          }}
        >
          AI 增强
        </Button>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            borderRadius: 999,
            border: softBorder,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)',
            p: 0.25,
            flexShrink: 0,
          }}
        >
          {[
            { key: 'text', label: '文字输入' },
            { key: 'voice', label: '语音输入' },
          ].map(option => (
            <Button
              key={option.key}
              onClick={() => setInputMode(option.key as 'text' | 'voice')}
              variant={inputMode === option.key ? 'contained' : 'text'}
              size="small"
              sx={{
                borderRadius: 999,
                px: { xs: 1, sm: 1.6 },
                fontSize: { xs: '0.72rem', sm: '0.8rem' },
                whiteSpace: 'nowrap',
                bgcolor: inputMode === option.key ? accent : 'transparent',
                color: inputMode === option.key ? 'white' : 'text.secondary',
              }}
            >
              {option.label}
            </Button>
          ))}
        </Box>
      </Box>
      {inputMode === 'text' ? (
        <Box sx={{ position: 'relative' }}>
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: 18,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.9rem',
              color: 'text.secondary',
              transition: 'all 0.18s ease',
              pointerEvents: 'none',
              opacity: inputText.trim() ? 0 : 1,
              display: inputText.trim() ? 'none' : 'block',
            }}
          >
            输入需要翻译的内容...
          </Typography>
          <TextField
            multiline
            minRows={isMobile ? 4 : 5}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '输入需要翻译的内容' }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.02)',
                minHeight: contentMinHeight,
                alignItems: 'flex-start',
                '& .MuiInputBase-input': {
                  pt: 2.5,
                  pb: 6,
                },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              display: 'flex',
              gap: 1,
            }}
          >
            <Button
              onClick={handleClearInput}
              variant="text"
              size="small"
              disabled={!inputText.trim() && !detectedLang}
            >
              清空
            </Button>
            <Button
              onClick={handleTranslate}
              variant="contained"
              size="small"
              disabled={!inputText.trim() || translating}
              sx={{ borderRadius: 999, px: 2 }}
            >
              {translating ? <CircularProgress size={16} color="inherit" /> : '翻译'}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            borderRadius: 2.5,
            border: softBorder,
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
            p: 2,
            textAlign: 'center',
            position: 'relative',
            minHeight: contentMinHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              textAlign: 'center',
              px: 2,
            }}
          >
            {listening ? '正在聆听，请开始讲话…' : '点击麦克风开始语音输入'}
          </Typography>
          {!inputText.trim() && (
            <IconButton
              onClick={listening ? stopListening : startListening}
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: listening ? 'error.main' : accent,
                color: 'white',
                boxShadow: '0 12px 24px rgba(10,132,255,0.25)',
                '&:hover': {
                  bgcolor: listening ? 'error.dark' : accent,
                },
                zIndex: 1,
              }}
            >
              {listening ? <StopIcon /> : <MicIcon />}
            </IconButton>
          )}
          {inputText && (
            <Box
              sx={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 60,
                textAlign: 'left',
                maxHeight: 80,
                overflowY: 'auto',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                已识别内容
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {inputText}
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            {inputText.trim() && (
              <IconButton
                onClick={listening ? stopListening : startListening}
                size="small"
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: listening ? 'error.main' : 'rgba(10,132,255,0.16)',
                  color: listening ? 'white' : accent,
                  '&:hover': {
                    bgcolor: listening ? 'error.dark' : 'rgba(10,132,255,0.24)',
                  },
                }}
              >
                {listening ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
              </IconButton>
            )}
            <Button
              onClick={handleClearInput}
              variant="text"
              size="small"
              disabled={!inputText.trim() && !detectedLang}
            >
              清空
            </Button>
            <Button
              onClick={handleTranslate}
              variant="contained"
              size="small"
              disabled={!inputText.trim() || translating}
              sx={{ borderRadius: 999, px: 2 }}
            >
              {translating ? <CircularProgress size={16} color="inherit" /> : '翻译'}
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  )

  const outputCard = (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: softBorder,
        bgcolor: cardBg,
        backdropFilter: 'blur(12px)',
        boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.4)' : '0 16px 40px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72 }}>
          输出语言
        </Typography>
        <TextField
          select
          size="small"
          value={targetLang}
          onChange={e => setTargetLang(e.target.value)}
          sx={{
            minWidth: 160,
            '& .MuiOutlinedInput-root': { borderRadius: 999 },
          }}
        >
          {targetOptions.map(option => (
            <MenuItem key={option.code} value={option.code}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Tooltip title="复制译文">
            <span>
              <IconButton
                onClick={handleCopy}
                disabled={!outputText}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: accent } }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="朗读译文">
            <span>
              <IconButton
                onClick={handleSpeak}
                disabled={!outputText}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: accent } }}
              >
                <VolumeUpIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
      <Box
        sx={{
          borderRadius: 2.5,
          border: softBorder,
          bgcolor: isDark ? 'rgba(8,10,16,0.7)' : '#23324A',
          color: 'common.white',
          p: 2,
          minHeight: contentMinHeight,
          maxHeight: contentMinHeight,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {outputText ? outputText : '翻译结果会显示在这里'}
      </Box>
    </Paper>
  )

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 3 },
        minHeight: 'calc(100vh - 64px)',
        background: isDark
          ? 'linear-gradient(180deg, rgba(9,10,13,1) 0%, rgba(16,20,28,1) 50%, rgba(9,10,13,1) 100%)'
          : 'linear-gradient(180deg, #F4F7FF 0%, #EEF2FF 45%, #F8FAFF 100%)',
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            同声传译
          </Typography>
          <Typography variant="body2" color="text.secondary">
            支持语音与文字输入，AI 增强翻译
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
            gap: 2,
            alignItems: { xs: 'start', md: 'stretch' },
          }}
        >
          {inputCard}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
            }}
          >
            <Tooltip title={autoDetect ? '关闭自动识别后可交换语言' : '交换语言'}>
              <span>
                <IconButton
                  onClick={swapLanguages}
                  disabled={autoDetect}
                  sx={{
                    border: softBorder,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                  }}
                >
                  <SwapHorizIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          {outputCard}
        </Box>
        {isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Tooltip title={autoDetect ? '关闭自动识别后可交换语言' : '交换语言'}>
              <span>
                <Button
                  onClick={swapLanguages}
                  disabled={autoDetect}
                  startIcon={<SwapHorizIcon />}
                  variant="outlined"
                  sx={{ borderRadius: 999, px: 3 }}
                >
                  交换语言
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  )
}
