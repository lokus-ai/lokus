/** @part-of checks */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const skipDirs = new Set(['node_modules', 'target', 'dist', 'gen', 'fixtures', '.git'])

/** Repo-relative, forward-slash paths of every file under `dir` (missing dir = none). */
export function walk(root, dir) {
  const start = path.join(root, dir)
  if (!existsSync(start)) return []
  const out = []
  const visit = (abs) => {
    for (const name of readdirSync(abs)) {
      if (skipDirs.has(name)) continue
      const child = path.join(abs, name)
      if (statSync(child).isDirectory()) visit(child)
      else out.push(path.relative(root, child).split(path.sep).join('/'))
    }
  }
  visit(start)
  return out.sort()
}

export function read(root, file) {
  return readFileSync(path.join(root, file), 'utf8')
}

export function loadParts(root) {
  return JSON.parse(read(root, 'parts.json')).parts
}

/** The part whose path prefix is the longest match for `file`, or null. */
export function partFor(parts, file) {
  let best = null
  let bestLength = -1
  for (const part of parts) {
    for (const prefix of part.paths) {
      if (file.startsWith(prefix) && prefix.length > bestLength) {
        best = part
        bestLength = prefix.length
      }
    }
  }
  return best
}
