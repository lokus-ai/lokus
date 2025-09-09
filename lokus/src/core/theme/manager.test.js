import { describe, it, expect, beforeEach } from 'vitest'
import { applyTokens, setGlobalVisuals, readGlobalVisuals } from './manager.js'
import { writeConfig } from '../config/store.js'

describe('theme manager (browser mode)', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    for (const k of ['--bg','--text','--panel','--border','--muted','--accent']) {
      document.documentElement.style.removeProperty(k)
    }
    await writeConfig({})
  })

  it('applies CSS variables', () => {
    applyTokens({ '--accent': '255 0 0' })
    expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe('255 0 0')
  })

  it('sets visuals and data-theme', async () => {
    await setGlobalVisuals({ mode: 'dark', accent: '10 20 30' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe('10 20 30')
    const v = await readGlobalVisuals()
    expect(v.mode).toBe('dark')
  })
})

