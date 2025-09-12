import { invoke } from '@tauri-apps/api/core'

function dirname(p) {
  if (!p) return ''
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''
}

function filename(p) {
  return (p || '').split(/[\\/]/).pop()
}

function indexByName(index) {
  const map = new Map()
  for (const f of index) {
    const name = filename(f.path)
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(f)
  }
  return map
}

function resolveTarget(target, sourcePath, index) {
  // Remove optional alias part after |
  const base = String(target || '').split('|')[0].trim()
  if (!base) return null
  // If includes slash, try exact path match against index
  if (/[/\\]/.test(base)) {
    const hit = index.find(f => f.path.endsWith(base)) || index.find(f => f.path === base)
    return hit?.path || null
  }
  // Otherwise, match by file name, prefer same folder
  const srcDir = dirname(sourcePath)
  const name = base
  const byName = indexByName(index)
  const list = byName.get(name) || byName.get(`${name}.md`) || []
  if (!list.length) return null
  const same = list.find(f => dirname(f.path) === srcDir)
  return (same || list[0]).path
}

export async function buildWorkspaceGraph(workspacePath) {
  const idx = (globalThis.__LOKUS_FILE_INDEX__ || [])
  const files = Array.isArray(idx) && idx.length ? idx : []

  const mdFiles = files.filter(f => /\.(md|markdown|txt)$/i.test(f.title || f.path))
  const nodes = mdFiles.map(f => ({ id: f.path, title: f.title || f.path.split('/').pop(), path: f.path }))
  const edges = []

  // Optimized regex with global flag
  const linkRe = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g
  
  // Process files in batches to avoid blocking
  const BATCH_SIZE = 5
  for (let i = 0; i < mdFiles.length; i += BATCH_SIZE) {
    const batch = mdFiles.slice(i, i + BATCH_SIZE)
    
    // Process batch in parallel
    await Promise.all(batch.map(async (f) => {
      try {
        const content = await invoke('read_file_content', { path: f.path })
        if (!content || typeof content !== 'string') return
        
        const seen = new Set()
        let match
        linkRe.lastIndex = 0 // Reset regex state
        
        while ((match = linkRe.exec(content)) !== null) {
          const target = match[1]?.trim()
          if (!target) continue
          
          const resolved = resolveTarget(target, f.path, files)
          if (resolved && !seen.has(resolved) && resolved !== f.path) {
            edges.push({ source: f.path, target: resolved })
            seen.add(resolved)
          }
        }
      } catch (e) {
        console.warn('[graph] read failed:', f.path, e)
      }
    }))
    
    // Yield control to prevent blocking UI
    if (i + BATCH_SIZE < mdFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  console.log(`[graph] Built graph: ${nodes.length} nodes, ${edges.length} edges`)
  return { nodes, edges }
}

