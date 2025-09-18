import { describe, it, expect, beforeEach } from 'vitest'
import { readConfig, writeConfig, updateConfig, getGlobalConfigPath } from './store.js'

describe('config store (browser fallback)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses a browser path when not in Tauri', async () => {
    const p = await getGlobalConfigPath()
    expect(p).toBe('config.json')
  })

  it('reads/writes config via localStorage', async () => {
    await writeConfig({ a: 1 })
    const cfg = await readConfig()
    expect(cfg).toEqual({ a: 1 })
  })

  it('merges updates', async () => {
    await writeConfig({ a: 1 })
    const next = await updateConfig({ b: 2 })
    expect(next).toEqual({ a: 1, b: 2 })
    const roundtrip = await readConfig()
    expect(roundtrip).toEqual({ a: 1, b: 2 })
  })
})
