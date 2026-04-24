import ThemeRegistry from '@/components/ThemeRegistry'
import { MainLayout } from '@/components/layout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <MainLayout>{children}</MainLayout>
    </ThemeRegistry>
  )
}
