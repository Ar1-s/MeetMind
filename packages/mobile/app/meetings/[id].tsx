import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Text, useTheme, YStack } from 'tamagui'

import { AppButton } from '@/components/ui'
import { Card } from '@/components/ui/Card'
import { meetingsApi } from '@/libs/api'
import type { Meeting } from '@meetmind/shared'

export default function MeetingDetailScreen() {
  const router = useRouter()
  const theme = useTheme()
  const params = useLocalSearchParams<{ id?: string }>()
  const meetingId = Array.isArray(params.id) ? params.id[0] : params.id
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return
    const data = await meetingsApi.get(meetingId)
    setMeeting(data)
  }, [meetingId])

  useEffect(() => {
    fetchMeeting().finally(() => setLoading(false))
  }, [fetchMeeting])

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.primary.val} />
      </YStack>
    )
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            try {
              await fetchMeeting()
            } finally {
              setRefreshing(false)
            }
          }}
        />
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <YStack gap="$4">
        <Card>
          <Text fontSize={20} fontWeight="700" color="$color">
            {meeting?.title ?? '会议详情'}
          </Text>
          <Text marginTop="$3" color="$colorSecondary">
            开始时间：{meeting?.start_time ? new Date(meeting.start_time).toLocaleString('zh-CN') : '未设置'}
          </Text>
          <Text marginTop="$2" color="$colorSecondary">
            标签：{meeting?.tags?.length ? meeting.tags.join('、') : '无'}
          </Text>
          <Text marginTop="$2" color="$colorSecondary">
            参会人：{meeting?.participants?.length ?? 0}
          </Text>
        </Card>

        <Card>
          <Text fontSize={16} fontWeight="600" color="$color">
            移动端说明
          </Text>
          <Text marginTop="$3" color="$colorSecondary">
            纪要、记忆、思维导图和 PPT 等复杂功能建议继续在 Web 端使用。这里先保留基础详情和导航，保证移动端整体可运行。
          </Text>
        </Card>

        <AppButton variant="outline" onPress={() => router.push('/meetings/memory')}>
          打开会议记忆
        </AppButton>
      </YStack>
    </ScrollView>
  )
}
