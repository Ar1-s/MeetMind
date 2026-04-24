import { ScrollView } from 'react-native'
import { Text, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'

export default function MeetingMemoryScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <YStack gap="$4">
        <Card>
          <Text fontSize={20} fontWeight="700" color="$color">
            会议记忆
          </Text>
          <Text marginTop="$3" color="$colorSecondary">
            当前移动端已恢复基础导航。会议记忆的完整编辑与管理建议暂时在 Web 端操作。
          </Text>
        </Card>
      </YStack>
    </ScrollView>
  )
}
