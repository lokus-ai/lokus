// Web Worker: force-directed layout computed off the main thread

let nodes = [] // [{id, x, y, vx, vy}]
let idToIdx = new Map()
let edges = [] // [{i,j} indexes]
let running = false

function init(payload) {
  const { nodes: ns, edges: es, width = 1200, height = 800 } = payload
  
  // Better initial positioning - circular layout for small graphs, random for large
  const centerX = width / 2, centerY = height / 2
  const radius = Math.min(width, height) / 3
  
  if (ns.length <= 20) {
    // Circular layout for small graphs
    nodes = ns.map((n, i) => {
      const angle = (i / ns.length) * Math.PI * 2
      return {
        id: n.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0
      }
    })
  } else {
    // Random with some clustering for larger graphs
    nodes = ns.map((n) => ({
      id: n.id,
      x: centerX + (Math.random() - 0.5) * width * 0.6,
      y: centerY + (Math.random() - 0.5) * height * 0.6,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2
    }))
  }
  
  idToIdx = new Map(nodes.map((n,i)=>[n.id,i]))
  edges = es.map(e => ({ i: idToIdx.get(e.source), j: idToIdx.get(e.target) })).filter(e => e.i!=null && e.j!=null)
  
  console.log(`[worker] Initialized: ${nodes.length} nodes, ${edges.length} edges`)
}

function stepOnce(dt, width, height) {
  // Obsidian-style physics parameters
  const repulsion = 2400, spring = 0.012, springLen = 120, damping = 0.92, maxSpeed = 4.0
  const centerForce = 0.001 // Gentle pull toward center
  const cell = 140
  
  const centerX = width / 2, centerY = height / 2
  const buckets = new Map()
  
  // Spatial hashing for performance
  for (let i=0;i<nodes.length;i++) {
    const n = nodes[i]
    const kx = Math.floor(n.x/cell), ky = Math.floor(n.y/cell)
    const key = kx+','+ky
    if (!buckets.has(key)) buckets.set(key,[])
    buckets.get(key).push(i)
  }
  
  const neigh = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]]
  
  // Repulsion forces with spatial optimization
  for (let i=0;i<nodes.length;i++) {
    const a = nodes[i]
    if (a.pinned) continue // Skip pinned nodes
    
    const kx = Math.floor(a.x/cell), ky = Math.floor(a.y/cell)
    for (const [dx,dy] of neigh) {
      const key = (kx+dx)+','+(ky+dy)
      const arr = buckets.get(key)
      if (!arr) continue
      for (const j of arr) {
        if (j===i) continue
        const b = nodes[j]
        let dx2 = a.x - b.x, dy2 = a.y - b.y
        let d2 = dx2*dx2 + dy2*dy2 + 0.1
        let f = repulsion / d2
        const invD = 1/Math.sqrt(d2)
        const fx = f * dx2 * invD * dt
        const fy = f * dy2 * invD * dt
        a.vx += fx
        a.vy += fy
      }
    }
    
    // Gentle center attraction for better layout
    const dcx = centerX - a.x, dcy = centerY - a.y
    a.vx += dcx * centerForce * dt
    a.vy += dcy * centerForce * dt
  }
  
  // Spring forces between connected nodes
  for (const e of edges) {
    const a = nodes[e.i], b = nodes[e.j]
    let dx = b.x - a.x, dy = b.y - a.y
    const d = Math.max(0.1, Math.hypot(dx,dy))
    const diff = d - springLen
    const force = spring * diff
    const ux = dx/d, uy = dy/d
    const fx = force * ux * dt, fy = force * uy * dt
    
    if (!a.pinned) { a.vx += fx; a.vy += fy }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy }
  }
  
  // Integration and constraints
  let avgSpeed = 0
  for (const n of nodes) {
    if (n.pinned) continue
    
    // Apply damping
    n.vx *= damping
    n.vy *= damping
    
    // Velocity limiting
    const speed = Math.hypot(n.vx, n.vy)
    if (speed > maxSpeed) {
      const s = maxSpeed / speed
      n.vx *= s
      n.vy *= s
    }
    
    // Position update
    n.x += n.vx
    n.y += n.vy
    
    // Boundary constraints with softer edges
    const margin = 50
    if (n.x < margin) { n.x = margin; n.vx = Math.abs(n.vx) * 0.5 }
    if (n.x > width - margin) { n.x = width - margin; n.vx = -Math.abs(n.vx) * 0.5 }
    if (n.y < margin) { n.y = margin; n.vy = Math.abs(n.vy) * 0.5 }
    if (n.y > height - margin) { n.y = height - margin; n.vy = -Math.abs(n.vy) * 0.5 }
    
    avgSpeed += speed
  }
  
  return avgSpeed / Math.max(1, nodes.filter(n => !n.pinned).length)
}

function runLoop() {
  if (!running) return
  const start = performance.now()
  let cooled = false
  
  // Adaptive timestep for smoother animation
  let avg = 0
  const maxTime = 8 // Keep frame budget tight
  for (let iter = 0; performance.now() - start < maxTime && iter < 5; iter++) {
    avg = stepOnce(0.6, 1800, 1200) // Smaller timestep for stability
    if (avg < 0.08) { cooled = true; break }
  }
  
  postMessage({ type: 'tick', nodes })
  
  if (cooled) { 
    running = false
    postMessage({ type: 'done' })
    return 
  }
  
  // Use requestAnimationFrame-like timing for smooth 60fps
  setTimeout(runLoop, 16)
}

onmessage = (e) => {
  const { type } = e.data || {}
  if (type === 'init') { init(e.data); return }
  if (type === 'start') { running = true; runLoop(); return }
  if (type === 'stop') { running = false; return }
}

