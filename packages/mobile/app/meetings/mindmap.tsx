import { useEffect, useState, useCallback } from 'react'
import { ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { mindmapApi } from '@/libs/api'
import { AppButton } from '@/components/ui'
import type { MindmapData, MindmapNode } from '@meetmind/shared'

interface TreeNode extends MindmapNode {
  children: TreeNode[]
}

function buildTree(nodes: MindmapNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] })
  }
  for (const n of nodes) {
    const treeNode = map.get(n.id)!
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(treeNode)
    } else {
      roots.push(treeNode)
    }
  }
  return roots
}

function MindmapTreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const theme = useTheme()
  const nodeColor =
    node.type === 'topic'
      ? theme.primary.val
      : node.type === 'subtopic'
        ? theme.accentWarning.val
        : theme.colorTertiary.val

  return (
    <YStack marginLeft={depth * 16}>
      <XStack
        alignItems="center"
        gap="$1.5"
        paddingVertical="$1.5"
        pressStyle={{ opacity: 0.7 }}
        onPress={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={theme.colorTertiary.val}
          />
        ) : (
          <YStack
            width={6}
            height={6}
            borderRadius={3}
            backgroundColor={nodeColor}
          />
        )}
        <Text
          flex={1}
          fontSize={depth === 0 ? 16 : 14}
          fontWeight={depth === 0 ? '700' : '400'}
          color={depth === 0 ? '$color' : '$colorSecondary'}
        >
          {node.label}
        </Text>
      </XStack>
      {node.description ? (
        <Text
          fontSize={12}
          color="$colorTertiary"
          marginBottom="$1"
          marginLeft={depth * 16 + 20}
        >
          {node.description}
        </Text>
      ) : null}
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <MindmapTreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </YStack>
  )
}

export default function MeetingMindmapScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>()
  const theme = useTheme()
  const [mindmap, setMindmap] = useState<MindmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadMindmap = useCallback(async () => {
    try {
      const data = await mindmapApi.generate(meetingId)
      if (data && data.nodes && data.nodes.length > 0) {
        setMindmap(data)
      }
    } catch {
      // might not exist yet
    }
  }, [meetingId])

  useEffect(() => {
    loadMindmap().finally(() => setLoading(false))
  }, [loadMindmap])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadMindmap()
    setRefreshing(false)
  }, [loadMindmap])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const data = await mindmapApi.generate(meetingId)
      setMindmap(data)
    } catch (e: any) {
      Alert.alert('鐢熸垚澶辫触', e.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.primary.val} />
      </YStack>
    )
  }

  if (!mindmap || !mindmap.nodes || mindmap.nodes.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background" gap="$3">
        <Ionicons name="git-network-outline" size={48} color={theme.colorPlaceholder.val} />
        <Text fontSize={15} color="$colorMuted">
          鏆傛棤鎬濈淮瀵煎浘
        </Text>
        <AppButton
          size="sm"
          disabled={generating}
          onPress={handleGenerate}
        >
          {generating ? <ActivityIndicator size="small" color="#fff" /> : '鐢熸垚鎬濈淮瀵煎浘'}
        </AppButton>
      </YStack>
    )
  }

  const tree = buildTree(mindmap.nodes)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {tree.map((node) => (
        <MindmapTreeNode key={node.id} node={node} />
      ))}
    </ScrollView>
  )
}
