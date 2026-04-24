import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack, Text, useTheme } from 'tamagui'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICON: Record<string, { focused: IoniconsName; unfocused: IoniconsName }> = {
  index: { focused: 'calendar', unfocused: 'calendar-outline' },
  tasks: { focused: 'checkbox', unfocused: 'checkbox-outline' },
  calendar: { focused: 'time', unfocused: 'time-outline' },
  settings: { focused: 'settings', unfocused: 'settings-outline' },
}

const TAB_LABEL: Record<string, string> = {
  index: '会议',
  tasks: '任务',
  calendar: '日历',
  settings: '设置',
}

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const bottomPadding = Math.max(insets.bottom, 6)
  const barHeight = 60 + Math.max(insets.bottom, 8)

  return (
    <XStack
      backgroundColor="$backgroundStrong"
      borderTopWidth={1}
      borderTopColor="$borderColorLight"
      height={barHeight}
      paddingTop="$2"
      paddingBottom={bottomPadding}
    >
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key]
        const isFocused = state.index === index
        const icons = TAB_ICON[route.name]
        const label =
          typeof descriptor.options.title === 'string'
            ? descriptor.options.title
            : TAB_LABEL[route.name] || route.name

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params)
          }
        }

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          })
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
            testID={descriptor.options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{ flex: 1 }}
          >
            <YStack flex={1} alignItems="center" justifyContent="center" paddingTop="$0.5">
              <Ionicons
                name={isFocused ? icons.focused : icons.unfocused}
                size={22}
                color={isFocused ? theme.primary.val : theme.colorMuted.val}
              />
              <Text
                marginTop="$1"
                fontSize={11}
                lineHeight={13}
                fontWeight={isFocused ? '600' : '500'}
                color={isFocused ? '$primary' : '$colorMuted'}
              >
                {label}
              </Text>
            </YStack>
          </Pressable>
        )
      })}
    </XStack>
  )
}
