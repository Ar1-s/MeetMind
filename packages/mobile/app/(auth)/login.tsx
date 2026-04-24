import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { Text, YStack } from 'tamagui'

import { AppButton, AppInput } from '@/components/ui'
import { authApi } from '@/libs/api'
import { useAuthStore } from '@/stores/auth'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.login({ username: username.trim(), password })
      await login(res.user, res.access_token)
    } catch (e: any) {
      Alert.alert('登录失败', e.message ?? '请检查用户名和密码后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} justifyContent="center" paddingHorizontal="$8" backgroundColor="$background">
        <Text fontSize={28} fontWeight="700" textAlign="center" marginBottom="$2" color="$color">
          MeetMind
        </Text>
        <Text fontSize={16} textAlign="center" color="$colorSecondary" marginBottom="$10">
          登录移动端，查看会议、任务和日历
        </Text>

        <AppInput
          placeholder="用户名"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          inputSize="lg"
          marginBottom="$4"
        />
        <AppInput
          placeholder="密码"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          inputSize="lg"
          marginBottom="$4"
        />

        <AppButton fullWidth disabled={loading} onPress={handleLogin} marginBottom="$5">
          {loading ? <ActivityIndicator color="#fff" /> : '登录'}
        </AppButton>

        <Link href="/(auth)/register" style={{ textAlign: 'center' }}>
          <Text fontSize={14} color="$primary">
            没有账号？去注册
          </Text>
        </Link>
      </YStack>
    </KeyboardAvoidingView>
  )
}
