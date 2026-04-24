/**
 * Pure utility functions for slide markdown parsing and formatting.
 */

export interface ParsedSlide {
  title: string
  body: string
  notes: string
  frontmatter: string
}

/** Split a Slidev markdown string into individual slide sections */
export function splitSlides(markdown: string): string[] {
  return markdown.split('\n---\n').filter((s) => s.trim().length > 0)
}

/** Join slide sections back into a Slidev markdown string */
export function joinSlides(sections: string[]): string {
  return sections.join('\n---\n')
}

/** Parse a slide section into title, body, and speaker notes */
export function parseSlideSection(section: string): ParsedSlide {
  // Extract frontmatter (--- block at very start)
  let frontmatter = ''
  let content = section

  // Extract speaker notes (HTML comment at end)
  let notes = ''
  const notesMatch = content.match(/\n?<!--\s*([\s\S]*?)\s*-->\s*$/)
  if (notesMatch) {
    notes = notesMatch[1].trim()
    content = content.slice(0, content.length - notesMatch[0].length).trimEnd()
  }

  // Parse title (first heading line)
  const lines = content.split('\n')
  let title = ''
  let titleIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    // Skip frontmatter-like lines
    if (trimmed.startsWith('layout:') || trimmed.startsWith('class:') || trimmed.startsWith('background:')) {
      frontmatter += (frontmatter ? '\n' : '') + trimmed
      continue
    }
    const headingMatch = trimmed.match(/^(#+)\s*(.*)$/)
    if (headingMatch) {
      title = headingMatch[2]
      titleIndex = i
    }
    break
  }

  let bodyLines = lines
  if (titleIndex >= 0) {
    bodyLines = [...lines.slice(0, titleIndex), ...lines.slice(titleIndex + 1)]
  }
  // Remove frontmatter lines from body
  const body = bodyLines
    .filter(
      (l) =>
        !l.trim().startsWith('layout:') &&
        !l.trim().startsWith('class:') &&
        !l.trim().startsWith('background:'),
    )
    .join('\n')
    .trim()

  return { title, body, notes, frontmatter }
}

/** Build a slide section from structured parts */
export function buildSlideSection(parsed: Partial<ParsedSlide>): string {
  const parts: string[] = []
  if (parsed.frontmatter?.trim()) {
    parts.push(parsed.frontmatter.trim())
  }
  if (parsed.title?.trim()) {
    parts.push(`# ${parsed.title.trim()}`)
  }
  if (parsed.body?.trim()) {
    parts.push(parsed.body.trim())
  }
  if (parsed.notes?.trim()) {
    parts.push(`\n<!--\n${parsed.notes.trim()}\n-->`)
  }
  return parts.join('\n\n')
}

/** Get a display title for a slide section (for thumbnails) */
export function getSlideTitle(section: string, index: number): string {
  const parsed = parseSlideSection(section)
  return parsed.title || `第 ${index + 1} 页`
}

/** Get a snippet for a slide section (for thumbnails) */
export function getSlideSnippet(section: string): string {
  const parsed = parseSlideSection(section)
  return parsed.body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' ')
    .replace(/^#+\s*/, '')
    .slice(0, 60)
}

/** Create a new blank slide section */
export function createBlankSlide(): string {
  return '# 新页面\n\n- '
}

// ---- Text formatting transforms ----

export function toggleWrap(prefix: string, suffix = prefix) {
  return (text: string): string => {
    const trimmed = text.trim()
    if (trimmed.startsWith(prefix) && trimmed.endsWith(suffix)) {
      return trimmed.slice(prefix.length, trimmed.length - suffix.length)
    }
    return `${prefix}${text}${suffix}`
  }
}

export function applyFontSizeTransform(size: 'small' | 'medium' | 'large') {
  const px = size === 'small' ? 16 : size === 'medium' ? 22 : 28
  return (text: string) => `<span style="font-size:${px}px">${text}</span>`
}

export function applyColorTransform(color: string) {
  return (text: string) => `<span style="color:${color}">${text}</span>`
}

export function applyBulletListTransform(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (/^[-*]\s+/.test(trimmed)) return line
      return `- ${trimmed}`
    })
    .join('\n')
}

export function applyHeadingTransform(level: 1 | 2 | 3) {
  const prefix = '#'.repeat(level) + ' '
  return (text: string) =>
    text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return line
        const content = trimmed.replace(/^#+\s+/, '')
        return `${prefix}${content}`
      })
      .join('\n')
}

export function applyAlignmentTransform(align: 'left' | 'center' | 'right') {
  return (text: string) => {
    const trimmed = text.trim()
    const match = trimmed.match(/^<div style="text-align:(left|center|right)">([\s\S]*)<\/div>$/i)
    if (match && match[1].toLowerCase() === align) {
      return match[2]
    }
    return `<div style="text-align:${align}">\n${text}\n</div>`
  }
}

export function clearFormattingTransform(text: string): string {
  return text
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<\/?u>/gi, '')
    .replace(/<div style="text-align:(left|center|right)">([\s\S]*?)<\/div>/gi, '$2')
}
