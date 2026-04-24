import React from 'react'
import { YStack, Text, useTheme } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { AppButton } from './AppButton'

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name']
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme()

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$8" gap="$3">
      {icon && <Ionicons name={icon} size={48} color={theme.colorMuted.val} />}
      <Text fontSize={16} color="$colorTertiary" textAlign="center">
        {title}
      </Text>
      {subtitle && (
        <Text fontSize={14} color="$colorMuted" textAlign="center">
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <AppButton variant="outline" btnSize="sm" marginTop="$2" onPress={onAction}>
          {actionLabel}
        </AppButton>
      )}
    </YStack>
  )
}
