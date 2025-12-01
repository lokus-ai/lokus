import { describe, it, expect, vi, beforeEach } from 'vitest'
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { readConfig, updateConfig } from '../config/store'
import platformService from '../../services/platform/PlatformService'

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregisterAll: vi.fn()
}))

vi.mock('../config/store', () => ({
  readConfig: vi.fn(),
  updateConfig: vi.fn()
}))

vi.mock('../../services/platform/PlatformService', () => ({
  default: {
    getShortcuts: vi.fn(),
    isWindows: vi.fn(),
    isMacOS: vi.fn()
  }
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn()
}))

describe('ShortcutRegistry', () => {
  let registry

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    // Mock window for Tauri detection BEFORE importing registry
    global.window = {
      __TAURI_INTERNALS__: { invoke: vi.fn() },
      dispatchEvent: vi.fn(),
      location: { hostname: 'localhost' }
    }

    readConfig.mockResolvedValue({})
    platformService.getShortcuts.mockResolvedValue({})

    // Dynamic import
    registry = await import('./registry')
  })

  it('gets active shortcuts with defaults', async () => {
    const shortcuts = await registry.getActiveShortcuts()
    expect(shortcuts['save-file']).toBe('CommandOrControl+S')
  })

  it('overrides shortcuts from config', async () => {
    readConfig.mockResolvedValue({
      shortcuts: { 'save-file': 'Ctrl+S' }
    })

    const shortcuts = await registry.getActiveShortcuts()
    expect(shortcuts['save-file']).toBe('Ctrl+S')
  })

  it('registers global shortcuts', async () => {
    // Need to bypass dev check
    // registry.js checks: if (DISABLE_GLOBAL_SHORTCUTS_IN_DEV && ... hostname === 'localhost')
    // So we need to change hostname or disable the check.
    // Since DISABLE_GLOBAL_SHORTCUTS_IN_DEV is const, we can't change it.
    // We must change hostname.
    global.window.location.hostname = 'production'

    await registry.registerGlobalShortcuts()

    expect(unregisterAll).toHaveBeenCalled()
    expect(register).toHaveBeenCalled()
  })

  it('skips dangerous shortcuts', async () => {
    global.window.location.hostname = 'production'

    // Mock a dangerous shortcut
    readConfig.mockResolvedValue({
      shortcuts: { 'custom-action': 'CommandOrControl+C' } // Copy
    })

    await registry.registerGlobalShortcuts()

    // Verify register was NOT called with CommandOrControl+C
    const calls = register.mock.calls
    const registeredAccelerators = calls.map(call => call[0])
    expect(registeredAccelerators).not.toContain('CommandOrControl+C')
  })

  it('updates shortcut config', async () => {
    await registry.setShortcut('save-file', 'Ctrl+Alt+S')

    expect(updateConfig).toHaveBeenCalledWith({
      shortcuts: { 'save-file': 'Ctrl+Alt+S' }
    })
  })

  it('formats accelerators correctly', () => {
    platformService.isMacOS.mockReturnValue(true)
    expect(registry.formatAccelerator('CommandOrControl+S')).toBe('⌘S')

    platformService.isMacOS.mockReturnValue(false)
    platformService.isWindows.mockReturnValue(true)
    expect(registry.formatAccelerator('CommandOrControl+S')).toBe('Ctrl+S')
  })
})
