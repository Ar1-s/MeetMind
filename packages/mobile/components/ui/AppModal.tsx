import React, { type ComponentProps } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { Sheet, Theme, useThemeName } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack, Text, useTheme } from 'tamagui'

interface AppModalProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  subtitle?: string
  variant?: 'sheet' | 'page'
  size?: number
  scrollable?: boolean
  contentContainerStyle?: ComponentProps<typeof Sheet.ScrollView>['contentContainerStyle']
  footer?: React.ReactNode
  keyboardAvoiding?: boolean
  keyboardVerticalOffset?: number
  dismissOnBackdropPress?: boolean
  backdropColor?: string
}

export function AppModal({
  visible,
  onClose,
  children,
  title,
  subtitle,
  variant = 'sheet',
  size,
  scrollable = false,
  contentContainerStyle,
  footer,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  dismissOnBackdropPress = true,
  backdropColor = 'rgba(0,0,0,0.4)',
}: AppModalProps) {
  const themeName = useThemeName()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const fullscreen = variant === 'page'
  const snapPoint = size ?? (fullscreen ? 100 : 88)
  const showHandle = !fullscreen
  const headerPaddingTop = fullscreen ? Math.max(insets.top, 16) : 12

  const bodyNode = scrollable ? (
    <Sheet.ScrollView
      flex={1}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </Sheet.ScrollView>
  ) : (
    children
  )

  const contentNode = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {bodyNode}
    </KeyboardAvoidingView>
  ) : (
    bodyNode
  )

  return (
    <Sheet
      modal
      open={visible}
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
      snapPoints={[snapPoint]}
      snapPointsMode="percent"
      dismissOnSnapToBottom={!fullscreen}
      dismissOnOverlayPress={dismissOnBackdropPress}
      animation="quick"
      moveOnKeyboardChange={keyboardAvoiding}
      disableDrag={fullscreen}
    >
      <Theme name={themeName}>
        <Sheet.Overlay
          backgroundColor={backdropColor}
          animation="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          onPress={dismissOnBackdropPress ? onClose : undefined}
        />
        {showHandle ? <Sheet.Handle /> : null}
        <Sheet.Frame
          flex={fullscreen ? 1 : undefined}
          backgroundColor="$cardBackground"
          borderTopLeftRadius={fullscreen ? 0 : 20}
          borderTopRightRadius={fullscreen ? 0 : 20}
          overflow="hidden"
        >
          {title ? (
            <XStack
              justifyContent="space-between"
              alignItems="center"
              paddingHorizontal="$5"
              paddingTop={headerPaddingTop}
              paddingBottom="$3"
              borderBottomWidth={0.5}
              borderBottomColor="$borderColorLight"
            >
              <YStack flex={1} marginRight="$3">
                <Text fontSize={17} fontWeight="600" color="$color" numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text fontSize={12} color="$colorTertiary" marginTop="$0.5" numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </YStack>
              <YStack pressStyle={{ opacity: 0.7 }} onPress={onClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={fullscreen ? theme.color.val : theme.colorSecondary.val}
                />
              </YStack>
            </XStack>
          ) : null}
          <YStack flex={1} minHeight={0}>
            {contentNode}
          </YStack>
          {footer ? (
            <YStack
              backgroundColor="$cardBackground"
              borderTopWidth={0.5}
              borderTopColor="$borderColorLight"
              paddingHorizontal="$5"
              paddingTop="$3"
              paddingBottom={fullscreen ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 12)}
            >
              {footer}
            </YStack>
          ) : null}
        </Sheet.Frame>
      </Theme>
    </Sheet>
  )
}
