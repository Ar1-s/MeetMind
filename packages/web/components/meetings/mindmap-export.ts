import type { MindmapData } from '@/interfaces'

type ExportNode = {
  id: string
  label: string
  x: number
  y: number
  parentId?: string | null
  tone: {
    fill: string
    text: string
  }
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 64
const H_GAP = 140
const V_GAP = 28
const PADDING = 48

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const lineWrap = (label: string, maxChars = 16) => {
  const chunks: string[] = []
  let current = ''

  for (const char of label.trim()) {
    current += char
    if (current.length >= maxChars) {
      chunks.push(current)
      current = ''
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks.slice(0, 3)
}

const getTone = (type: string) => {
  switch (type) {
    case 'topic':
      return { fill: '#0F766E', text: '#F8FAFC' }
    case 'subtopic':
      return { fill: '#0284C7', text: '#F8FAFC' }
    default:
      return { fill: '#E2E8F0', text: '#0F172A' }
  }
}

const buildLayout = (mindmap: MindmapData): ExportNode[] => {
  const childrenMap = new Map<string, typeof mindmap.nodes>()
  const rootNodes = mindmap.nodes.filter(node => !node.parent_id)

  for (const node of mindmap.nodes) {
    if (!node.parent_id) continue
    const siblings = childrenMap.get(node.parent_id) || []
    siblings.push(node)
    childrenMap.set(node.parent_id, siblings)
  }

  const nodes: ExportNode[] = []
  let cursorY = PADDING

  const walk = (node: MindmapData['nodes'][number], depth: number): number => {
    const children = childrenMap.get(node.id) || []
    const subtreeHeight =
      children.length > 0
        ? children.reduce((total, child) => total + walk(child, depth + 1), 0) +
          Math.max(children.length - 1, 0) * V_GAP
        : NODE_HEIGHT
    const ownY = cursorY + subtreeHeight / 2 - NODE_HEIGHT / 2

    nodes.push({
      id: node.id,
      label: node.label,
      x: PADDING + depth * (NODE_WIDTH + H_GAP),
      y: ownY,
      parentId: node.parent_id,
      tone: getTone(node.type),
    })

    if (children.length === 0) {
      cursorY += NODE_HEIGHT
      return NODE_HEIGHT
    }

    return subtreeHeight
  }

  for (const root of rootNodes) {
    const startY = cursorY
    const height = walk(root, 0)
    cursorY = Math.max(cursorY, startY + height + V_GAP)
  }

  return nodes
}

export function exportMindmapAsSvg(mindmap: MindmapData, fileName: string) {
  const nodes = buildLayout(mindmap)
  if (!nodes.length) return

  const maxX = Math.max(...nodes.map(node => node.x + NODE_WIDTH))
  const maxY = Math.max(...nodes.map(node => node.y + NODE_HEIGHT))
  const width = maxX + PADDING
  const height = maxY + PADDING

  const nodeMap = new Map(nodes.map(node => [node.id, node]))

  const edges = nodes
    .filter(node => node.parentId)
    .map(node => {
      const parent = node.parentId ? nodeMap.get(node.parentId) : null
      if (!parent) return ''

      const startX = parent.x + NODE_WIDTH
      const startY = parent.y + NODE_HEIGHT / 2
      const endX = node.x
      const endY = node.y + NODE_HEIGHT / 2
      const midX = startX + (endX - startX) / 2

      return `<path d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" stroke="#94A3B8" stroke-width="3" fill="none" stroke-linecap="round" />`
    })
    .join('')

  const svgNodes = nodes
    .map(node => {
      const lines = lineWrap(node.label)
      const textY = node.y + 26
      const tspans = lines
        .map((line, index) => {
          const dy = index === 0 ? 0 : 18
          return `<tspan x="${node.x + NODE_WIDTH / 2}" dy="${dy}">${escapeXml(line)}</tspan>`
        })
        .join('')

      return `
        <g>
          <rect x="${node.x}" y="${node.y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="18" fill="${node.tone.fill}" />
          <text x="${node.x + NODE_WIDTH / 2}" y="${textY}" fill="${node.tone.text}" text-anchor="middle" font-family="'SF Pro Display', 'PingFang SC', sans-serif" font-size="16" font-weight="600">${tspans}</text>
        </g>
      `
    })
    .join('')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#F8FAFC" />
  ${edges}
  ${svgNodes}
</svg>`

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${fileName || 'mindmap'}.svg`
  anchor.click()
  URL.revokeObjectURL(url)
}
