'use client'

import { useEffect, useState } from 'react'
import { processRecordingQueue } from '@/libs/offline/recording-queue'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isProd = process.env.NODE_ENV === 'production'

    if ('serviceWorker' in navigator) {
      if (!isProd) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(reg => reg.unregister())
        })
        if ('caches' in window) {
          caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
        }
      } else {
        navigator.serviceWorker.register('/sw.js').catch(error => {
          console.error('Service worker registration failed:', error)
        })
      }
    }

    const handleOnline = () => {
      setOfflineOpen(false)
      processRecordingQueue().catch(error => {
        console.error('Failed to process recording queue:', error)
      })
    }

    const handleOffline = () => {
      setOfflineOpen(true)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setInstallOpen(true)
    }

    const handleAppInstalled = () => {
      setInstallEvent(null)
      setInstallOpen(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    if (navigator.onLine) {
      handleOnline()
    } else {
      handleOffline()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome !== 'accepted') {
      return
    }
    setInstallOpen(false)
    setInstallEvent(null)
  }

  return (
    <>
      <Snackbar
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={handleInstall}>
              瀹夎
            </Button>
          }
          sx={{ width: '100%' }}
        >
          瀹夎 MeetMind 鍒版闈紝鏀寔鏇寸ǔ瀹氱殑绂荤嚎璁块棶銆?        </Alert>
      </Snackbar>

      <Snackbar
        open={offlineOpen}
        onClose={() => setOfflineOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" sx={{ width: '100%' }}>
          褰撳墠澶勪簬绂荤嚎鐘舵€併€傜紦瀛橀〉闈㈠彲缁х画璁块棶锛屽綍闊充笂浼犱細杩涘叆闃熷垪绛夊緟鎭㈠缃戠粶銆?        </Alert>
      </Snackbar>
    </>
  )
}
