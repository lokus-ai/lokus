import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PluginStateManager } from './PluginStateManager'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('PluginStateManager', () => {
  let manager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new PluginStateManager()
    manager.logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  })

  afterEach(() => {
    manager.shutdown()
  })

  it('initializes correctly', async () => {
    invoke.mockResolvedValueOnce([
      { manifest: { name: 'plugin1', version: '1.0.0' } }
    ]) // list_plugins
      .mockResolvedValueOnce(['plugin1']) // get_enabled_plugins

    // Mock window properties for Tauri detection
    global.window.__TAURI_INTERNALS__ = { invoke: vi.fn() }

    await manager.initialize()

    expect(manager.isInitialized).toBe(true)
    expect(manager.plugins.has('plugin1')).toBe(true)
    expect(manager.enabledPlugins.has('plugin1')).toBe(true)
  })

  it('toggles plugin state', async () => {
    // Setup initial state
    manager.plugins.set('plugin1', {
      getData: () => ({ enabled: false }),
      setEnabled: vi.fn()
    })

    // Mock window properties for Tauri detection
    global.window.__TAURI_INTERNALS__ = { invoke: vi.fn() }

    invoke.mockResolvedValue('success')

    const result = await manager.togglePlugin('plugin1', true)

    expect(result.success).toBe(true)
    expect(result.enabled).toBe(true)
    expect(invoke).toHaveBeenCalledWith('enable_plugin', { name: 'plugin1' })
  })

  it('prevents concurrent toggles', async () => {
    manager.plugins.set('plugin1', {
      getData: () => ({ enabled: false }),
      setEnabled: vi.fn()
    })

    // Mock long running operation
    manager._performToggleOperation = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return { success: true }
    })

    const p1 = manager.togglePlugin('plugin1', true)
    const p2 = manager.togglePlugin('plugin1', false)

    await Promise.all([p1, p2])

    // Should have waited for lock
    expect(manager._performToggleOperation).toHaveBeenCalledTimes(2)
  })

  it('handles installation', async () => {
    const pluginData = {
      name: 'new-plugin',
      version: '1.0.0'
    }

    await manager.installPlugin('new-plugin', pluginData)

    expect(manager.plugins.has('new-plugin')).toBe(true)
    expect(manager.getPlugin('new-plugin').enabled).toBe(false)
  })

  it('handles uninstallation', async () => {
    manager.plugins.set('plugin1', { getData: () => ({}) })
    manager.enabledPlugins.add('plugin1')

    await manager.uninstallPlugin('plugin1')

    expect(manager.plugins.has('plugin1')).toBe(false)
    expect(manager.enabledPlugins.has('plugin1')).toBe(false)
  })
})
