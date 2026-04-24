import { ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { Text, YStack } from 'tamagui'

import { AppButton } from '@/components/ui'
import { API_BASE_URL } from '@/libs/api'
import { useAuthStore } from '@/stores/auth'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, logout } = useAuthStore()

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <YStack gap="$4">
        <YStack backgroundColor="$cardBackground" borderRadius="$true" padding="$4">
          <Text fontSize={18} fontWeight="700" color="$color">
            账号
          </Text>
          <Text marginTop="$3" color="$colorSecondary">
            用户名：{user?.username ?? '未登录'}
          </Text>
          <Text marginTop="$2" color="$colorSecondary">
            邮箱：{user?.email ?? '未设置'}
          </Text>
        </YStack>

        <YStack backgroundColor="$cardBackground" borderRadius="$true" padding="$4">
          <Text fontSize={18} fontWeight="700" color="$color">
            连接信息
          </Text>
          <Text marginTop="$3" color="$colorSecondary">
            API：{API_BASE_URL}
          </Text>
        </YStack>

        <YStack gap="$3">
          <AppButton variant="outline" onPress={() => router.push('/assistant')}>
            移动端助手
          </AppButton>
          <AppButton variant="outline" onPress={() => router.push('/projects')}>
            项目与 OKR
          </AppButton>
          <AppButton
            variant="danger"
            onPress={async () => {
              await logout()
              router.replace('/(auth)/login')
            }}
          >
            退出登录
          </AppButton>
        </YStack>
      </YStack>
    </ScrollView>
  )
}
