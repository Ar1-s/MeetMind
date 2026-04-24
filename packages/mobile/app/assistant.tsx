import { ScrollView } from 'react-native'
import { Text, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'

export default function AssistantScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <YStack gap="$4">
        <Card>
          <Text fontSize={20} fontWeight="700" color="$color">
            AI 助手
          </Text>
          <Text marginTop="$3" color="$colorSecondary">
            当前移动端已恢复基础访问能力。更复杂的助手交互可以后续继续补齐，但现在你已经可以正常启动 App、登录并查看基础数据。
          </Text>
        </Card>
      </YStack>
    </ScrollView>
  )
}
