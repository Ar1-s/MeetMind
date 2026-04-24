import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { AppButton } from './AppButton'

interface BottomPrimaryActionProps {
  icon: React.ComponentProps<typeof Ionicons>['name']
  eyebrow?: string
  title: string
  actionLabel: string
  onPress: () => void
  bottomInset?: number
  bottomOffset?: number
}

export function BottomPrimaryAction({
  icon,
  eyebrow = '快捷操作',
  title,
  actionLabel,
  onPress,
  bottomInset = 0,
  bottomOffset = 10,
}: BottomPrimaryActionProps) {
  const theme = useTheme()

  return (
    <YStack
      position="absolute"
      left={0}
      right={0}
      bottom={bottomInset + bottomOffset}
      zIndex={50}
      alignItems="center"
      pointerEvents="box-none"
      paddingHorizontal="$4"
    >
      <XStack
        width="100%"
        maxWidth={420}
        alignItems="center"
        gap="$3"
        backgroundColor="$backgroundStrong"
        borderWidth={1}
        borderColor="$borderColorLight"
        borderRadius={28}
        padding="$2"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 10 }}
        shadowOpacity={0.2}
        shadowRadius={20}
        elevation={10}
      >
        <YStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor="$primaryLight"
          alignItems="center"
          justifyContent="center"
          marginLeft="$1"
        >
          <Ionicons name={icon} size={20} color={theme.primary.val} />
        </YStack>

        <YStack flex={1} minWidth={0}>
          <Text fontSize={11} color="$colorMuted" numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text fontSize={14} fontWeight="700" color="$color" numberOfLines={1}>
            {title}
          </Text>
        </YStack>

        <AppButton
          pill
          btnSize="md"
          paddingHorizontal="$5"
          onPress={onPress}
          icon={<Ionicons name="add" size={18} color="#fff" />}
        >
          {actionLabel}
        </AppButton>
      </XStack>
    </YStack>
  )
}
