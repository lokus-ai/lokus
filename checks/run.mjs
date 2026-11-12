/** @part-of checks */
import path from 'node:path'
import { repoRoot } from './lib.mjs'
import { check as uiBridgeOnly } from './rules/ui-bridge-only.mjs'
import { check as corePure } from './rules/core-pure.mjs'
import { check as fidelity } from './rules/fidelity.mjs'
import { check as partMarkers } from './rules/part-markers.mjs'
import { warnings } from './rules/warnings.mjs'

// Usage: node checks/run.mjs [--root <dir>] [--skip fidelity]
const args = process.argv.slice(2)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const root = path.resolve(option('--root') ?? repoRoot)
const skip = new Set((option('--skip') ?? '').split(',').filter(Boolean))

const checks = [
  ['ui-bridge-only', uiBridgeOnly],
  ['core-pure', corePure],
  ['fidelity', fidelity],
  ['part-markers', partMarkers],
]

let failed = false
for (const [name, check] of checks) {
  if (skip.has(name)) {
    console.log(`skip  ${name}`)
    continue
  }
  const errors = check(root)
  console.log(`${errors.length ? 'FAIL' : 'ok  '}  ${name}${errors.length ? ` (${errors.length})` : ''}`)
  for (const error of errors) console.log(`        ${error}`)
  if (errors.length) failed = true
}
for (const warning of warnings(root)) console.log(`warn  ${warning}`)
process.exit(failed ? 1 : 0)
