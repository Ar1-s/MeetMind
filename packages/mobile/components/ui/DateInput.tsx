import React from 'react'
import { Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { XStack, YStack, Text, useTheme } from 'tamagui'
import { AppInput } from './AppInput'

type DateInputMode = 'date' | 'datetime'

interface DateInputProps {
  value: string
  onChangeText: (value: string) => void
  mode?: DateInputMode
  placeholder?: string
  helperText?: string
  autoFocus?: boolean
}

const DEFAULT_PLACEHOLDERS: Record<DateInputMode, string> = {
  date: 'YYYY-MM-DD',
  datetime: 'YYYY-MM-DD HH:MM',
}

const DEFAULT_HELPERS: Record<DateInputMode, string> = {
  date: '例如 2026-03-23',
  datetime: '例如 2026-03-23 14:30',
}

function normalizeDateValue(value: string, mode: DateInputMode) {
  const sanitized = value
    .replace(/\//g, '-')
    .replace(/[Tt]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(mode === 'date' ? /[^\d-]/g : /[^\d\-: ]/g, '')
    .trimStart()

  return sanitized.slice(0, mode === 'date' ? 10 : 16)
}

export function DateInput({
  value,
  onChangeText,
  mode = 'date',
  placeholder,
  helperText,
  autoFocus,
}: DateInputProps) {
  const theme = useTheme()

  return (
    <YStack gap="$1.5">
      <XStack
        alignItems="center"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$5"
        backgroundColor="$inputBackground"
        paddingLeft="$3.5"
        paddingRight="$3"
        focusStyle={{ borderColor: '$borderColorFocus' }}
      >
        <Ionicons name="calendar-outline" size={18} color={theme.colorSecondary.val} />
        <AppInput
          flex={1}
          borderWidth={0}
          backgroundColor="transparent"
          paddingLeft="$3"
          paddingRight={0}
          value={value}
          onChangeText={(nextValue: string) => onChangeText(normalizeDateValue(nextValue, mode))}
          placeholder={placeholder ?? DEFAULT_PLACEHOLDERS[mode]}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        />
      </XStack>
      <Text fontSize={12} color="$colorTertiary">
        {helperText ?? DEFAULT_HELPERS[mode]}
      </Text>
    </YStack>
  )
}
