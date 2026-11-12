/** @part-of checks */
import { walk, read } from '../lib.mjs'

const banned = [
  [/from\s+['"]@tauri-apps\//, 'imports @tauri-apps'],
  [/import\s*\(\s*['"]@tauri-apps\//, 'imports @tauri-apps'],
  [/from\s+['"]@supabase\//, 'imports @supabase'],
  [/from\s+['"]posthog-js/, 'imports posthog-js'],
  [/(^|[^.\w])fetch\s*\(/, 'calls fetch()'],
  [/new\s+WebSocket\s*\(/, 'opens a WebSocket'],
  [/XMLHttpRequest/, 'uses XMLHttpRequest'],
]

/** Rule 1: the UI reaches Rust and the network only through ui/src/bridge/. */
export function check(root) {
  const errors = []
  for (const file of walk(root, 'ui/src')) {
    if (file.startsWith('ui/src/bridge/') || !/\.(ts|tsx|mjs|js|jsx)$/.test(file)) continue
    read(root, file).split('\n').forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      for (const [pattern, what] of banned) {
        if (pattern.test(line)) errors.push(`${file}:${index + 1} ${what}; move it behind ui/src/bridge/`)
      }
    })
  }
  return errors
}
