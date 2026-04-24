import { styled, Input } from 'tamagui'

export const AppInput = styled(Input, {
  name: 'AppInput',
  backgroundColor: '$inputBackground',
  borderWidth: 1,
  borderColor: '$borderColor',
  borderRadius: '$5',
  paddingHorizontal: 14,
  height: 48,
  fontSize: 15,
  color: '$color',
  placeholderTextColor: '$colorPlaceholder',
  focusStyle: {
    borderColor: '$borderColorFocus',
  },

  variants: {
    inputSize: {
      sm: {
        height: 40,
        fontSize: 14,
      },
      md: {
        height: 48,
        fontSize: 15,
      },
      lg: {
        height: 52,
        fontSize: 16,
      },
    },
  } as const,

  defaultVariants: {
    inputSize: 'md',
  },
})
