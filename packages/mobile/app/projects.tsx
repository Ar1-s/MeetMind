import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { Text, useTheme, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'
import { projectsApi } from '@/libs/api'
import type { Project } from '@meetmind/shared'

export default function ProjectsScreen() {
  const theme = useTheme()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchProjects = useCallback(async () => {
    const data = await projectsApi.list()
    setProjects(data)
  }, [])

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false))
  }, [fetchProjects])

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
              await fetchProjects()
            } finally {
              setRefreshing(false)
            }
          }}
        />
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <YStack gap="$4">
        {projects.length === 0 ? (
          <Card>
            <Text color="$colorMuted">暂无项目或 OKR</Text>
          </Card>
        ) : (
          projects.map(project => (
            <Card key={project.id}>
              <Text fontSize={18} fontWeight="700" color="$color">
                {project.name}
              </Text>
              {project.description ? (
                <Text marginTop="$2" color="$colorSecondary">
                  {project.description}
                </Text>
              ) : null}
              <Text marginTop="$3" color="$colorTertiary">
                进度：{project.progress}%
              </Text>
              <Text marginTop="$1" color="$colorTertiary">
                Objective 数：{project.objectives.length}
              </Text>
            </Card>
          ))
        )}
      </YStack>
    </ScrollView>
  )
}
