// Simple resolver for Obsidian-style wiki targets
// Supports:
// - Remote: http(s) URLs
// - Data URLs: data:image/...;base64,...
// - Otherwise: treat as internal link (href only)

const IMAGE_EXTS = [
  'png','jpg','jpeg','gif','webp','svg','bmp','tiff','avif'
]

export function isRemoteUrl(s) {
  return /^https?:\/\//i.test(s)
}

export function isDataUrl(s) {
  return /^data:/i.test(s)
}

export function hasImageExt(s) {
  const m = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(s || '')
  return !!m && IMAGE_EXTS.includes((m[1] || '').toLowerCase())
}

function extToMime(p) {
  const ext = (p.split('.').pop() || '').toLowerCase()
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff', avif: 'image/avif'
  }
  return map[ext] || 'application/octet-stream'
}

function isAbsolutePath(p) {
  return /^\//.test(p) || /^[a-zA-Z]:\\/.test(p)
}

async function readLocalAsDataUrl(p) {
  // Tauri FS read if permitted
  try {
    const w = typeof window !== 'undefined' ? window : undefined
    const isTauri = !!(w && (w.__TAURI_INTERNALS__?.invoke || w.__TAURI_METADATA__))
    if (!isTauri) return ''
    const fs = await import('@tauri-apps/plugin-fs')
    const { readFile } = fs
    const data = await readFile(p)
    if (!data) return ''
    // data is Uint8Array
    let binary = ''
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
    const b64 = btoa(binary)
    return `data:${extToMime(p)};base64,${b64}`
  } catch {
    return ''
  }
}

export async function resolveWikiTarget(target) {
  if (!target) return { href: '', src: '', isImage: false }
  const t = String(target).trim()
  if (isRemoteUrl(t) || isDataUrl(t)) {
    return { href: t, src: t, isImage: isDataUrl(t) || hasImageExt(t) }
  }
  // Dev heuristic: if absolute path includes /src/assets/, map to dev server URL
  try {
    if (typeof window !== 'undefined' && /\/src\/assets\//.test(t)) {
      const rel = t.substring(t.indexOf('/src/assets/'))
      const url = `${window.location.origin}${rel}`
      return { href: url, src: url, isImage: true }
    }
  } catch {}

  // If absolute path and in Tauri, try file read -> data URL
  if (isAbsolutePath(t) && hasImageExt(t)) {
    const dataUrl = await readLocalAsDataUrl(t)
    if (dataUrl) return { href: t, src: dataUrl, isImage: true }
  }
  // Relative path within workspace (Tauri)
  try {
    const w = typeof window !== 'undefined' ? window : undefined
    const ws = w?.__LOKUS_WORKSPACE_PATH__
    const isTauri = !!(w && (w.__TAURI_INTERNALS__?.invoke || w.__TAURI_METADATA__))
    if (ws && isTauri && hasImageExt(t)) {
      const { join } = await import('@tauri-apps/api/path')
      const abs = await join(ws, t)
      const dataUrl = await readLocalAsDataUrl(abs)
      if (dataUrl) return { href: abs, src: dataUrl, isImage: true }
    }
  } catch {}
  // Fallback: internal note/file; no src
  return { href: t, src: '', isImage: hasImageExt(t) }
}
