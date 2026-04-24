'use client'

import Link from 'next/link'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import MicIcon from '@mui/icons-material/Mic'
import SummarizeIcon from '@mui/icons-material/Summarize'
import AssignmentIcon from '@mui/icons-material/Assignment'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import GTranslateIcon from '@mui/icons-material/GTranslate'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import EmailIcon from '@mui/icons-material/Email'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import BoltIcon from '@mui/icons-material/Bolt'
import { useAuthStore } from '@/libs/stores'

const flowSteps = [
  {
    title: '录音/导入',
    description: '一键录音或上传音频，自动识别讲话人',
  },
  {
    title: 'AI 纪要',
    description: '摘要、决策、风险、行动项自动生成',
  },
  {
    title: '任务/日程',
    description: '行动项自动进入任务看板并同步日历',
  },
  {
    title: '项目/OKR',
    description: '目标拆解可量化 KR，进度持续追踪',
  },
  {
    title: 'PPT/输出',
    description: '一键生成 PPT 预览与下载',
  },
]

const features = [
  {
    icon: <MicIcon sx={{ fontSize: 34 }} />,
    title: '智能录音转写',
    description: '实时录音、导入音频、自动分段与识别',
  },
  {
    icon: <SummarizeIcon sx={{ fontSize: 34 }} />,
    title: 'AI 纪要与情绪',
    description: '摘要、决策、风险、情绪标记全自动',
  },
  {
    icon: <AssignmentIcon sx={{ fontSize: 34 }} />,
    title: '任务看板联动',
    description: '会议行动项一键导入看板闭环追踪',
  },
  {
    icon: <CalendarMonthIcon sx={{ fontSize: 34 }} />,
    title: '日程日历',
    description: '会议与任务统一日历视图，订阅到系统',
  },
  {
    icon: <FlagOutlinedIcon sx={{ fontSize: 34 }} />,
    title: '项目/OKR',
    description: '目标与关键结果量化管理，任务联动进度',
  },
  {
    icon: <SlideshowIcon sx={{ fontSize: 34 }} />,
    title: '会议 PPT',
    description: '自动生成、预览、下载，支持再次编辑',
  },
  {
    icon: <AccountTreeIcon sx={{ fontSize: 34 }} />,
    title: '思维导图',
    description: '会议结构可视化，支持自然语言编辑',
  },
  {
    icon: <GTranslateIcon sx={{ fontSize: 34 }} />,
    title: '同声传译',
    description: '文字/语音输入，多语种 + AI 增强',
  },
]

const toolPills = [
  { icon: <SmartToyIcon fontSize="small" />, label: '多 Agent 可切换' },
  { icon: <EmailIcon fontSize="small" />, label: '邮件/跟进模板' },
  { icon: <BoltIcon fontSize="small" />, label: '自然语言工具调用' },
  { icon: <NotificationsActiveIcon fontSize="small" />, label: '站内提醒' },
  { icon: <SlideshowIcon fontSize="small" />, label: 'PPT 一键导出' },
  { icon: <AccountTreeIcon fontSize="small" />, label: '思维导图可编辑' },
]

const demoSteps = [
  { title: '导入录音', desc: '上传或实时录音，自动分段' },
  { title: '生成纪要', desc: '摘要、风险、行动项自动输出' },
  { title: '任务看板', desc: '行动项进入看板，分派跟踪' },
  { title: 'OKR 联动', desc: '任务关联 KR，进度同步' },
  { title: 'PPT 输出', desc: '一键生成与下载预览' },
  { title: '提醒通知', desc: '站内提醒与日程同步' },
]

const demoFrames = [
  { title: '录音导入', type: 'ingest', stepIndex: 0 },
  { title: '语音转写', type: 'transcript', stepIndex: 0 },
  { title: '会议纪要', type: 'summary', stepIndex: 1 },
  { title: '任务看板', type: 'tasks', stepIndex: 2 },
  { title: '项目/OKR', type: 'okr', stepIndex: 3 },
  { title: 'PPT 构建', type: 'ppt', stepIndex: 4 },
  { title: '导出下载', type: 'pptExport', stepIndex: 4 },
  { title: '站内提醒', type: 'notify', stepIndex: 5 },
]

const demoFrameSlot = 7
const demoFrameTotal = demoFrames.length * demoFrameSlot
const demoSlotPct = (demoFrameSlot / demoFrameTotal) * 100

const demoStepRanges = demoSteps.map(() => ({ start: -1, count: 0 }))
demoFrames.forEach((frame, index) => {
  const range = demoStepRanges[frame.stepIndex]
  if (range.start === -1) {
    range.start = index
  }
  range.count += 1
})

const toPct = (value: number) => `${Number(value.toFixed(2))}%`

const demoFrameKeyframes = {
  '0%': { opacity: 0, transform: 'translateY(12px) scale(0.99)' },
  [toPct(demoSlotPct * 0.12)]: { opacity: 1, transform: 'translateY(0) scale(1)' },
  [toPct(demoSlotPct * 0.78)]: { opacity: 1, transform: 'translateY(0) scale(1)' },
  [toPct(demoSlotPct * 0.92)]: { opacity: 0, transform: 'translateY(-8px) scale(0.99)' },
  '100%': { opacity: 0, transform: 'translateY(-8px) scale(0.99)' },
}

const buildStepKeyframes = (range: { start: number; count: number }) => {
  if (range.start < 0 || range.count <= 0) {
    return {
      '0%': { opacity: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
      '100%': { opacity: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
    }
  }

  const activeStart = (range.start * demoFrameSlot) / demoFrameTotal
  const activeEnd = ((range.start + range.count) * demoFrameSlot) / demoFrameTotal
  const pad = Math.min(0.02, (demoSlotPct * 0.2) / 100)
  const startPct = Math.max(0, activeStart - pad) * 100
  const endPct = Math.min(1, activeEnd + pad) * 100
  const activeStartPct = activeStart * 100
  const activeEndPct = activeEnd * 100
  const base = { opacity: 0.55, borderColor: 'rgba(255,255,255,0.08)' }
  const active = { opacity: 1, borderColor: 'rgba(56,189,248,0.6)' }

  const keyframes: Record<string, { opacity: number; borderColor: string }> = {
    '0%': base,
    [toPct(startPct)]: base,
    [toPct(activeStartPct)]: active,
    [toPct(activeEndPct)]: active,
    [toPct(endPct)]: base,
    '100%': base,
  }

  if (activeStartPct <= 0.5) {
    keyframes['0%'] = active
  }
  if (activeEndPct >= 99.5) {
    keyframes['100%'] = active
  }

  return keyframes
}

export default function LandingPage() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  const renderDemoContent = (type: string) => {
    const cardBase = {
      borderRadius: 2,
      border: '1px solid rgba(255,255,255,0.12)',
      bgcolor: 'rgba(255,255,255,0.04)',
    }
    const tagSx = {
      px: 1,
      height: 22,
      borderRadius: 999,
      bgcolor: 'rgba(10,132,255,0.2)',
      color: '#8dd1ff',
      fontSize: '0.7rem',
      display: 'flex',
      alignItems: 'center',
    }

    if (type === 'ingest') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                录音导入
              </Typography>
              <Box sx={{ ...tagSx, bgcolor: 'rgba(56,189,248,0.2)', color: '#b2e4ff' }}>
                上传中 68%
              </Box>
            </Box>
            {[
              { title: '周会录音.m4a', time: '18:24', status: '解析中' },
              { title: '客户访谈.mp3', time: '32:10', status: '排队中' },
              { title: '市场同步.wav', time: '12:05', status: '已完成' },
            ].map(item => (
              <Box
                key={item.title}
                sx={{
                  ...cardBase,
                  px: 1.5,
                  py: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {item.time}
                  </Typography>
                </Box>
                <Box sx={tagSx}>{item.status}</Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ ...cardBase, p: 1.4 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 1 }}>
              解析进度
            </Typography>
            <Box
              sx={{
                height: 8,
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.12)',
                overflow: 'hidden',
                mb: 1.2,
              }}
            >
              <Box sx={{ width: '68%', height: '100%', bgcolor: '#0A84FF' }} />
            </Box>
            {['已识别 18:24', '说话人分离中', '语言：中文'].map(item => (
              <Box
                key={item}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.6,
                  fontSize: '0.75rem',
                  mb: 0.6,
                }}
              >
                {item}
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    if (type === 'transcript') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.05fr 0.95fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ ...cardBase, p: 1.4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>实时转写</Typography>
              <Box sx={tagSx}>识别: zh</Box>
            </Box>
            <Box
              sx={{
                mt: 1,
                height: 54,
                borderRadius: 2,
                background:
                  'linear-gradient(90deg, rgba(10,132,255,0.35), rgba(56,189,248,0.1))',
              }}
            />
            <Box sx={{ mt: 1.2, display: 'grid', gap: 0.6 }}>
              {[
                { name: '主持人', text: '今天重点看 Q2 的增长目标。' },
                { name: '市场', text: '需要补充 3 个案例做 PPT。' },
                { name: '销售', text: '客户回访会在周五完成。' },
              ].map(item => (
                <Box
                  key={item.text}
                  sx={{
                    borderRadius: 1.5,
                    border: '1px solid rgba(255,255,255,0.1)',
                    px: 1,
                    py: 0.6,
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.name}：</span>
                  {item.text}
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ ...cardBase, p: 1.4 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 1 }}>
              识别信息
            </Typography>
            {[
              { label: '准确率', value: '96%' },
              { label: '说话人', value: '3 人' },
              { label: '关键词', value: '增长 / PPT / 回访' },
            ].map(item => (
              <Box
                key={item.label}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.6,
                  fontSize: '0.75rem',
                  mb: 0.6,
                }}
              >
                {item.label}：{item.value}
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    if (type === 'meetings') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                会议列表
              </Typography>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.4,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.16)',
                  fontSize: '0.7rem',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                搜索会议
              </Box>
            </Box>
            {[
              { title: '周会：产品规划', time: '今天 10:00', tag: 'OKR' },
              { title: '客户回访复盘', time: '昨天 16:30', tag: '跟进' },
              { title: '销售复盘', time: '上周五', tag: 'PPT' },
            ].map(item => (
              <Box
                key={item.title}
                sx={{
                  ...cardBase,
                  px: 1.5,
                  py: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {item.time}
                  </Typography>
                </Box>
                <Box sx={tagSx}>{item.tag}</Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ ...cardBase, p: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.6 }}>
              会议详情
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              参与人：产品、销售、市场
            </Typography>
            <Box sx={{ mt: 1, display: 'grid', gap: 0.6 }}>
              {['录音已导入', '纪要已生成', 'PPT 已就绪'].map(item => (
                <Box
                  key={item}
                  sx={{
                    ...cardBase,
                    px: 1,
                    py: 0.6,
                    fontSize: '0.75rem',
                  }}
                >
                  {item}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )
    }

    if (type === 'summary') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['会议纪要', '待办事项', '语音转写'].map(tab => (
                <Box
                  key={tab}
                  sx={{
                    px: 1.2,
                    py: 0.5,
                    borderRadius: 999,
                    fontSize: '0.7rem',
                    bgcolor: tab === '会议纪要' ? 'rgba(10,132,255,0.25)' : 'rgba(255,255,255,0.06)',
                    color: tab === '会议纪要' ? '#cfe9ff' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {tab}
                </Box>
              ))}
            </Box>
            <Box sx={{ ...cardBase, p: 1.2 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.4 }}>
                摘要
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                已确定下周迭代方案，重点推进客户转化与 PPT 输出。
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 0.6 }}>
              {['关键决策：4/30 上线', '风险：资源不足', '情绪：积极'].map(item => (
                <Box
                  key={item}
                  sx={{
                    ...cardBase,
                    px: 1.2,
                    py: 0.6,
                    fontSize: '0.75rem',
                  }}
                >
                  {item}
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ ...cardBase, p: 1.2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.6 }}>
              行动项
            </Typography>
            {['完善报价方案', '同步客户需求清单', 'OKR 目标拆解'].map(item => (
              <Box
                key={item}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.7,
                  fontSize: '0.75rem',
                  mb: 0.6,
                }}
              >
                · {item}
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    if (type === 'tasks') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 0.9fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {[
              { title: '待处理', items: ['报价完善', '会议回访'] },
              { title: '进行中', items: ['PPT 修订'] },
              { title: '已完成', items: ['需求对齐'] },
            ].map(column => (
              <Box key={column.title} sx={{ ...cardBase, p: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  {column.title}
                </Typography>
                <Box sx={{ mt: 1, display: 'grid', gap: 0.6 }}>
                  {column.items.map(item => (
                    <Box
                      key={item}
                      sx={{
                        borderRadius: 1,
                        border: '1px solid rgba(255,255,255,0.1)',
                        px: 0.8,
                        py: 0.6,
                        fontSize: '0.75rem',
                      }}
                    >
                      {item}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ ...cardBase, p: 1.2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.6 }}>
              任务详情
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.6 }}>
              {['负责人：张三', '优先级：高', '截止：周五'].map(item => (
                <Box
                  key={item}
                  sx={{
                    borderRadius: 1,
                    border: '1px solid rgba(255,255,255,0.1)',
                    px: 1,
                    py: 0.6,
                    fontSize: '0.75rem',
                  }}
                >
                  {item}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )
    }

    if (type === 'okr') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ ...cardBase, p: 1.4 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              项目：Q2 增长计划
            </Typography>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mt: 0.5 }}>
              目标：提升转化率
            </Typography>
            {[
              { label: 'KR1 线索转化率 +15%', value: 72 },
              { label: 'KR2 客户跟进 20+', value: 55 },
            ].map(kr => (
              <Box key={kr.label} sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  {kr.label}
                </Typography>
                <Box
                  sx={{
                    mt: 0.6,
                    height: 6,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ width: `${kr.value}%`, height: '100%', bgcolor: '#0A84FF' }} />
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ ...cardBase, p: 1.2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.6 }}>
              关联任务
            </Typography>
            {['报价完善', '客户回访', 'PPT 更新'].map(item => (
              <Box
                key={item}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.6,
                  fontSize: '0.75rem',
                  mb: 0.6,
                }}
              >
                {item}
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    if (type === 'ppt') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['准备素材', '生成内容', '构建预览', '完成'].map((step, idx) => (
                <Box
                  key={step}
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 999,
                    fontSize: '0.7rem',
                    bgcolor: idx < 3 ? 'rgba(10,132,255,0.25)' : 'rgba(255,255,255,0.08)',
                    color: idx < 3 ? '#cfe9ff' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {step}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {[1, 2, 3].map(page => (
                <Box
                  key={page}
                  sx={{
                    ...cardBase,
                    height: 68,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  幻灯片 {page}
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ ...cardBase, p: 1.2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.6 }}>
              导出操作
            </Typography>
            {['PPTX 下载', 'PDF 下载', '分享链接'].map(item => (
              <Box
                key={item}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.6,
                  fontSize: '0.75rem',
                  mb: 0.6,
                }}
              >
                {item}
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    if (type === 'pptExport') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['内容已生成', '版式优化', '导出就绪'].map(step => (
                <Box
                  key={step}
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 999,
                    fontSize: '0.7rem',
                    bgcolor: 'rgba(10,132,255,0.25)',
                    color: '#cfe9ff',
                  }}
                >
                  {step}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {[1, 2, 3, 4].map(page => (
                <Box
                  key={page}
                  sx={{
                    ...cardBase,
                    height: 62,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  幻灯片 {page}
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ ...cardBase, p: 1.4, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>导出完成</Typography>
            <Box sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
              文件大小 12.4MB · 2026-02-02
            </Box>
            <Box
              sx={{
                mt: 0.4,
                px: 1.4,
                py: 0.8,
                borderRadius: 999,
                bgcolor: 'rgba(10,132,255,0.28)',
                color: '#cfe9ff',
                textAlign: 'center',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              一键下载
            </Box>
            {['推送到邮件', '同步到分享链接'].map(item => (
              <Box
                key={item}
                sx={{
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  px: 1,
                  py: 0.6,
                  fontSize: '0.75rem',
                }}
              >
                {item}
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    if (type === 'notify') {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.2fr 0.8fr' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { title: '任务将于明天到期', time: '2 分钟前' },
              { title: 'PPT 已生成', time: '10 分钟前' },
              { title: 'OKR 进度更新', time: '1 小时前' },
            ].map(item => (
              <Box
                key={item.title}
                sx={{
                  ...cardBase,
                  px: 1.5,
                  py: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                }}
              >
                <span>{item.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item.time}</span>
              </Box>
            ))}
          </Box>
          <Box sx={{ ...cardBase, p: 1.2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.6 }}>
              未读提醒
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['2 条待办', '1 个 OKR 更新'].map(item => (
                <Box
                  key={item}
                  sx={{
                    px: 1,
                    py: 0.4,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.16)',
                    fontSize: '0.7rem',
                  }}
                >
                  {item}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1.2fr 0.8fr' },
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[
            { title: '任务将于明天到期', time: '2 分钟前' },
            { title: 'PPT 已生成', time: '10 分钟前' },
            { title: 'OKR 进度更新', time: '1 小时前' },
          ].map(item => (
            <Box
              key={item.title}
              sx={{
                ...cardBase,
                px: 1.5,
                py: 1,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
              }}
            >
              <span>{item.title}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item.time}</span>
            </Box>
          ))}
        </Box>
        <Box sx={{ ...cardBase, p: 1.2 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.6 }}>
            未读提醒
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['2 条待办', '1 个 OKR 更新'].map(item => (
              <Box
                key={item}
                sx={{
                  px: 1,
                  py: 0.4,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.16)',
                  fontSize: '0.7rem',
                }}
              >
                {item}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0b1119',
        color: 'white',
        fontFamily:
          '"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif',
      }}
    >
      {/* Hero Section */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 3,
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(10,132,255,0.18) 0%, rgba(11,17,25,0.2) 45%, transparent 65%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(10,132,255,0.32) 0%, transparent 70%)',
            filter: 'blur(80px)',
            top: '-10%',
            left: '-10%',
            animation: 'float 8s ease-in-out infinite',
            '@keyframes float': {
              '0%, 100%': { transform: 'translate(0, 0)' },
              '50%': { transform: 'translate(30px, -30px)' },
            },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,189,248,0.28) 0%, transparent 70%)',
            filter: 'blur(80px)',
            bottom: '-10%',
            right: '-10%',
            animation: 'float2 10s ease-in-out infinite',
            '@keyframes float2': {
              '0%, 100%': { transform: 'translate(0, 0)' },
              '50%': { transform: 'translate(-30px, 30px)' },
            },
          }}
        />

        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '3rem', md: '5rem' },
            fontWeight: 800,
            mb: 2,
            background: 'linear-gradient(135deg, #f8fafc 0%, #60a5fa 45%, #22d3ee 85%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            position: 'relative',
            animation: 'fadeIn 1s ease-out',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          MeetMind
        </Typography>

        <Typography
          variant="h5"
          sx={{
            color: 'rgba(255,255,255,0.7)',
            maxWidth: 700,
            mb: 3,
            animation: 'fadeIn 1s ease-out 0.2s both',
          }}
        >
          让会议从“记录”走向“执行”。录音、纪要、任务、OKR、PPT、日程全部自动联动。
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'center',
            animation: 'fadeIn 1s ease-out 0.4s both',
            mb: 3,
          }}
        >
          {['多 Agent', '同声传译', 'PPT 生成', 'OKR 联动'].map(item => (
            <Chip
              key={item}
              label={item}
              sx={{
                bgcolor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {isAuthenticated ? (
            <Button
              component={Link}
              href="/meetings"
              variant="contained"
              size="large"
              sx={{
                px: 6,
                py: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #0A84FF 0%, #38BDF8 100%)',
                fontSize: '1.2rem',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0A6BFF 0%, #22B8FF 100%)',
                },
              }}
            >
              进入工作台
            </Button>
          ) : (
            <>
              <Button
                component={Link}
                href="/register"
                variant="contained"
                size="large"
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #0A84FF 0%, #38BDF8 100%)',
                  fontSize: '1.1rem',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0A6BFF 0%, #22B8FF 100%)',
                  },
                }}
              >
                免费开始
              </Button>
              <Button
                component={Link}
                href="/login"
                variant="outlined"
                size="large"
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'white',
                  fontSize: '1.1rem',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.05)',
                  },
                }}
              >
                登录
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Flow Section */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Typography variant="h3" textAlign="center" sx={{ fontWeight: 700, mb: 2 }}>
          从会议到执行的全链路
        </Typography>
        <Typography variant="h6" textAlign="center" color="rgba(255,255,255,0.6)" sx={{ mb: 6 }}>
          录音 → 纪要 → 任务 → OKR → PPT
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(5, minmax(0, 1fr))',
            },
            gap: 3,
          }}
        >
          {flowSteps.map((step, idx) => (
            <Card
              key={step.title}
              sx={{
                height: '100%',
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 3,
                px: 2,
                py: 2.5,
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}
              >
                Step {idx + 1}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {step.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {step.description}
              </Typography>
            </Card>
          ))}
        </Box>
      </Container>

      {/* Features Section */}
      <Box
        sx={{
          py: 10,
          bgcolor: '#0b1119',
          color: 'white',
          background:
            'radial-gradient(ellipse at 20% 10%, rgba(10,132,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(56,189,248,0.1) 0%, transparent 60%)',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            textAlign="center"
            sx={{
              fontWeight: 700,
              mb: 2,
              background: 'linear-gradient(135deg, #f8fafc 0%, #60a5fa 45%, #22d3ee 85%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            完整功能矩阵
          </Typography>
          <Typography variant="h6" textAlign="center" color="rgba(255,255,255,0.7)" sx={{ mb: 6 }}>
            新增功能已全面覆盖：OKR、PPT、思维导图、同声传译、Agent 工具
          </Typography>

          <Grid container spacing={3}>
            {features.map((feature, idx) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
                <Card
                  sx={{
                    position: 'relative',
                    height: '100%',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 16px 32px rgba(8,14,20,0.45)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(10,132,255,0.08) 45%, rgba(15,23,42,0) 70%)',
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: 1,
                      borderRadius: 2.6,
                      boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.08)',
                      opacity: 0.6,
                      pointerEvents: 'none',
                    },
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 22px 44px rgba(8,14,20,0.6)',
                      borderColor: 'rgba(56,189,248,0.4)',
                    },
                    '&:hover::before': {
                      opacity: 1,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ color: '#7dd3fc', mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'white' }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Agent + Tools Section */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
              多 Agent & 工具调用
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
              面向日常办公的 AI 工作台：选择专属 Agent，直接调用任务、日程、PPT、思维导图等工具。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {toolPills.map(pill => (
                <Chip
                  key={pill.label}
                  icon={pill.icon}
                  label={pill.label}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 999,
                  }}
                />
              ))}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Box
              sx={{
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.12)',
                bgcolor: 'rgba(255,255,255,0.03)',
                p: { xs: 3, md: 4 },
                minHeight: 280,
              }}
            >
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                典型指令
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[
                  '“生成本次会议 PPT，并推送下载按钮”',
                  '“把会议纪要转为 OKR 并关联任务”',
                  '“用中文同声传译成英文，AI 增强”',
                  '“把任务加入本周日程并提醒”',
                ].map(item => (
                  <Box
                    key={item}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.06)',
                      borderRadius: 2,
                      px: 2,
                      py: 1.5,
                      fontSize: '0.95rem',
                    }}
                  >
                    {item}
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Motion Demo Section */}
      <Box sx={{ py: 10, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
                流程演示：真实使用路径
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                从录音导入到纪要生成，再到任务/OKR/PPT/提醒的完整闭环。下方动效展示每一步的
                具体界面与操作状态。
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {demoSteps.map((step, i) => {
                  const stepAnimName = `stepHighlight-${i}`
                  const stepKeyframes = buildStepKeyframes(demoStepRanges[i])

                  return (
                    <Box
                      key={step.title}
                      sx={{
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start',
                        px: 2,
                        py: 1.5,
                        borderRadius: 2,
                        border: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        animation: `${stepAnimName} ${demoFrameTotal}s linear infinite`,
                        [`@keyframes ${stepAnimName}`]: stepKeyframes,
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: 'rgba(10,132,255,0.2)',
                          border: '1px solid rgba(10,132,255,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{step.title}</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                          {step.desc}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.12)',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  p: 3,
                  minHeight: { xs: 360, md: 380 },
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.5,
                    background:
                      'linear-gradient(120deg, rgba(10,132,255,0.08) 0%, transparent 60%)',
                  }}
                />
                {demoFrames.map((frame, i) => (
                  <Box
                    key={`${frame.title}-${i}`}
                    sx={{
                      position: 'absolute',
                      inset: 24,
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.12)',
                      bgcolor: 'rgba(9,15,22,0.75)',
                      px: 3,
                      py: 2.5,
                      overflow: 'hidden',
                      maxHeight: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      opacity: 0,
                      transform: 'translateY(12px)',
                      animation: `frameShow ${demoFrameTotal}s ${i * demoFrameSlot}s linear infinite`,
                      pointerEvents: 'none',
                      willChange: 'opacity, transform',
                      '@keyframes frameShow': {
                        ...demoFrameKeyframes,
                      },
                    }}
                  >
                    {renderDemoContent(frame.type)}
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: 10,
          textAlign: 'center',
          background: 'linear-gradient(180deg, transparent 0%, rgba(10,132,255,0.12) 100%)',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
          准备好让会议真正推动业务了吗？
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: 4 }}>
          立即注册，使用全链路会议协作平台
        </Typography>
        <Button
          component={Link}
          href="/register"
          variant="contained"
          size="large"
          sx={{
            px: 6,
            py: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #0A84FF 0%, #38BDF8 100%)',
            fontSize: '1.2rem',
          }}
        >
          立即体验
        </Button>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 4, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
          © 2026 MeetMind. All rights reserved.
        </Typography>
      </Box>
    </Box>
  )
}
