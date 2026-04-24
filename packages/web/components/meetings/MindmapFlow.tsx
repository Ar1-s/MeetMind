'use client'

import { useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
  ConnectionLineType,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { MindmapNode, MindmapData } from '@/interfaces'

// Node dimensions for layout
const NODE_WIDTH = 180
const NODE_HEIGHT = 50

// Convert MindmapNode[] to ReactFlow nodes and edges with Dagre layout
function convertToReactFlow(mindmapNodes: MindmapNode[]): {
  nodes: Node[]
  edges: Edge[]
} {
  if (!mindmapNodes || mindmapNodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  // Create dagre graph
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 })

  // Add nodes to dagre
  mindmapNodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  // Create edges from parent_id relationships
  const edges: Edge[] = []
  mindmapNodes.forEach(node => {
    if (node.parent_id) {
      const edgeId = `edge-${node.parent_id}-${node.id}`
      edges.push({
        id: edgeId,
        source: node.parent_id,
        target: node.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
        style: { strokeWidth: 2, stroke: '#6366f1' },
      })
      dagreGraph.setEdge(node.parent_id, node.id)
    }
  })

  // Run dagre layout
  dagre.layout(dagreGraph)

  // Get node colors based on type
  const getNodeStyle = (type: string) => {
    switch (type) {
      case 'topic':
        return {
          background: '#667eea',
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
        }
      case 'subtopic':
        return {
          background: '#f093fb',
          color: 'white',
          fontSize: '13px',
          fontWeight: 500,
        }
      case 'detail':
        return {
          background: '#4facfe',
          color: 'white',
          fontSize: '12px',
          fontWeight: 400,
        }
      default:
        return {
          background: '#e2e8f0',
          color: '#1e293b',
          fontSize: '12px',
          fontWeight: 400,
        }
    }
  }

  // Convert to ReactFlow nodes with positions from dagre
  const nodes: Node[] = mindmapNodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id)
    const style = getNodeStyle(node.type)

    return {
      id: node.id,
      type: 'default',
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: {
        label: node.label,
      },
      style: {
        ...style,
        borderRadius: '12px',
        padding: '10px 16px',
        border: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: NODE_WIDTH,
        textAlign: 'center' as const,
      },
    }
  })

  return { nodes, edges }
}

interface MindmapFlowProps {
  mindmap: MindmapData | null
  onNodesChange?: (nodes: Node[]) => void
}

export default function MindmapFlow({ mindmap, onNodesChange }: MindmapFlowProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return convertToReactFlow(mindmap?.nodes || [])
  }, [mindmap])

  const flowRef = useRef<ReactFlowInstance | null>(null)
  const hasFitRef = useRef(false)
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync nodes and edges when mindmap prop changes
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    hasFitRef.current = false
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Update parent when nodes change
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChangeInternal(changes)
      if (onNodesChange) {
        onNodesChange(nodes)
      }
    },
    [onNodesChangeInternal, onNodesChange, nodes],
  )

  const requestFitView = useCallback((duration = 200) => {
    const instance = flowRef.current
    if (!instance) return
    requestAnimationFrame(() => {
      instance.fitView({ padding: 0.2, duration })
    })
  }, [])

  useEffect(() => {
    if (!nodes.length) return
    if (hasFitRef.current) return
    hasFitRef.current = true
    requestFitView()
  }, [nodes.length, requestFitView])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => requestFitView(0)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [requestFitView])

  if (!mindmap || !mindmap.nodes || mindmap.nodes.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        暂无思维导图数据
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: { xs: '60vh', sm: '65vh', md: '100%' },
        minHeight: { xs: 360, sm: 420, md: 480 },
        bgcolor: isDark ? '#111318' : 'background.paper',
        '& .react-flow__controls': {
          boxShadow: isDark ? '0 8px 16px rgba(0,0,0,0.5)' : '0 8px 16px rgba(0,0,0,0.08)',
        },
        '& .react-flow__controls-button': {
          backgroundColor: isDark ? '#1A1C24' : '#ffffff',
          color: isDark ? 'rgba(255,255,255,0.9)' : 'inherit',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        },
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        connectionLineType={ConnectionLineType.SmoothStep}
        onInit={(instance: ReactFlowInstance) => {
          flowRef.current = instance
          requestFitView(0)
        }}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-left"
        style={{
          width: '100%',
          height: '100%',
          background: isDark ? '#111318' : theme.palette.background.paper,
        }}
      >
        <Controls />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}
        />
      </ReactFlow>
    </Box>
  )
}
