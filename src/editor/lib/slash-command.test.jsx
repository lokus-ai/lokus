import { describe, it, expect } from 'vitest'
import slashCommand from './slash-command.jsx'

describe('slash command items', () => {
  it('includes Table even when editor not ready', () => {
    const groups = slashCommand.items({ query: 'tab', editor: null })
    const all = groups.flatMap(g => g.commands.map(c => c.title))
    expect(all.some(t => /table/i.test(t))).toBe(true)
  })
})

