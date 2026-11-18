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
      // Every line naming the field: the one published is the last, and each must fit.
      for (const [, raw] of head.matchAll(new RegExp(`^${field}:(.*)$`, 'gm'))) {
        const value = raw.trim().replace(/^(["'])(.*)\1$/, '$2')
        const length = [...value].length
        if (length > limit) errors.push(`news/${name}: ${field} is ${length} characters, the relay takes ${limit}`)
      }
    }
  }
  return errors
}
