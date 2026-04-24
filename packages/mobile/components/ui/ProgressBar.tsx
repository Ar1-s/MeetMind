import React from 'react'
import { XStack, YStack } from 'tamagui'

interface ProgressBarProps {
  progress: number // 0-100
  color?: string
  height?: number
}

export function ProgressBar({ progress, color, height = 6 }: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <XStack
      height={height}
      backgroundColor="$backgroundHover"
      borderRadius="$1"
      overflow="hidden"
    >
      <YStack
        height="100%"
        backgroundColor={color ?? '$primary'}
        borderRadius="$1"
        width={`${clampedProgress}%`}
        animation="smooth"
      />
    </XStack>
  )
}
