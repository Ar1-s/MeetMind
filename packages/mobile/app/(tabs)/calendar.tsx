import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Platform, RefreshControl, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, useTheme, XStack, YStack } from 'tamagui'

import { Badge, BadgeText, BottomPrimaryAction } from '@/components/ui'
import { calendarApi } from '@/libs/api'
import type { CalendarEvent } from '@meetmind/shared'

const WEEK_TABS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const getDayRange = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  const start = d.toISOString()
  d.setHours(23, 59, 59, 999)
  const end = d.toISOString()
  return { start, end }
}

export default function CalendarScreen() {
  const router = useRouter()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  const [exporting, setExporting] = useState(false)

  const today = new Date()
  const selectedDay = new Date()
  selectedDay.setDate(today.getDate() + dayOffset)

  const fetchEvents = useCallback(async (offset: number) => {
    try {
      const { start, end } = getDayRange(offset)
      const data = await calendarApi.getEvents(start, end)
      setEvents(data)
    } catch (e: any) {
      Alert.alert('获取日历失败', e.message)
    }
  }, [])

  useEffect(() => {
    fetchEvents(dayOffset).finally(() => setLoading(false))
  }, [dayOffset, fetchEvents])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEvents(dayOffset)
    setRefreshing(false)
  }, [dayOffset, fetchEvents])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const handleEventPress = (event: CalendarEvent) => {
    if (event.type === 'meeting' && event.metadata?.original_id) {
      router.push(`/meetings/${event.metadata.original_id}`)
    }
  }

  const handleExportCalendar = useCallback(async () => {
    if (exporting) return

    setExporting(true)
    try {
      const { webcal_url } = await calendarApi.getSubscribeUrl()
      await Clipboard.setStringAsync(webcal_url)
      await Share.share(
        Platform.OS === 'ios'
          ? { url: webcal_url, message: `ICS 订阅链接：${webcal_url}` }
          : { message: `ICS 订阅链接：${webcal_url}` },
        { dialogTitle: '导出 ICS 订阅链接' },
      )
    } catch (e: any) {
      if (e?.message && !String(e.message).includes('User did not share')) {
        Alert.alert('导出失败', e.message)
      }
    } finally {
      setExporting(false)
    }
  }, [exporting])

  const dateLabel = selectedDay.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack
        backgroundColor="$backgroundStrong"
        paddingVertical="$3"
        paddingHorizontal="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderColorLight"
        justifyContent="space-around"
      >
        {[-2, -1, 0, 1, 2].map(offset => {
          const d = new Date()
          d.setDate(today.getDate() + offset)
          const isActive = dayOffset === offset
          return (
            <YStack
              key={offset}
              alignItems="center"
              paddingHorizontal="$2.5"
              paddingVertical="$1.5"
              borderRadius="$5"
              minWidth={48}
              backgroundColor={isActive ? '$primary' : 'transparent'}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => {
                setDayOffset(offset)
                setLoading(true)
              }}
            >
              <Text fontSize={11} color={isActive ? '#fff' : '$colorTertiary'}>
                {offset === 0 ? '今天' : WEEK_TABS[d.getDay()]}
              </Text>
              <Text
                fontSize={18}
                fontWeight="600"
                color={isActive ? '#fff' : '$color'}
                marginTop="$0.5"
              >
                {d.getDate()}
              </Text>
            </YStack>
          )
        })}
      </XStack>

      <Text
        fontSize={13}
        color="$colorTertiary"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$1"
      >
        {dateLabel}
      </Text>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="large" color={theme.primary.val} />
        </YStack>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={
            events.length === 0
              ? { flex: 1, paddingBottom: insets.bottom + 120 }
              : { padding: 16, paddingBottom: insets.bottom + 132 }
          }
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" paddingTop={100}>
              <Ionicons
                name="calendar-clear-outline"
                size={48}
                color={theme.colorPlaceholder.val}
              />
              <Text marginTop="$3" fontSize={16} color="$colorMuted">
                当天暂无日程
              </Text>
            </YStack>
          }
          renderItem={({ item }) => (
            <XStack
              backgroundColor="$cardBackground"
              borderRadius="$true"
              marginBottom="$2.5"
              overflow="hidden"
              shadowColor="$shadowColor"
              shadowOffset={{ width: 0, height: 1 }}
              shadowOpacity={1}
              shadowRadius={3}
              elevation={1}
              paddingRight="$3"
              pressStyle={item.type === 'meeting' ? { opacity: 0.7 } : undefined}
              onPress={() => handleEventPress(item)}
            >
              <YStack
                width={4}
                backgroundColor={item.type === 'meeting' ? '$primary' : '$accentSuccess'}
              />
              <YStack flex={1} padding="$3.5">
                <Text fontSize={15} fontWeight="500" color="$color" marginBottom="$1">
                  {item.title}
                </Text>
                {!item.all_day && (
                  <Text fontSize={13} color="$colorTertiary" marginBottom="$1.5">
                    {formatTime(item.start)} - {formatTime(item.end)}
                  </Text>
                )}
                <XStack alignItems="center" gap="$2">
                  <Badge>
                    <BadgeText>{item.type === 'meeting' ? '会议' : '任务'}</BadgeText>
                  </Badge>
                  {item.status && (
                    <Text fontSize={11} color="$colorTertiary">
                      {item.status}
                    </Text>
                  )}
                </XStack>
              </YStack>
              {item.type === 'meeting' && (
                <YStack alignSelf="center">
                  <Ionicons name="chevron-forward" size={16} color={theme.colorPlaceholder.val} />
                </YStack>
              )}
            </XStack>
          )}
        />
      )}

      <BottomPrimaryAction
        icon="download-outline"
        eyebrow="日历订阅"
        title={exporting ? '正在导出 ICS 订阅链接' : '导出 ICS 订阅链接'}
        actionLabel={exporting ? '处理中' : '导出'}
        bottomInset={insets.bottom}
        onPress={handleExportCalendar}
      />
    </YStack>
  )
}
