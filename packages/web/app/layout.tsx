import type { Metadata } from 'next'
import '@/public/globals.css'
import ThemeRegistry from '@/components/ThemeRegistry'
import { MainLayout } from '@/components/layout'
import PwaProvider from '@/components/PwaProvider'

export const metadata: Metadata = {
  title: 'MeetMind',
  description: 'MeetMind - 智能会议协作平台',
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#1f2937',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning className="antialiased">
        <PwaProvider />
        {children}
      </body>
    </html>
  )
}
