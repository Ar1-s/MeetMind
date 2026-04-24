'use client'

import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import LinearProgress from '@mui/material/LinearProgress'
import ButtonBase from '@mui/material/ButtonBase'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { BackgroundAsset, BackgroundConfig } from './useSlideEditor'
import { getSlideTitle } from './utils'

interface SlideBackgroundTabProps {
  sections: string[]
  slidesCount: number
  backgroundConfig: BackgroundConfig
  backgroundPresets: BackgroundAsset[]
  backgroundUploads: BackgroundAsset[]
  backgroundRecommended: BackgroundAsset[]
  backgroundAssetsAll: BackgroundAsset[]
  backgroundAssetMap: Record<string, BackgroundAsset>
  backgroundSource: 'preset' | 'upload' | 'recommend'
  backgroundLoading: boolean
  backgroundSaving: boolean
  backgroundUploading: boolean
  onSourceChange: (source: 'preset' | 'upload' | 'recommend') => void
  onGlobalChange: (value: string) => void
  onSlideChange: (index: number, value: string) => void
  onUpload: (file?: File | null) => void
  onFetchRecommendations: () => void
  isDark: boolean
}

export default function SlideBackgroundTab({
  sections,
  slidesCount,
  backgroundConfig,
  backgroundPresets,
  backgroundUploads,
  backgroundRecommended,
  backgroundAssetsAll,
  backgroundAssetMap,
  backgroundSource,
  backgroundLoading,
  backgroundSaving,
  backgroundUploading,
  onSourceChange,
  onGlobalChange,
  onSlideChange,
  onUpload,
  onFetchRecommendations,
  isDark,
}: SlideBackgroundTabProps) {
  const softBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
  const softBg = isDark ? '#1A1C24' : '#F7F7FB'

  const currentAssets =
    backgroundSource === 'preset'
      ? backgroundPresets
      : backgroundSource === 'upload'
        ? backgroundUploads
        : backgroundRecommended

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, overflow: 'auto' }}>
      {/* Global background */}
      <Paper sx={{ p: 2, borderRadius: 2, border: softBorder, bgcolor: softBg }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="subtitle2">全局背景</Typography>
          <Typography variant="caption" color="text.secondary">
            {backgroundSaving ? '保存中...' : '已保存'}
          </Typography>
        </Box>
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel shrink>选择背景</InputLabel>
          <Select
            label="选择背景"
            value={backgroundConfig.global_id || ''}
            displayEmpty
            onChange={(e) => onGlobalChange(String(e.target.value))}
            renderValue={(selected) => {
              if (!selected) return <Typography variant="body2">不使用背景</Typography>
              const asset = backgroundAssetMap[String(selected)]
              return <Typography variant="body2">{asset?.name || '背景素材'}</Typography>
            }}
          >
            <MenuItem value="">不使用背景</MenuItem>
            {backgroundAssetsAll.map((asset) => (
              <MenuItem key={asset.id} value={asset.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    component="img"
                    src={asset.url}
                    alt={asset.name || '背景'}
                    sx={{
                      width: 44,
                      height: 28,
                      borderRadius: 1,
                      objectFit: 'cover',
                      border: softBorder,
                    }}
                  />
                  <Box>
                    <Typography variant="body2">{asset.name || '背景素材'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {asset.source || '素材库'}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Asset browser */}
      <Paper sx={{ p: 2, borderRadius: 2, border: softBorder, bgcolor: softBg }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2">背景素材</Typography>
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            disabled={backgroundUploading}
          >
            {backgroundUploading ? '上传中...' : '上传背景'}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void onUpload(file)
              }}
            />
          </Button>
        </Box>
        <Tabs
          value={backgroundSource}
          onChange={(_, value) => onSourceChange(value)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, fontSize: '0.8rem' },
          }}
        >
          <Tab value="preset" label="素材库" />
          <Tab value="upload" label="已上传" />
          <Tab
            value="recommend"
            label="AI 推荐"
            icon={<AutoAwesomeIcon fontSize="small" />}
            iconPosition="end"
          />
        </Tabs>
        <Divider sx={{ my: 1 }} />
        {backgroundSource === 'recommend' && (
          <Box
            sx={{
              mb: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              根据会议内容推荐背景
            </Typography>
            <Button size="small" variant="outlined" onClick={onFetchRecommendations}>
              生成推荐
            </Button>
          </Box>
        )}
        {backgroundLoading ? (
          <LinearProgress />
        ) : (
          <Grid container spacing={1.5}>
            {currentAssets.map((asset) => (
              <Grid key={asset.id} size={{ xs: 6, sm: 4, md: 3 }}>
                <ButtonBase
                  onClick={() => onGlobalChange(asset.id)}
                  sx={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 2,
                    border:
                      asset.id === backgroundConfig.global_id ? '2px solid' : softBorder,
                    borderColor:
                      asset.id === backgroundConfig.global_id ? 'primary.main' : undefined,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box sx={{ width: '100%' }}>
                    <Box
                      component="img"
                      src={asset.url}
                      alt={asset.name || '背景'}
                      sx={{
                        width: '100%',
                        height: 96,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <Box sx={{ p: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {asset.name || '背景素材'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        点击设为全局
                      </Typography>
                    </Box>
                  </Box>
                </ButtonBase>
              </Grid>
            ))}
            {currentAssets.length === 0 && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  暂无素材
                </Typography>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>

      {/* Per-slide backgrounds */}
      <Paper sx={{ p: 2, borderRadius: 2, border: softBorder, bgcolor: softBg }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          单页背景
        </Typography>
        {slidesCount === 0 ? (
          <Typography variant="caption" color="text.secondary">
            暂无可编辑的幻灯片内容
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: slidesCount }).map((_, idx) => {
              const title = getSlideTitle(sections[idx] || '', idx)
              const selected = backgroundConfig.slides[String(idx + 1)] || ''
              return (
                <Box
                  key={`slide-bg-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    borderRadius: 1.5,
                    border: softBorder,
                    p: 1,
                    bgcolor: 'background.paper',
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 140 }}>
                    {title}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 200, flexShrink: 0 }}>
                    <InputLabel shrink>页面背景</InputLabel>
                    <Select
                      label="页面背景"
                      value={selected}
                      displayEmpty
                      onChange={(e) => onSlideChange(idx + 1, String(e.target.value))}
                      renderValue={(value) => {
                        if (!value) return <Typography variant="body2">跟随全局</Typography>
                        const asset = backgroundAssetMap[String(value)]
                        return (
                          <Typography variant="body2">{asset?.name || '背景素材'}</Typography>
                        )
                      }}
                    >
                      <MenuItem value="">跟随全局</MenuItem>
                      {backgroundAssetsAll.map((asset) => (
                        <MenuItem key={`slide-${idx}-${asset.id}`} value={asset.id}>
                          {asset.name || '背景素材'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )
            })}
          </Box>
        )}
      </Paper>
    </Box>
  )
}
