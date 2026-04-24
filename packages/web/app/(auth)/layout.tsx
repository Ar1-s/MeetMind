import ThemeRegistry from '@/components/ThemeRegistry'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ThemeRegistry>{children}</ThemeRegistry>
}
