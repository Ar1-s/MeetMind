'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Pagination from '@mui/material/Pagination'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import AddIcon from '@mui/icons-material/Add'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import SearchIcon from '@mui/icons-material/Search'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { MeetingCard, CreateMeetingDialog, CreateFromImportDialog } from '@/components/meetings'
import ConfirmDialog from '@/components/ConfirmDialog'
import { getMeetings, createMeeting, deleteMeeting } from '@/libs/api'
import { useToastStore } from '@/libs/stores'
import type { MeetingListItem, MeetingCreate } from '@/interfaces'

export default function MeetingsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
  const softBorderStrong = isDark
    ? '1px solid rgba(255,255,255,0.16)'
    : '1px solid rgba(0,0,0,0.12)'
  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchRequestIdRef = useRef(0)
  const hasLoadedOnceRef = useRef(false)
  const nextFetchSilentRef = useRef(false)

  // Confirm Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteRelatedResources, setDeleteRelatedResources] = useState(false)

  const toastSuccess = useToastStore(state => state.success)
  const toastError = useToastStore(state => state.error)
  const toast = { success: toastSuccess, error: toastError }

  const fetchMeetings = useCallback(
    async (overridePage?: number, options?: { silent?: boolean }) => {
      const targetPage = overridePage ?? page
      const requestId = ++fetchRequestIdRef.current
      const shouldKeepContent = options?.silent && hasLoadedOnceRef.current
      if (!shouldKeepContent) {
        setLoading(true)
      }
      try {
        const res = await getMeetings({
          page: targetPage,
          limit: 12,
          search: search || undefined,
        })
        if (requestId !== fetchRequestIdRef.current) return
        setMeetings(res.meetings || [])
        setTotalPages(res.pagination?.total_pages || 1)
        hasLoadedOnceRef.current = true
      } catch (error) {
        if (requestId !== fetchRequestIdRef.current) return
        console.error('Failed to fetch meetings:', error)
        toast.error('获取会议列表失败')
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [page, search, toastError],
  )

  useEffect(() => {
    const useSilentRefresh = nextFetchSilentRef.current
    nextFetchSilentRef.current = false
    fetchMeetings(undefined, useSilentRefresh ? { silent: true } : undefined)
  }, [fetchMeetings])

  useEffect(() => {
    const refreshMeetings = () => {
      if (document.visibilityState !== 'hidden') {
        fetchMeetings(undefined, { silent: true })
      }
    }

    window.addEventListener('focus', refreshMeetings)
    window.addEventListener('pageshow', refreshMeetings)
    document.addEventListener('visibilitychange', refreshMeetings)

    return () => {
      window.removeEventListener('focus', refreshMeetings)
      window.removeEventListener('pageshow', refreshMeetings)
      document.removeEventListener('visibilitychange', refreshMeetings)
    }
  }, [fetchMeetings])

  const handleCreate = async (data: MeetingCreate) => {
    try {
      await createMeeting(data)
      toast.success('会议创建成功')
      if (page !== 1) {
        nextFetchSilentRef.current = true
        setPage(1)
      } else {
        await fetchMeetings(1, { silent: true })
      }
      setDialogOpen(false)
    } catch (error) {
      toast.error('创建会议失败')
    }
  }

  const handleImportSuccess = () => {
    setImportDialogOpen(false)
    if (page !== 1) {
      nextFetchSilentRef.current = true
      setPage(1)
      return
    }
    void fetchMeetings(1, { silent: true })
    return
    // 强制刷新到第一页，确保新会议可见
    setTimeout(() => {
      fetchMeetings(1, { silent: true })
    }, 300)
  }

  const handleDeleteRequest = (id: string) => {
    setDeletingId(id)
    setDeleteRelatedResources(false)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return
    const targetId = deletingId
    const nextPage = meetings.length === 1 && page > 1 ? page - 1 : page

    try {
      await deleteMeeting(targetId, { deleteRelated: deleteRelatedResources })
      if (nextPage === page) {
        setMeetings(prev => prev.filter(meeting => meeting.id !== targetId))
      }
      toast.success('会议已删除')
      if (nextPage !== page) {
        nextFetchSilentRef.current = true
        setPage(nextPage)
      } else {
        await fetchMeetings(nextPage, { silent: true })
      }
    } catch (error) {
      toast.error('删除会议失败')
    } finally {
      setConfirmOpen(false)
      setDeletingId(null)
      setDeleteRelatedResources(false)
    }
  }

  return (
    <Box
      sx={{
        bgcolor: { xs: 'background.default', sm: 'transparent' },
        px: { xs: 2, sm: 0 },
        py: { xs: 2, sm: 0 },
        fontFamily: {
          xs: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif',
          sm: 'inherit',
        },
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            会议列表
          </Typography>
          <Typography variant="body2" color="text.secondary">
            管理你的会议与录音
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={() => setImportDialogOpen(true)}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
              px: 2,
              bgcolor: { xs: 'background.paper', sm: 'transparent' },
              border: { xs: softBorder, sm: softBorderStrong },
              boxShadow: {
                xs: isDark ? '0 8px 16px rgba(0,0,0,0.5)' : '0 8px 16px rgba(0,0,0,0.06)',
                sm: 'none',
              },
            }}
          >
            导入录音
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              borderRadius: 999,
              px: 2.5,
              bgcolor: '#007AFF',
              boxShadow: '0 10px 20px rgba(0,122,255,0.3)',
              '&:hover': { bgcolor: '#0A84FF' },
            }}
          >
            新建会议
          </Button>
        </Box>
      </Box>

      <TextField
        placeholder="搜索会议..."
        size="small"
        fullWidth
        value={search}
        onChange={e => {
          const value = e.target.value
          setSearch(value)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            setPage(1)
          }, 300)
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          mb: 3,
          maxWidth: { sm: 360 },
          '& .MuiOutlinedInput-root': {
            borderRadius: 2.5,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            border: softBorder,
            '& fieldset': { border: 'none' },
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
            '&.Mui-focused': {
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.02)',
              border: softBorderStrong,
            },
          },
        }}
      />

      {loading ? (
        <Grid container spacing={isMobile ? 2 : 3}>
          {[...Array(6)].map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" height={isMobile ? 140 : 180} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : meetings.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            bgcolor: 'background.paper',
            borderRadius: 4,
            border: softBorder,
            boxShadow: isDark ? '0 12px 24px rgba(0,0,0,0.5)' : '0 12px 24px rgba(0,0,0,0.08)',
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无会议
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            点击「新建会议」开始记录
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{
              borderRadius: 999,
              px: 3,
              bgcolor: '#007AFF',
              '&:hover': { bgcolor: '#0A84FF' },
            }}
          >
            新建会议
          </Button>
        </Box>
      ) : (
        <>
          <Grid
            container
            spacing={isMobile ? 2 : 3}
            sx={{ width: '100%', mx: 0, overflowX: 'hidden' }}
          >
            {meetings.map(meeting => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={meeting.id} sx={{ minWidth: 0 }}>
                <MeetingCard meeting={meeting} onDelete={handleDeleteRequest} />
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, v) => setPage(v)}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      )}

      <CreateMeetingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />

      <CreateFromImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={handleImportSuccess}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="删除会议"
        contentNode={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              确定要删除这个会议吗？此操作不可恢复。
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteRelatedResources}
                  onChange={event => setDeleteRelatedResources(event.target.checked)}
                  color="error"
                />
              }
              label="同时删除该会议关联的任务与 OKR"
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
            <Typography variant="caption" color="text.secondary">
              不勾选时会保留任务与 OKR，但这些任务会解除与会议的回放绑定。
            </Typography>
            <Typography variant="caption" color="text.secondary">
              勾选后会删除该会议生成的相关任务；如果该 OKR 未被其他会议复用，也会一并删除。
            </Typography>
          </Box>
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setConfirmOpen(false)
          setDeletingId(null)
          setDeleteRelatedResources(false)
        }}
        confirmColor="error"
        confirmText="删除"
      />
    </Box>
  )
}
