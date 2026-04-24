'use client'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import { useEffect, useState } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { request } from '@/libs/request'

interface Chat {
  id: string
  title: string
  updated_at: string
  agent_id?: string | null
}

interface ChatSidebarProps {
  activeChatId: string | null
  onSelectChat: (id: string | null) => void
  onNewChat?: () => void
  width?: number | string
  agents?: Array<{ id: string; name: string }>
  refreshKey?: string | number
}

export default function ChatSidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  width = 280,
  agents = [],
  refreshKey,
}: ChatSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chatToDelete, setChatToDelete] = useState<string | null>(null)
  const api = request()
  const agentMap = new Map(agents.map(agent => [agent.id, agent.name]))

  const fetchChats = async () => {
    try {
      const data = await api.get<Chat[]>('/v1/chats')
      setChats(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchChats()
  }, [activeChatId, refreshKey])

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setChatToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return

    try {
      await api.delete(`/v1/chats/${chatToDelete}`)
      setChats(prev => prev.filter(c => c.id !== chatToDelete))
      if (activeChatId === chatToDelete) {
        onSelectChat(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteDialogOpen(false)
      setChatToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setChatToDelete(null)
  }

  return (
    <Paper
      sx={{
        width,
        minWidth: width,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: { xs: 0, sm: 1 },
        borderColor: 'divider',
        borderRadius: 0,
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(255,255,255,0.2)',
              }}
            >
              <AddIcon fontSize="small" />
            </Box>
          }
          onClick={() => onNewChat?.()}
          sx={{
            justifyContent: 'flex-start',
            gap: 1,
            borderRadius: 3,
            py: 1.2,
            textTransform: 'none',
          }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              新对话
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              开始新的问题或任务
            </Typography>
          </Box>
        </Button>
      </Box>
      <List sx={{ flexGrow: 1, overflow: 'auto' }}>
        {chats.map(chat => (
          <ListItem
            key={chat.id}
            disablePadding
            secondaryAction={
              <IconButton edge="end" size="small" onClick={e => handleDeleteClick(e, chat.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemButton
              selected={activeChatId === chat.id}
              onClick={() => onSelectChat(chat.id)}
            >
              <ChatBubbleOutlineIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText
                primary={chat.title || '新对话'}
                primaryTypographyProps={{ noWrap: true, fontSize: 14 }}
                secondary={`${agentMap.get(chat.agent_id || 'default') || '默认助手'} · ${new Date(
                  chat.updated_at,
                ).toLocaleDateString()}`}
                secondaryTypographyProps={{ fontSize: 11 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {chats.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">暂无历史记录</Typography>
          </Box>
        )}
      </List>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除对话"
        content="确定要删除这个对话吗？此操作无法撤销。"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmColor="error"
        confirmText="删除"
      />
    </Paper>
  )
}
