/** @part-of checks */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadParts, repoRoot } from './lib.mjs'

export function renderMap(root) {
  const rows = loadParts(root).map(
    (part) => `| ${part.description} | ${part.paths.map((p) => `\`${p}\``).join(', ')} | \`${part.id}\` |`,
  )
  return [
    '# MAP: this kind of change goes here',
    '',
    '> Generated from `parts.json` by `node checks/gen-map.mjs`. Do not edit by hand.',
    '> If a directory is not listed, it is not approved: add a part to `parts.json` first.',
    '',
    '| What you are changing | Where it lives | Part |',
    '|---|---|---|',
    ...rows,
    '',
    'Every source file starts with its part marker: `//! @part-of <part>` in Rust,',
    '`/** @part-of <part> */` in TypeScript and JavaScript. The longest matching path wins.',
    '',
  ].join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(path.join(repoRoot, 'MAP.md'), renderMap(repoRoot))
  console.log('wrote MAP.md')
}
