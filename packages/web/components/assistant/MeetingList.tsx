'use client'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Link from 'next/link'

interface Meeting {
  id: string
  title: string
  date: string
  status?: string
}

export default function MeetingList({ meetings }: { meetings: Meeting[] }) {
  if (!meetings || meetings.length === 0) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1, width: '100%' }}>
      {meetings.map(m => (
        <Link key={m.id} href={`/meetings/${m.id}`} style={{ textDecoration: 'none' }}>
          <Paper sx={{ p: 1.5, '&:hover': { bgcolor: 'action.hover' } }}>
            <Typography variant="subtitle2" color="primary">
              {m.title}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                mt: 0.5,
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {m.date ? new Date(m.date).toLocaleString() : 'No Date'}
              </Typography>
              {m.status && (
                <Chip label={m.status} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
            </Box>
          </Paper>
        </Link>
      ))}
    </Box>
  )
}
