import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyTokens, setGlobalActiveTheme, readGlobalVisuals } from './manager.js'
import { writeConfig } from '../config/store.js'

// Mock Tauri APIs for browser environment
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
  join: vi.fn().mockImplementation((...paths) => paths.join('/'))
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(false),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn()
}))

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

  it('sets theme', async () => {
    await setGlobalActiveTheme('dracula')
    const v = await readGlobalVisuals()
    expect(v.theme).toBe('dracula')
  })
})

