import { Tabs } from 'expo-router'
import { useTheme } from 'tamagui'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'

import { AppTabBar } from '@/components/navigation/AppTabBar'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <AppTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.backgroundStrong.val },
        headerTintColor: theme.color.val,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '会议' }} />
      <Tabs.Screen name="tasks" options={{ title: '任务' }} />
      <Tabs.Screen name="calendar" options={{ title: '日历' }} />
      <Tabs.Screen name="settings" options={{ title: '设置' }} />
    </Tabs>
  )
}
