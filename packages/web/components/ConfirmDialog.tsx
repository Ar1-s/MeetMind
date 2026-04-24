import type { ReactNode } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

interface ConfirmDialogProps {
  open: boolean
  title: string
  content?: string
  contentNode?: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
}

export default function ConfirmDialog({
  open,
  title,
  content,
  contentNode,
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
  confirmColor = 'primary',
}: ConfirmDialogProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      fullScreen={isMobile}
      scroll="paper"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {contentNode ? (
          contentNode
        ) : (
          <DialogContentText id="confirm-dialog-description">{content}</DialogContentText>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          pb: 2,
          ...(isMobile
            ? {
                position: 'sticky',
                bottom: 0,
                bgcolor: 'background.paper',
                zIndex: 1,
              }
            : {}),
          '& .MuiButton-root': {
            width: { xs: '100%', sm: 'auto' },
            borderRadius: 999,
          },
        }}
      >
        <Button onClick={onCancel} color="inherit">
          {cancelText}
        </Button>
        <Button onClick={onConfirm} color={confirmColor} autoFocus>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
