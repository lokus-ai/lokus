/** @part-of checks */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { walk, read } from '../lib.mjs'
import { renderMap } from '../gen-map.mjs'

const roots = ['crates', 'apps', 'ui', 'checks']
const leftoverName = /(_v2|legacy|\.bak|\.old)/i

/** Nudges that never fail the build. */
export function warnings(root) {
  const out = []
  for (const file of roots.flatMap((dir) => walk(root, dir))) {
    if (leftoverName.test(path.basename(file))) out.push(`${file}: name suggests a leftover copy (strip, then replace)`)
    if (!/\.(rs|ts|tsx|mjs|css)$/.test(file)) continue
    const lines = read(root, file).split('\n').length
    if (lines > 1000) out.push(`${file}: ${lines} lines; consider splitting`)
  }
  try {
    if (readFileSync(path.join(root, 'MAP.md'), 'utf8') !== renderMap(root)) {
      out.push('MAP.md is out of date; run `node checks/gen-map.mjs`')
    }
  } catch {
    out.push('MAP.md is missing; run `node checks/gen-map.mjs`')
  }
  return out
}
