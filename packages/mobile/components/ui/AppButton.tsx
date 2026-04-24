import { styled, Button } from 'tamagui'

export const AppButton = styled(Button, {
  name: 'AppButton',
  backgroundColor: '$primary',
  borderRadius: '$5',
  paddingVertical: '$3',
  paddingHorizontal: '$4',
  justifyContent: 'center',
  alignItems: 'center',
  color: '#ffffff',
  fontWeight: '600',
  fontSize: 16,
  borderWidth: 0,
  pressStyle: {
    opacity: 0.85,
    scale: 0.98,
  },
  animation: 'quick',

  variants: {
    variant: {
      primary: {
        backgroundColor: '$primary',
        color: '#ffffff',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$primary',
        color: '$primary',
      },
      ghost: {
        backgroundColor: '$primaryLight',
        color: '$primary',
      },
      danger: {
        backgroundColor: '$accentError',
        color: '#ffffff',
      },
      dangerOutline: {
        backgroundColor: '$accentErrorLight',
        borderWidth: 1,
        borderColor: '$accentErrorBorder',
        color: '$accentError',
      },
      success: {
        backgroundColor: '$accentSuccess',
        color: '#ffffff',
      },
      secondary: {
        backgroundColor: '$backgroundHover',
        color: '$colorSecondary',
      },
    },

    btnSize: {
      sm: {
        minHeight: 36,
        paddingVertical: '$2',
        paddingHorizontal: '$3',
        fontSize: 13,
        borderRadius: '$4',
      },
      md: {
        minHeight: 48,
        paddingVertical: '$3',
        paddingHorizontal: '$4',
        fontSize: 16,
      },
      lg: {
        minHeight: 52,
        paddingVertical: '$3.5',
        paddingHorizontal: '$6',
        fontSize: 17,
      },
    },

    pill: {
      true: {
        borderRadius: '$8',
      },
    },

    fullWidth: {
      true: {
        width: '100%',
      },
    },

    disabled: {
      true: {
        opacity: 0.6,
        pointerEvents: 'none',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'primary',
    btnSize: 'md',
  },
})
