'use client'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  assignee?: string
}

export default function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks || tasks.length === 0) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1, width: '100%' }}>
      {tasks.map(t => (
        <Paper
          key={t.id}
          sx={{
            p: 1.5,
            borderLeft: 3,
            borderColor: t.status === 'done' ? 'success.main' : 'warning.main',
          }}
        >
          <Typography variant="subtitle2">{t.title}</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={t.status}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.6rem' }}
            />
            <Chip
              label={t.priority}
              size="small"
              color={t.priority === 'high' ? 'error' : 'default'}
              sx={{ height: 20, fontSize: '0.6rem' }}
            />
            {t.assignee && (
              <Typography variant="caption" color="text.secondary">
                @{t.assignee}
              </Typography>
            )}
          </Box>
        </Paper>
      ))}
    </Box>
  )
}
