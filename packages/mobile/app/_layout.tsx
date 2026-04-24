import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { TamaguiProvider, Theme } from 'tamagui'
import config from '../tamagui.config'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { authApi } from '@/libs/api'
import { storage } from '@/libs/storage'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { isAuthenticated, isLoading, login, setLoading } = useAuthStore()
  const { preference, loadPreference } = useThemeStore()
  const segments = useSegments()
  const router = useRouter()
  const systemScheme = useColorScheme()

  const resolvedTheme = preference === 'system' ? (systemScheme ?? 'light') : preference
  const navigationTheme = config.themes[resolvedTheme]

  // On mount: restore session and theme preference
  useEffect(() => {
    loadPreference()
    const restore = async () => {
      try {
        const token = await storage.getToken()
        if (token) {
          const user = await authApi.getCurrentUser()
          await login(user, token)
        }
      } catch {
        await storage.deleteToken()
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  // Auth guard: redirect based on auth state
  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)')
    }
    SplashScreen.hideAsync()
  }, [isAuthenticated, isLoading, segments])

  return (
    <TamaguiProvider config={config} defaultTheme={resolvedTheme}>
      <Theme name={resolvedTheme}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: navigationTheme.backgroundStrong.val },
            headerTintColor: navigationTheme.color.val,
            headerTitleStyle: { color: navigationTheme.color.val },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: navigationTheme.background.val },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="meetings/[id]"
            options={{ headerShown: true, title: '会议详情', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="meetings/memory"
            options={{ headerShown: true, title: '会议记忆', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="meetings/mindmap"
            options={{ headerShown: true, title: '思维导图', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="meetings/slides"
            options={{ headerShown: true, title: 'PPT 演示', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="projects"
            options={{ headerShown: true, title: '项目与 OKR', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="translate"
            options={{ headerShown: true, title: '翻译', headerBackTitle: '返回' }}
          />
          <Stack.Screen name="assistant" options={{ headerShown: false }} />
        </Stack>
      </Theme>
    </TamaguiProvider>
  )
}
