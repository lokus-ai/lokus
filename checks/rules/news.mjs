/** @part-of checks */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { read } from '../lib.mjs'

// The relay refuses a longer title or summary, and it says so only after the release is built.
const limits = { title: 120, summary: 300 }

/** A news post's title and summary fit what the relay accepts. */
export function check(root) {
  if (!existsSync(path.join(root, 'news'))) return []
  const errors = []
  for (const name of readdirSync(path.join(root, 'news')).filter((n) => n.endsWith('.md'))) {
    const head = read(root, `news/${name}`).split('\n---')[0]
    for (const [field, limit] of Object.entries(limits)) {
      const value = head.match(new RegExp(`^${field}:(.*)$`, 'm'))?.[1].trim() ?? ''
      const length = [...value].length
      if (length > limit) errors.push(`news/${name}: ${field} is ${length} characters, the relay takes ${limit}`)
    }
  }
  return errors
}
