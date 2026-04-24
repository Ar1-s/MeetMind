import { styled, YStack } from 'tamagui'

export const Card = styled(YStack, {
  name: 'Card',
  backgroundColor: '$cardBackground',
  borderRadius: '$true',
  padding: '$4',
  shadowColor: '$shadowColor',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 1,
  shadowRadius: 4,
  elevation: 2,

  variants: {
    compact: {
      true: {
        padding: '$3',
      },
    },
    flat: {
      true: {
        shadowOpacity: 0,
        elevation: 0,
      },
    },
    pressable: {
      true: {
        pressStyle: {
          backgroundColor: '$backgroundHover',
          scale: 0.98,
        },
        animation: 'quick',
      },
    },
  } as const,
})
