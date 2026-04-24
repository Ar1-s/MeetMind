import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  Dimensions,
  Share,
  Platform,
} from 'react-native'
import * as FileSystem from 'expo-file-system'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { analysisApi, API_BASE_URL } from '@/libs/api'
import { storage } from '@/libs/storage'
import { Card } from '@/components/ui/Card'
import { AppButton } from '@/components/ui/AppButton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { SlidesStatus } from '@meetmind/shared'

const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '')
const SCREEN_WIDTH = Dimensions.get('window').width
const SLIDE_PADDING = 32 // 16 padding on each side
const SLIDE_WIDTH = SCREEN_WIDTH - SLIDE_PADDING
const SLIDE_ASPECT_RATIO = 9 / 16 // 16:9 slides displayed vertically

type ScreenState = 'loading' | 'empty' | 'generating' | 'done' | 'error'

export default function SlidesScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>()
  const theme = useTheme()

  const [screenState, setScreenState] = useState<ScreenState>('loading')
  const [images, setImages] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [exportExists, setExportExists] = useState<{ pdf: boolean; pptx: boolean }>({
    pdf: false,
    pptx: false,
  })
  const [logs, setLogs] = useState('')
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'pptx' | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getExportRequest = useCallback(
    async (format: 'pdf' | 'pptx') => {
      const token = await storage.getToken()
      if (!token) {
        throw new Error('鐧诲綍鐘舵€佸凡澶辨晥锛岃閲嶆柊鐧诲綍鍚庡啀瀵煎嚭')
      }

      const url = `${API_BASE_URL}/v1/meetings/${meetingId}/slides/export?format=${format}`
      const filename = `meeting-slides-${meetingId}.${format}`
      const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${filename}`

      return {
        url,
        token,
        fileUri,
      }
    },
    [meetingId],
  )

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadImages = useCallback(async () => {
    try {
      const data = await analysisApi.getSlidesImages(meetingId)
      if (data.images && data.images.length > 0) {
        setImages(data.images)
      }
    } catch {
      // images might not be ready yet
    }
  }, [meetingId])

  const loadExportStatus = useCallback(async () => {
    try {
      const data = await analysisApi.getSlidesExportExists(meetingId)
      setExportExists(data)
    } catch {
      // ignore
    }
  }, [meetingId])

  const loadLogs = useCallback(async () => {
    try {
      const data = await analysisApi.getSlidesLogs(meetingId)
      if (data.log) {
        setLogs(data.log)
      }
    } catch {
      // ignore
    }
  }, [meetingId])

  const loadDoneState = useCallback(async () => {
    await Promise.allSettled([loadImages(), loadExportStatus(), loadLogs()])
    setScreenState('done')
  }, [loadImages, loadExportStatus, loadLogs])

  // ---------------------------------------------------------------------------
  // Status polling
  // ---------------------------------------------------------------------------

  const handleStatusUpdate = useCallback(
    (status: SlidesStatus) => {
      setProgress(status.progress ?? 0)
      setStatusMessage(status.message ?? '')

      if (status.status === 'done' || status.status === 'completed') {
        clearPoll()
        loadDoneState()
      } else if (status.status === 'failed' || status.status === 'error') {
        clearPoll()
        setErrorMessage(status.message || 'PPT 鐢熸垚澶辫触')
        setScreenState('error')
      }
    },
    [clearPoll, loadDoneState],
  )

  const startPolling = useCallback(() => {
    clearPoll()
    setScreenState('generating')

    pollRef.current = setInterval(async () => {
      try {
        const status = await analysisApi.getSlidesStatus(meetingId)
        handleStatusUpdate(status)
      } catch {
        // keep polling on network errors
      }
    }, 2000)
  }, [meetingId, clearPoll, handleStatusUpdate])

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  const checkInitialStatus = useCallback(async () => {
    setScreenState('loading')
    try {
      const status = await analysisApi.getSlidesStatus(meetingId)

      if (status.status === 'done' || status.status === 'completed') {
        await loadDoneState()
      } else if (
        status.status === 'generating' ||
        status.status === 'processing' ||
        status.status === 'pending'
      ) {
        setProgress(status.progress ?? 0)
        setStatusMessage(status.message ?? '鐢熸垚涓?..')
        startPolling()
      } else if (status.status === 'failed' || status.status === 'error') {
        setErrorMessage(status.message || 'PPT 鐢熸垚澶辫触')
        setScreenState('error')
      } else {
        // No slides yet or unknown status
        setScreenState('empty')
      }
    } catch {
      // 404 or other error 鈥?no slides exist yet
      setScreenState('empty')
    }
  }, [meetingId, loadDoneState, startPolling])

  useEffect(() => {
    checkInitialStatus()
    return () => clearPoll()
  }, [checkInitialStatus, clearPoll])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleGenerate = async () => {
    setScreenState('generating')
    setProgress(0)
    setStatusMessage('姝ｅ湪鍚姩 PPT 鐢熸垚...')
    setLogs('')

    try {
      await analysisApi.createSlides(meetingId)
      startPolling()
    } catch (e: any) {
      setScreenState('empty')
      Alert.alert('鐢熸垚澶辫触', e.message || '鏃犳硶鍚姩 PPT 鐢熸垚')
    }
  }

  const handleExport = async (format: 'pdf' | 'pptx') => {
    try {
      setExportingFormat(format)
      const { url, token, fileUri } = await getExportRequest(format)
      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const openUri =
        Platform.OS === 'android'
          ? await FileSystem.getContentUriAsync(result.uri)
          : result.uri

      const supported = await Linking.canOpenURL(openUri)
      if (!supported) {
        throw new Error(`褰撳墠璁惧鏃犳硶鎵撳紑 ${format.toUpperCase()} 鏂囦欢`)
      }

      await Linking.openURL(openUri)
    } catch (e: any) {
      Alert.alert('涓嬭浇澶辫触', e.message)
    } finally {
      setExportingFormat(null)
    }
  }

  const handleShare = async (format: 'pdf' | 'pptx') => {
    try {
      const { url } = await getExportRequest(format)
      await Share.share(
        Platform.OS === 'ios' ? { url } : { message: url },
        { dialogTitle: `鍒嗕韩 PPT (${format.toUpperCase()})` },
      )
    } catch {
      // user cancelled
    }
  }

  const handleRetry = () => {
    setErrorMessage('')
    handleGenerate()
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    if (screenState === 'done') {
      await Promise.allSettled([loadImages(), loadExportStatus(), loadLogs()])
    } else {
      await checkInitialStatus()
    }
    setRefreshing(false)
  }, [screenState, loadImages, loadExportStatus, loadLogs, checkInitialStatus])

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  if (screenState === 'loading') {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$background"
        paddingHorizontal="$8"
        gap="$3"
      >
        <ActivityIndicator size="large" color={theme.primary.val} />
        <Text fontSize={14} color="$colorTertiary" marginTop="$2">
          鍔犺浇涓?..
        </Text>
      </YStack>
    )
  }

  // Empty state 鈥?no slides generated yet
  if (screenState === 'empty') {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$background"
        paddingHorizontal="$8"
        gap="$3"
      >
        <Ionicons name="easel-outline" size={56} color={theme.colorPlaceholder.val} />
        <Text fontSize={18} fontWeight="700" color="$color" marginTop="$2">
          灏氭湭鐢熸垚 PPT
        </Text>
        <Text fontSize={14} color="$colorTertiary" textAlign="center" marginBottom="$1">
          鍩轰簬浼氳鍒嗘瀽鑷姩鐢熸垚婕旂ず鏂囩
        </Text>
        <AppButton
          variant="primary"
          size="md"
          marginTop="$2"
          onPress={handleGenerate}
          icon={<Ionicons name="sparkles-outline" size={18} color="#fff" />}
        >
          鐢熸垚 PPT
        </AppButton>
      </YStack>
    )
  }

  // Error state
  if (screenState === 'error') {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$background"
        paddingHorizontal="$8"
        gap="$3"
      >
        <Ionicons name="alert-circle-outline" size={56} color={theme.accentError.val} />
        <Text fontSize={18} fontWeight="700" color="$accentError" marginTop="$2">
          鐢熸垚澶辫触
        </Text>
        <Text
          fontSize={14}
          color="$colorTertiary"
          textAlign="center"
          lineHeight={20}
          marginBottom="$1"
        >
          {errorMessage}
        </Text>
        <AppButton
          variant="primary"
          size="md"
          marginTop="$2"
          onPress={handleRetry}
          icon={<Ionicons name="refresh-outline" size={18} color="#fff" />}
        >
          閲嶆柊鐢熸垚
        </AppButton>
      </YStack>
    )
  }

  // Generating state
  if (screenState === 'generating') {
    const progressPercent = Math.round(progress * 100)

    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$background"
        paddingHorizontal="$8"
        gap="$3"
      >
        <ActivityIndicator size="large" color={theme.primary.val} />
        <Text fontSize={18} fontWeight="700" color="$color" marginTop="$3">
          姝ｅ湪鐢熸垚 PPT
        </Text>
        <Text fontSize={14} color="$colorSecondary" textAlign="center">
          {statusMessage || '澶勭悊涓?..'}
        </Text>

        {/* Progress bar */}
        <XStack width="100%" alignItems="center" gap="$3" marginTop="$2">
          <YStack flex={1}>
            <ProgressBar progress={progressPercent} height={8} />
          </YStack>
          <Text
            fontSize={13}
            fontWeight="600"
            color="$primary"
            minWidth={36}
            textAlign="right"
          >
            {progressPercent}%
          </Text>
        </XStack>

        <Text fontSize={12} color="$colorMuted" marginTop="$2">
          璇峰嬁绂诲紑姝ら〉闈紝鐢熸垚瀹屾垚鍚庡皢鑷姩鏄剧ず
        </Text>
      </YStack>
    )
  }

  // Done state 鈥?show slides
  return (
    <YStack flex={1} backgroundColor="$background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <Card marginBottom="$3">
          <XStack alignItems="center" gap="$2" marginBottom="$1">
            <Ionicons name="easel-outline" size={22} color={theme.primary.val} />
            <Text fontSize={18} fontWeight="700" color="$color">
              PPT 婕旂ず鏂囩
            </Text>
          </XStack>
          <Text fontSize={13} color="$colorTertiary" marginLeft={30}>
            鍏?{images.length} 椤靛够鐏墖
          </Text>
        </Card>

        {/* Slide images */}
        {images.length > 0 ? (
          <Card marginBottom="$3">
            <Text fontSize={15} fontWeight="600" color="$color" marginBottom="$3">
              骞荤伅鐗囬瑙?            </Text>
            {images.map((imagePath, index) => {
              const imageUrl = `${SERVER_BASE_URL}${imagePath}`
              return (
                <YStack
                  key={imagePath}
                  marginBottom="$4"
                  borderRadius="$3"
                  overflow="hidden"
                  backgroundColor="$background"
                  borderWidth={0.5}
                  borderColor="$borderColorLight"
                >
                  <YStack
                    position="absolute"
                    top={8}
                    left={8}
                    zIndex={1}
                    backgroundColor="rgba(0,0,0,0.55)"
                    borderRadius="$6"
                    paddingHorizontal="$2"
                    paddingVertical="$0.5"
                  >
                    <Text color="#fff" fontSize={11} fontWeight="600">
                      {index + 1}
                    </Text>
                  </YStack>
                  <Image
                    source={{ uri: imageUrl }}
                    style={{
                      width: SLIDE_WIDTH - 32,
                      height: (SLIDE_WIDTH - 32) * SLIDE_ASPECT_RATIO,
                      alignSelf: 'center',
                    }}
                    resizeMode="contain"
                  />
                </YStack>
              )
            })}
          </Card>
        ) : (
          <Card marginBottom="$3">
            <Text fontSize={13} color="$colorMuted" textAlign="center" paddingVertical="$2">
              鏆傛棤棰勮鍥剧墖
            </Text>
          </Card>
        )}

        {/* Logs (collapsible) */}
        {logs.length > 0 && (
          <Card marginBottom="$3">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              onPress={() => setLogsExpanded(!logsExpanded)}
              pressStyle={{ opacity: 0.7 }}
              animation="quick"
            >
              <XStack alignItems="center" gap="$1.5">
                <Ionicons name="terminal-outline" size={16} color={theme.colorSecondary.val} />
                <Text fontSize={15} fontWeight="600" color="$color">
                  鐢熸垚鏃ュ織
                </Text>
              </XStack>
              <Ionicons
                name={logsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colorTertiary.val}
              />
            </XStack>
            {logsExpanded && (
              <YStack
                marginTop="$3"
                backgroundColor="#1e1e1e"
                borderRadius="$3"
                padding="$3"
                maxHeight={300}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <Text
                    fontSize={11}
                    fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace' as any}
                    color="#d4d4d4"
                    lineHeight={16}
                  >
                    {logs}
                  </Text>
                </ScrollView>
              </YStack>
            )}
          </Card>
        )}

        {/* Regenerate button */}
        <Card marginBottom="$3">
          <AppButton
            variant="outline"
            size="md"
            onPress={handleGenerate}
            icon={<Ionicons name="refresh-outline" size={16} color={theme.primary.val} />}
            borderStyle="dashed"
          >
            閲嶆柊鐢熸垚
          </AppButton>
        </Card>
      </ScrollView>

      {/* Bottom action bar */}
      {(exportExists.pdf || exportExists.pptx) && (
        <XStack
          alignItems="center"
          gap="$3"
          paddingHorizontal="$4"
          paddingVertical="$3"
          paddingBottom={Platform.OS === 'ios' ? 28 : 12}
          backgroundColor="$cardBackground"
          borderTopWidth={0.5}
          borderTopColor="$borderColorLight"
          shadowColor="$shadowColor"
          shadowOffset={{ width: 0, height: -2 }}
          shadowOpacity={0.06}
          shadowRadius={6}
          elevation={8}
        >
          {exportExists.pdf && (
            <AppButton
              flex={1}
              variant="danger"
              size="md"
              onPress={() => handleExport('pdf')}
              onLongPress={() => handleShare('pdf')}
              disabled={exportingFormat !== null}
              icon={<Ionicons name="document-outline" size={20} color="#fff" />}
            >
              {exportingFormat === 'pdf' ? '瀵煎嚭涓?..' : 'PDF'}
            </AppButton>
          )}
          {exportExists.pptx && (
            <AppButton
              flex={1}
              size="md"
              backgroundColor="$accentWarning"
              color="#ffffff"
              onPress={() => handleExport('pptx')}
              onLongPress={() => handleShare('pptx')}
              disabled={exportingFormat !== null}
              icon={<Ionicons name="easel-outline" size={20} color="#fff" />}
            >
              {exportingFormat === 'pptx' ? '瀵煎嚭涓?..' : 'PPTX'}
            </AppButton>
          )}
          <YStack
            width={44}
            height={44}
            borderRadius="$5"
            borderWidth={1}
            borderColor="$primaryLight"
            backgroundColor="$primaryLight"
            justifyContent="center"
            alignItems="center"
            pressStyle={{ opacity: 0.7, scale: 0.96 }}
            animation="quick"
            onPress={() => handleShare(exportExists.pdf ? 'pdf' : 'pptx')}
          >
            <Ionicons name="share-outline" size={20} color={theme.primary.val} />
          </YStack>
        </XStack>
      )}
    </YStack>
  )
}
