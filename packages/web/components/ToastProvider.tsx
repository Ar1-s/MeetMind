'use client'

import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Slide from '@mui/material/Slide'
import { useToastStore } from '@/libs/stores'

export default function ToastProvider() {
  const { toasts, removeToast } = useToastStore()

  return (
    <>
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={toast.duration}
          onClose={() => removeToast(toast.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={Slide}
          sx={{ mt: index * 7 }}
        >
          <Alert
            onClose={() => removeToast(toast.id)}
            severity={toast.severity}
            variant="filled"
            sx={{ width: '100%', minWidth: 280 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  )
}
