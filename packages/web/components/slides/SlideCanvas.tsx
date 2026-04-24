'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { parseSlideSection } from './utils'

interface SlideCanvasProps {
  section: string
  imageUrl?: string
  previewUrl?: string
  previewMode: 'pdf' | 'html' | 'image'
  slideIndex: number
  isMobile: boolean
  isDark: boolean
}

export default function SlideCanvas({
  section,
  imageUrl,
  previewUrl,
  previewMode,
  slideIndex,
  isMobile,
  isDark,
}: SlideCanvasProps) {
  // Priority: image > iframe > styled fallback
  if (imageUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: isDark ? '#0d0f14' : '#e8eaf0',
          borderRadius: 2,
          overflow: 'hidden',
          p: { xs: 1, md: 2 },
        }}
      >
        <Box
          component="img"
          src={imageUrl}
          alt={`slide-${slideIndex + 1}`}
          draggable={false}
          sx={{
            width: '100%',
            maxHeight: isMobile ? '50vh' : '65vh',
            objectFit: 'contain',
            borderRadius: 1,
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.6)'
              : '0 8px 32px rgba(0,0,0,0.12)',
          }}
        />
      </Box>
    )
  }

  if (previewUrl && (previewMode === 'pdf' || previewMode === 'html')) {
    return (
      <Box
        sx={{
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: isDark ? '#0d0f14' : '#e8eaf0',
        }}
      >
        <iframe
          title={`slides-preview-${previewMode}`}
          src={previewUrl}
          style={{
            width: '100%',
            height: isMobile ? '50vh' : '65vh',
            border: 'none',
          }}
        />
      </Box>
    )
  }

  // Styled fallback: render parsed slide content in a slide-like card
  const parsed = parseSlideSection(section || '')
  const bodyLines = parsed.body
    ? parsed.body
        .split('\n')
        .filter((l) => l.trim().length > 0)
    : []

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: isDark ? '#0d0f14' : '#e8eaf0',
        borderRadius: 2,
        p: { xs: 1, md: 3 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 800,
          aspectRatio: '16/9',
          bgcolor: isDark ? '#1a1d2e' : '#ffffff',
          borderRadius: 2,
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.6)'
            : '0 8px 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 3, md: 5 },
          py: { xs: 2, md: 4 },
          overflow: 'hidden',
        }}
      >
        {parsed.title ? (
          <Typography
            variant={isMobile ? 'h6' : 'h4'}
            sx={{
              fontWeight: 700,
              mb: 2,
              color: isDark ? '#e2e8f0' : '#1e293b',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {parsed.title}
          </Typography>
        ) : (
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.disabled',
              mb: 2,
            }}
          >
            第 {slideIndex + 1} 页
          </Typography>
        )}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75, overflow: 'hidden' }}>
          {bodyLines.length === 0 ? (
            <Typography color="text.disabled" variant="body1" sx={{ fontStyle: 'italic' }}>
              在右侧面板编辑内容
            </Typography>
          ) : (
            bodyLines.slice(0, 8).map((line, idx) => {
              const trimmed = line.trim()
              const isBullet = /^[-*]\s+/.test(trimmed)
              const text = isBullet ? trimmed.replace(/^[-*]\s+/, '') : trimmed
              const isSubHeading = /^##/.test(trimmed)
              const headingText = trimmed.replace(/^#+\s*/, '')

              if (isSubHeading) {
                return (
                  <Typography
                    key={idx}
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      color: isDark ? '#94a3b8' : '#475569',
                      mt: 0.5,
                    }}
                  >
                    {headingText}
                  </Typography>
                )
              }

              return (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  {isBullet && (
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        mt: 1,
                        bgcolor: isDark ? '#64748b' : '#94a3b8',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <Typography
                    variant="body1"
                    sx={{
                      color: isDark ? '#cbd5e1' : '#334155',
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {isBullet ? text : trimmed}
                  </Typography>
                </Box>
              )
            })
          )}
          {bodyLines.length > 8 && (
            <Typography variant="caption" color="text.secondary">
              ...还有 {bodyLines.length - 8} 行
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
