import { styled, XStack, Text } from 'tamagui'

export const Badge = styled(XStack, {
  name: 'Badge',
  alignItems: 'center',
  gap: '$1',
  paddingHorizontal: '$2.5',
  paddingVertical: '$0.5',
  borderRadius: '$7',

  variants: {
    variant: {
      default: {
        backgroundColor: '$backgroundHover',
      },
      primary: {
        backgroundColor: '$primaryLight',
      },
      success: {
        backgroundColor: '$accentSuccessLight',
      },
      warning: {
        backgroundColor: '$accentWarningLight',
      },
      error: {
        backgroundColor: '$accentErrorLight',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
})

export const BadgeText = styled(Text, {
  name: 'BadgeText',
  fontSize: 11,
  fontWeight: '500',

  variants: {
    variant: {
      default: {
        color: '$colorSecondary',
      },
      primary: {
        color: '$primary',
      },
      success: {
        color: '$accentSuccess',
      },
      warning: {
        color: '$accentWarning',
      },
      error: {
        color: '$accentError',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
})
