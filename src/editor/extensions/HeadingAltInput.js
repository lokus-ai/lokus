import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/pm/inputrules'

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Adds an alternative heading shortcut using a repeated marker (e.g., ^^^ + space)
export default function HeadingAltInput({ marker = '^' } = {}) {
  const m = String(marker || '').trim()
  if (!m || m.length !== 1) return Extension.create({ name: 'headingAltInput' })
  const esc = escapeRegExp(m)
  const re = new RegExp(`^(?:${esc}{1,6})\s$`)

  return Extension.create({
    name: 'headingAltInput',
    addInputRules() {
      return [
        new InputRule({
          find: re,
          handler: ({ chain, range, state }) => {
            const text = state.doc.textBetween(range.from, range.to)
            const hashes = text.trim().split(/\s+/)[0]
            const level = Math.max(1, Math.min(6, hashes.length))
            chain().deleteRange(range).setNode('heading', { level }).run()
          },
        }),
      ]
    },
  })
}
