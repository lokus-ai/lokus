import { describe, it, expect } from 'vitest'
import { listActions, getActiveShortcuts, formatAccelerator, eventToAccelerator } from './registry.js'
import { writeConfig } from '../config/store.js'

describe('shortcuts (non-Tauri)', () => {
  it('lists actions and defaults', async () => {
    const actions = listActions()
    expect(actions.length).toBeGreaterThan(3)
    await writeConfig({})
    const map = await getActiveShortcuts()
    expect(map['save-file']).toMatch(/\+S$/)
  })

  it('formats accelerators', () => {
    const pretty = formatAccelerator('CommandOrControl+Shift+F')
    expect(pretty).toBeTruthy()
  })

  it('captures keyboard events to accelerators', () => {
    const e = new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true })
    const acc = eventToAccelerator(e)
    expect(acc).toContain('Shift')
  })
})
