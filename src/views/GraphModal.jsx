import React, { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { buildWorkspaceGraph } from '@/core/wiki/graph.js'

export default function GraphModal({ open, onOpenChange, workspacePath }) {
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    buildWorkspaceGraph(workspacePath)
      .then(g => setGraph(g))
      .finally(() => setLoading(false))
  }, [open, workspacePath])

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)
    // layout nodes in a circle
    const N = Math.max(1, graph.nodes.length)
    const R = Math.max(80, Math.min(w, h) / 2 - 40)
    const cx = w / 2, cy = h / 2
    const positions = new Map()
    graph.nodes.forEach((n, i) => {
      const a = (i / N) * Math.PI * 2
      positions.set(n.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) })
    })

    // draw edges
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
    ctx.lineWidth = 1
    for (const e of graph.edges) {
      const s = positions.get(e.source)
      const t = positions.get(e.target)
      if (!s || !t) continue
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }

    // draw nodes
    for (const n of graph.nodes) {
      const p = positions.get(n.id)
      if (!p) continue
      ctx.fillStyle = 'rgb(59 130 246)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fill()
    }

    // labels
    ctx.fillStyle = 'rgb(203 213 225)'
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica, Arial'
    ctx.textAlign = 'center'
    for (const n of graph.nodes) {
      const p = positions.get(n.id)
      if (!p) continue
      ctx.fillText(n.title.replace(/\.(md|markdown)$/i, ''), p.x, p.y - 10)
    }

    // click to open file
    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      let best = null, bestD = 99999
      for (const n of graph.nodes) {
        const p = positions.get(n.id)
        const dx = p.x - x, dy = p.y - y
        const d = Math.hypot(dx, dy)
        if (d < bestD) { bestD = d; best = n }
      }
      if (best && bestD < 14) {
        // open
        (async () => {
          try {
            const { emit } = await import('@tauri-apps/api/event')
            await emit('lokus:open-file', best.path)
          } catch {
            try { window.dispatchEvent(new CustomEvent('lokus:open-file', { detail: best.path })) } catch {}
          }
        })()
      }
    }
    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
  }, [open, graph])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] h-[600px] max-w-[95vw] max-h-[85vh] p-0 bg-app-panel border border-app-border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-app-border">
          <div className="font-medium">Workspace Graph</div>
          {loading && <div className="text-xs text-app-muted">Building…</div>}
        </div>
        <div className="p-2">
          <canvas ref={canvasRef} className="w-[860px] h-[520px] block rounded bg-app-bg" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

