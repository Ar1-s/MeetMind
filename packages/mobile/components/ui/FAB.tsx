import { styled, Button } from 'tamagui'

export const FAB = styled(Button, {
  name: 'FAB',
  position: 'absolute',
  bottom: '$6',
  right: '$6',
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: '$primary',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '$primary',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 6,
  borderWidth: 0,
  pressStyle: {
    scale: 0.92,
    opacity: 0.9,
  },
  animation: 'smooth',
})
