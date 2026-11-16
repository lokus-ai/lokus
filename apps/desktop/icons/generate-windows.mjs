/** @part-of desktop */
// From the repo root: node apps/desktop/icons/generate-windows.mjs
// Uses the Tauri CLI pinned by pnpm-lock.yaml (pnpm install --frozen-lockfile).
// Keep the original SVG and Unix icons: macOS uses the PNG's alpha as a tray template.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const icons = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(icons, '../../..')
const source = readFileSync(path.join(icons, 'lokus-logo.svg'), 'utf8')
const mark = source.match(/<path d="([^"]+)" fill="currentColor"\/>/)
if (!mark) throw new Error('Expected the original single-path Lokus mark')

// The black path is unchanged. Draw white behind it so its edge survives a dark taskbar,
// without a rectangular tile or a theme-dependent runtime swap. Leave room for the stroke.
const outlined = `<svg width="512" height="512" viewBox="-16 -16 512 527" xmlns="http://www.w3.org/2000/svg">
<path d="${mark[1]}" fill="white" stroke="white" stroke-width="32" stroke-linejoin="round"/>
<path d="${mark[1]}" fill="black"/>
</svg>
`
const temporary = mkdtempSync(path.join(tmpdir(), 'lokus-windows-icon-'))
try {
  const input = path.join(temporary, 'windows.svg')
  const output = path.join(temporary, 'icons')
  writeFileSync(input, outlined)
  execFileSync(process.execPath, [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
    'icon', input, '--output', output], { cwd: root, stdio: 'inherit' })
  // Windows embeds this ICO in the executable; the window and tray read that resource.
  // Do not copy the other generated platforms over their original assets.
  copyFileSync(path.join(output, 'icon.ico'), path.join(icons, 'icon.ico'))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
