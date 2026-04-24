import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Text, useTheme, XStack, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'
import { meetingsApi } from '@/libs/api'
import type { MeetingListItem } from '@meetmind/shared'

export default function MeetingsScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchMeetings = useCallback(async () => {
    const data = await meetingsApi.list({ page: 1, limit: 50 })
    setMeetings(data.meetings)
  }, [])

  useEffect(() => {
    fetchMeetings().finally(() => setLoading(false))
  }, [fetchMeetings])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchMeetings()
    } finally {
      setRefreshing(false)
    }
  }, [fetchMeetings])

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.primary.val} />
      </YStack>
    )
  }

  return (
    <FlatList
      data={meetings}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      ListEmptyComponent={
        <YStack alignItems="center" paddingTop={96}>
          <Ionicons name="videocam-outline" size={48} color={theme.colorPlaceholder.val} />
          <Text marginTop="$3" color="$colorMuted">
            暂无会议
          </Text>
        </YStack>
      }
      renderItem={({ item }) => (
        <Card pressable onPress={() => router.push(`/meetings/${item.id}`)}>
          <Text fontSize={16} fontWeight="600" color="$color">
            {item.title}
          </Text>
          <Text marginTop="$2" color="$colorSecondary">
            {item.start_time ? new Date(item.start_time).toLocaleString('zh-CN') : '未设置时间'}
          </Text>
          <XStack marginTop="$3" gap="$3" alignItems="center">
            <Text fontSize={12} color="$colorTertiary">
              参与人 {item.participants_count}
            </Text>
            <Text fontSize={12} color="$colorTertiary">
              录音 {item.has_recording ? '有' : '无'}
            </Text>
            <Text fontSize={12} color="$colorTertiary">
              纪要 {item.has_summary ? '有' : '无'}
            </Text>
          </XStack>
        </Card>
      )}
    />
  )
}
