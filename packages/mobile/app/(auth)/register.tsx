import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { YStack, Text } from 'tamagui'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/libs/api'
import { AppButton, AppInput } from '@/components/ui'

export default function RegisterScreen() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('提示', '请填写必填项')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      })
      await login(res.user, res.access_token)
    } catch (e: any) {
      Alert.alert('注册失败', e.message ?? '请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack paddingHorizontal="$8" backgroundColor="$background">
          <Text
            fontSize={28}
            fontWeight="700"
            textAlign="center"
            marginBottom="$10"
            color="$color"
          >
            创建账户
          </Text>

          <AppInput
            placeholder="用户名 *"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            inputSize="lg"
            marginBottom="$4"
          />
          <AppInput
            placeholder="邮箱 *"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            inputSize="lg"
            marginBottom="$4"
          />
          <AppInput
            placeholder="密码 *"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            inputSize="lg"
            marginBottom="$4"
          />
          <AppInput
            placeholder="显示名称（可选）"
            value={displayName}
            onChangeText={setDisplayName}
            inputSize="lg"
            marginBottom="$4"
          />

          <AppButton
            fullWidth
            disabled={loading}
            onPress={handleRegister}
            marginBottom="$5"
          >
            {loading ? <ActivityIndicator color="#fff" /> : '注册'}
          </AppButton>

          <Link href="/(auth)/login" style={{ textAlign: 'center' }}>
            <Text fontSize={14} color="$primary">
              已有账户？立即登录
            </Text>
          </Link>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
