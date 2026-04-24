import { styled, YStack, Text } from 'tamagui'

export const Section = styled(YStack, {
  name: 'Section',
  backgroundColor: '$cardBackground',
  borderRadius: '$true',
  marginBottom: '$3',
  overflow: 'hidden',
})

export const SectionTitle = styled(Text, {
  name: 'SectionTitle',
  fontSize: 15,
  fontWeight: '600',
  color: '$color',
  marginBottom: '$3',
})

export const SectionLabel = styled(Text, {
  name: 'SectionLabel',
  fontSize: 12,
  fontWeight: '600',
  color: '$colorTertiary',
  paddingHorizontal: '$4',
  paddingTop: '$3',
  paddingBottom: '$1',
  textTransform: 'uppercase',
})
