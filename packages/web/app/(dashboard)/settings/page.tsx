'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { getPreferences, updatePreferences } from '@/libs/api/preferences'
import { getCalendarSubscribeUrl } from '@/libs/api/integrations'
import type { UserPreferences } from '@/interfaces'

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [webcalUrl, setWebcalUrl] = useState<string | null>(null)
  const [smtpFields, setSmtpFields] = useState({
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_from: '',
  })

  useEffect(() => {
    getPreferences()
      .then((data) => {
        setPrefs(data)
        setSmtpFields({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port?.toString() || '',
          smtp_username: data.smtp_username || '',
          smtp_from: data.smtp_from || '',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = useCallback(
    (key: keyof UserPreferences) => async (checked: boolean) => {
      setPrefs((prev) => (prev ? { ...prev, [key]: checked } : prev))
      try {
        const updated = await updatePreferences({ [key]: checked })
        setPrefs(updated)
      } catch {
        setPrefs((prev) => (prev ? { ...prev, [key]: !checked } : prev))
      }
    },
    [],
  )

  const handleSmtpBlur = useCallback(
    async (key: 'smtp_host' | 'smtp_port' | 'smtp_username' | 'smtp_from') => {
      const value = smtpFields[key]
      const payload: Record<string, unknown> =
        key === 'smtp_port' ? { [key]: value ? parseInt(value, 10) : null } : { [key]: value || null }
      try {
        const updated = await updatePreferences(payload as any)
        setPrefs(updated)
      } catch {
        // ignore
      }
    },
    [smtpFields],
  )

  const handleConnectCalendar = useCallback(async () => {
    try {
      const { webcal_url } = await getCalendarSubscribeUrl()
      setWebcalUrl(webcal_url)
    } catch {
      // ignore
    }
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const emailConfigured = !!(prefs?.smtp_host && prefs?.smtp_username)

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        设置
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <List>
          <ListItem>
            <ListItemText primary="自动 AI 分析" secondary="录音完成后自动进行 AI 分析" />
            <ListItemSecondaryAction>
              <Switch
                checked={prefs?.auto_analysis ?? true}
                onChange={(_, checked) => handleToggle('auto_analysis')(checked)}
              />
            </ListItemSecondaryAction>
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText primary="自动提取任务" secondary="分析完成后自动提取任务到看板" />
            <ListItemSecondaryAction>
              <Switch
                checked={prefs?.auto_task_extract ?? true}
                onChange={(_, checked) => handleToggle('auto_task_extract')(checked)}
              />
            </ListItemSecondaryAction>
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText primary="高风险操作确认" secondary="发送邮件等操作需要二次确认" />
            <ListItemSecondaryAction>
              <Switch
                checked={prefs?.confirm_high_risk ?? true}
                onChange={(_, checked) => handleToggle('confirm_high_risk')(checked)}
              />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Paper>

      <Typography variant="h6" gutterBottom>
        外部服务集成
      </Typography>
      <Paper>
        <List>
          <ListItem>
            <ListItemText
              primary="Google Calendar"
              secondary={webcalUrl ? '已生成订阅链接' : '点击按钮生成日历订阅链接'}
            />
            <ListItemSecondaryAction>
              <Button size="small" variant="outlined" onClick={handleConnectCalendar}>
                {webcalUrl ? '刷新' : '获取链接'}
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
          {webcalUrl && (
            <ListItem>
              <ListItemText
                secondary={
                  <TextField
                    size="small"
                    fullWidth
                    value={webcalUrl}
                    slotProps={{ input: { readOnly: true } }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                }
              />
            </ListItem>
          )}
          <Divider />
          <ListItem>
            <ListItemText
              primary="邮件服务"
              secondary={emailConfigured ? '已配置' : '未配置 — 请在下方填写 SMTP 信息'}
            />
          </ListItem>
        </List>
      </Paper>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          SMTP 配置
        </Typography>
        {emailConfigured && (
          <Alert severity="success" sx={{ mb: 2 }}>
            SMTP 已配置，邮件功能可用。
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            size="small"
            label="SMTP_HOST"
            placeholder="smtp.example.com"
            value={smtpFields.smtp_host}
            onChange={(e) => setSmtpFields((p) => ({ ...p, smtp_host: e.target.value }))}
            onBlur={() => handleSmtpBlur('smtp_host')}
          />
          <TextField
            size="small"
            label="SMTP_PORT"
            placeholder="587"
            value={smtpFields.smtp_port}
            onChange={(e) => setSmtpFields((p) => ({ ...p, smtp_port: e.target.value }))}
            onBlur={() => handleSmtpBlur('smtp_port')}
          />
          <TextField
            size="small"
            label="SMTP_USERNAME"
            placeholder="user@example.com"
            value={smtpFields.smtp_username}
            onChange={(e) => setSmtpFields((p) => ({ ...p, smtp_username: e.target.value }))}
            onBlur={() => handleSmtpBlur('smtp_username')}
          />
          <TextField
            size="small"
            label="SMTP_PASSWORD"
            placeholder="******"
            type="password"
            helperText="密码仅通过环境变量配置，此处不保存"
            disabled
          />
          <TextField
            size="small"
            label="SMTP_FROM"
            placeholder="Meeting Copilot <user@example.com>"
            value={smtpFields.smtp_from}
            onChange={(e) => setSmtpFields((p) => ({ ...p, smtp_from: e.target.value }))}
            onBlur={() => handleSmtpBlur('smtp_from')}
          />
        </Box>
      </Paper>
    </Box>
  )
}
