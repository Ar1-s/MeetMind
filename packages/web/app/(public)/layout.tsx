import ThemeRegistry from '@/components/ThemeRegistry'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <ThemeRegistry>{children}</ThemeRegistry>
}
