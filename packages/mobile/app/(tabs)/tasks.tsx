import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native'
import { Text, useTheme, XStack, YStack } from 'tamagui'

import { Badge, BadgeText } from '@/components/ui'
import { Card } from '@/components/ui/Card'
import { tasksApi } from '@/libs/api'
import type { Task } from '@meetmind/shared'

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  blocked: '阻塞',
}

export default function TasksScreen() {
  const theme = useTheme()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTasks = useCallback(async () => {
    const data = await tasksApi.board()
    setTasks(data.tasks)
  }, [])

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false))
  }, [fetchTasks])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchTasks()
    } finally {
      setRefreshing(false)
    }
  }, [fetchTasks])

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.primary.val} />
      </YStack>
    )
  }

  return (
    <FlatList
      data={tasks}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      ListEmptyComponent={
        <YStack alignItems="center" paddingTop={96}>
          <Text color="$colorMuted">暂无任务</Text>
        </YStack>
      }
      renderItem={({ item }) => (
        <Card>
          <XStack justifyContent="space-between" alignItems="center" gap="$3">
            <Text flex={1} fontSize={16} fontWeight="600" color="$color">
              {item.title}
            </Text>
            <Badge>
              <BadgeText>{STATUS_LABELS[item.status]}</BadgeText>
            </Badge>
          </XStack>
          {item.description ? (
            <Text marginTop="$2" color="$colorSecondary">
              {item.description}
            </Text>
          ) : null}
          <XStack marginTop="$3" gap="$3" flexWrap="wrap">
            <Text fontSize={12} color="$colorTertiary">
              优先级 {item.priority}
            </Text>
            {item.assignee ? (
              <Text fontSize={12} color="$colorTertiary">
                负责人 {item.assignee}
              </Text>
            ) : null}
            {item.source_meeting?.title ? (
              <Text fontSize={12} color="$colorTertiary">
                来源 {item.source_meeting.title}
              </Text>
            ) : null}
          </XStack>
        </Card>
      )}
    />
  )
}
