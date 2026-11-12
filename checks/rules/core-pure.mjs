/** @part-of checks */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { read } from '../lib.mjs'

const banned = new Set(['reqwest', 'hyper', 'axum', 'ureq', 'tungstenite', 'tokio-tungstenite', 'surf', 'isahc'])
const isBanned = (name) => name.startsWith('tauri') || banned.has(name)

/** Rule 2: lokus-core depends on neither Tauri nor a networking crate. */
export function check(root) {
  const manifest = 'crates/lokus-core/Cargo.toml'
  if (!existsSync(path.join(root, manifest))) return []
  const errors = []
  let inDependencies = false
  for (const raw of read(root, manifest).split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    const section = line.match(/^\[(.+)\]$/)
    if (section) {
      const name = section[1]
      const table = name.match(/dependencies\.([A-Za-z0-9_-]+)$/)
      if (table && isBanned(table[1])) errors.push(`${manifest}: depends on ${table[1]}`)
      inDependencies = /dependencies$/.test(name)
      continue
    }
    const key = line.match(/^([A-Za-z0-9_-]+)\s*(=|\.)/)
    if (inDependencies && key && isBanned(key[1])) errors.push(`${manifest}: depends on ${key[1]}`)
  }
  return errors
}
