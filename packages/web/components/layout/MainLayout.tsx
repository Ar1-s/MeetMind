'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import List from '@mui/material/List'
import Typography from '@mui/material/Typography'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import Badge from '@mui/material/Badge'
import MenuIcon from '@mui/icons-material/Menu'
import VideoCallIcon from '@mui/icons-material/VideoCall'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ChatIcon from '@mui/icons-material/Chat'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloseIcon from '@mui/icons-material/Close'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import GTranslateIcon from '@mui/icons-material/GTranslate'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useAuthStore } from '@/libs/stores'
import { getTaskBoard } from '@/libs/api'
import { useThemeMode } from '@/components/ThemeRegistry'

const DRAWER_WIDTH = 260

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: '会议列表', href: '/meetings', icon: <VideoCallIcon /> },
  { label: '任务看板', href: '/tasks', icon: <AssignmentIcon /> },
  { label: '项目/OKR', href: '/projects', icon: <FlagOutlinedIcon /> },
  { label: '日程日历', href: '/calendar', icon: <CalendarMonthIcon /> },
  { label: '同声传译', href: '/translate', icon: <GTranslateIcon /> },
  { label: '对话助手', href: '/assistant', icon: <ChatIcon /> },
  { label: '设置', href: '/settings', icon: <SettingsIcon /> },
]

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notifyAnchorEl, setNotifyAnchorEl] = useState<null | HTMLElement>(null)
  const [notifications, setNotifications] = useState<
    Array<{
      id: string
      title: string
      subtitle?: string
      dueLabel?: string
      href?: string
    }>
  >([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])

  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { mode, toggle } = useThemeMode()

  const open = Boolean(anchorEl)
  const notifyOpen = Boolean(notifyAnchorEl)

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleOpenNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setNotifyAnchorEl(event.currentTarget)
  }

  const notificationStorageKey = useMemo(
    () => `notify_read_${user?.user_id || 'guest'}`,
    [user?.user_id],
  )

  const handleCloseNotifications = () => {
    const currentIds = notifications.map(item => item.id)
    const nextIds = Array.from(new Set([...readNotificationIds, ...currentIds]))
    setReadNotificationIds(nextIds)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(nextIds))
    }
    setNotifyAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    logout()
    router.push('/login')
  }

  const formatDueLabel = (dueDate: string) => {
    const due = new Date(dueDate)
    if (Number.isNaN(due.getTime())) return undefined
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
    const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000)
    if (diffDays < 0) return '已逾期'
    if (diffDays === 0) return '今天到期'
    if (diffDays === 1) return '明天到期'
    if (diffDays <= 3) return `${diffDays} 天后到期`
    return due.toLocaleDateString('zh-CN')
  }

  useEffect(() => {
    let active = true
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(notificationStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) setReadNotificationIds(parsed)
        }
      } catch {
        setReadNotificationIds([])
      }
    }
    const loadNotifications = async () => {
      setNotificationsLoading(true)
      try {
        const res = await getTaskBoard()
        const tasks = res.tasks || []
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const items = tasks
          .filter(task => task.status !== 'done' && task.due_date)
          .map(task => {
            const due = new Date(task.due_date || '')
            if (Number.isNaN(due.getTime())) return null
            const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
            const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000)
            if (diffDays > 7) return null
            const dueLabel = formatDueLabel(task.due_date || '')
            return {
              id: task.id,
              title: diffDays < 0 ? `任务已逾期 · ${task.title}` : `任务即将到期 · ${task.title}`,
              subtitle: task.assignee ? `负责人：${task.assignee}` : task.source_meeting?.title,
              dueLabel,
              dueTime: startOfDue.getTime(),
              href: task.source_meeting?.meeting_id
                ? `/meetings/${task.source_meeting.meeting_id}`
                : `/tasks?highlight=${task.id}`,
            }
          })
          .filter(Boolean) as Array<{
          id: string
          title: string
          subtitle?: string
          dueLabel?: string
          dueTime: number
          href?: string
        }>
        const ordered = items.sort((a, b) => a.dueTime - b.dueTime)
        if (active) {
          setNotifications(ordered.slice(0, 6))
        }
      } catch (error) {
        if (active) setNotifications([])
      } finally {
        if (active) setNotificationsLoading(false)
      }
    }
    loadNotifications()
    return () => {
      active = false
    }
  }, [notificationStorageKey])

  const readIdSet = useMemo(() => new Set(readNotificationIds), [readNotificationIds])
  const unreadIds = useMemo(
    () => notifications.filter(item => !readIdSet.has(item.id)).map(item => item.id),
    [notifications, readIdSet],
  )
  const notificationCount = unreadIds.length

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            MeetMind
          </Typography>
          <Tooltip title="站内提醒">
            <IconButton onClick={handleOpenNotifications} size="small" sx={{ ml: 1 }}>
              <Badge
                color="error"
                badgeContent={notifyOpen ? 0 : notificationCount}
                max={9}
                invisible={notifyOpen || notificationCount === 0}
              >
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'dark' ? '切换明亮模式' : '切换黑暗模式'}>
            <IconButton onClick={toggle} size="small" sx={{ ml: 1 }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={notifyAnchorEl}
            open={notifyOpen}
            onClose={handleCloseNotifications}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                sx: {
                  minWidth: 280,
                  maxWidth: 360,
                  p: 0,
                  borderRadius: 2,
                  overflow: 'hidden',
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                站内提醒
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {notificationsLoading ? '更新中...' : notificationCount ? `${notificationCount} 条提醒` : '暂无提醒'}
              </Typography>
            </Box>
            {notificationsLoading ? (
              <Box sx={{ px: 2, py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  正在加载提醒...
                </Typography>
              </Box>
            ) : notifications.length === 0 ? (
              <Box sx={{ px: 2, py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  目前没有新的提醒
                </Typography>
              </Box>
            ) : (
              notifications.map(item => {
                const unread = unreadIds.includes(item.id)
                return (
                <MenuItem
                  key={item.id}
                  onClick={() => {
                    handleCloseNotifications()
                    if (item.href) router.push(item.href)
                  }}
                  sx={{
                    alignItems: 'flex-start',
                    whiteSpace: 'normal',
                    py: 1.25,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: unread ? 'error.main' : 'transparent',
                      mt: 0.75,
                      mr: 1.25,
                      flexShrink: 0,
                      boxShadow: unread ? '0 0 0 3px rgba(255,59,48,0.15)' : 'none',
                    }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.title}
                    </Typography>
                    {item.subtitle && (
                      <Typography variant="caption" color="text.secondary">
                        {item.subtitle}
                      </Typography>
                    )}
                    {item.dueLabel && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {item.dueLabel}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
                )
              })
            )}
            <Divider />
            <MenuItem
              onClick={() => {
                handleCloseNotifications()
                router.push('/tasks')
              }}
            >
              查看全部任务
            </MenuItem>
          </Menu>

          <Tooltip title="个人中心">
            <IconButton
              onClick={handleMenuClick}
              size="small"
              sx={{ ml: 2 }}
              aria-controls={open ? 'account-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
            >
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
                src={user?.avatar_url}
              >
                {user?.display_name?.charAt(0).toUpperCase() ||
                  user?.username?.charAt(0).toUpperCase() ||
                  'U'}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            id="account-menu"
            open={open}
            onClose={handleClose}
            onClick={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  minWidth: 180,
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    ml: -0.5,
                    mr: 1,
                  },
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" noWrap>
                {user?.display_name || user?.username}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ fontSize: '0.75rem' }}
              >
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                handleClose()
                router.push('/settings')
              }}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              设置
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        anchor={isMobile ? 'bottom' : 'left'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        BackdropProps={{ invisible: true }}
        sx={{
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: isMobile ? '100%' : DRAWER_WIDTH,
            height: isMobile ? '45vh' : '100%',
            boxSizing: 'border-box',
            borderTopLeftRadius: isMobile ? 16 : 0,
            borderTopRightRadius: isMobile ? 16 : 0,
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1">导航</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <List
          sx={{
            display: { xs: 'grid', sm: 'block' },
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
            gap: { xs: 1, sm: 0 },
            px: { xs: 2, sm: 0 },
          }}
        >
          {navItems.map(item => (
            <ListItem key={item.href} disablePadding sx={{ width: '100%' }}>
              <ListItemButton
                component={Link}
                href={item.href}
                onClick={() => {
                  setDrawerOpen(false)
                }}
                selected={pathname?.startsWith(item.href)}
                sx={{
                  minHeight: 48,
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 2,
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          mt: { xs: 7, sm: 8 },
          bgcolor: 'background.default',
          minHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' }, // Fill viewport minus AppBar
        }}
      >
        {children}

        {/* 录音按钮已下沉到 meetings 路由布局 */}
      </Box>
    </Box>
  )
}
