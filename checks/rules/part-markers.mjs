/** @part-of checks */
import { walk, read, loadParts, partFor } from '../lib.mjs'

const roots = ['crates', 'apps/desktop/src', 'ui/src', 'checks']
const rustMarker = /^\/\/! @part-of (\S+)\s*$/
const scriptMarker = /^\/\*\* @part-of (\S+) \*\/\s*$/

/** Rule 4: every source file starts with the @part-of marker parts.json assigns to its folder. */
export function check(root) {
  const parts = loadParts(root)
  const errors = []
  for (const file of roots.flatMap((dir) => walk(root, dir))) {
    if (!/\.(rs|ts|tsx|mjs)$/.test(file) || file.endsWith('.d.ts')) continue
    const part = partFor(parts, file)
    if (!part) {
      errors.push(`${file}: no part in parts.json covers this path; add one or move the file`)
      continue
    }
    const firstLine = read(root, file).split('\n', 1)[0].replace(/^﻿/, '').replace(/\r$/, '')
    const found = firstLine.match(file.endsWith('.rs') ? rustMarker : scriptMarker)
    const expected = file.endsWith('.rs') ? `//! @part-of ${part.id}` : `/** @part-of ${part.id} */`
    if (!found) errors.push(`${file}: first line must be \`${expected}\``)
    else if (found[1] !== part.id) errors.push(`${file}: marked ${found[1]}, but parts.json says ${part.id}`)
  }
  return errors
}
