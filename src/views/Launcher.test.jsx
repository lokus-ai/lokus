import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { state, closeMock } = vi.hoisted(() => ({
  state: { label: 'launcher-1' },
  closeMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: state.label, close: closeMock }),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => { }),
  emit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn().mockResolvedValue('/home/user'),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../core/theme/manager.js', () => ({
  readGlobalVisuals: vi.fn().mockResolvedValue({ theme: null }),
  setGlobalActiveTheme: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../core/workspace/manager.js', () => ({
  WorkspaceManager: {
    saveWorkspacePath: vi.fn().mockResolvedValue(true),
    validatePath: vi.fn().mockResolvedValue(true),
    checkNeedsReauth: vi.fn().mockResolvedValue(false),
  },
}))

vi.mock('../core/sync/SyncEngine.js', () => ({
  syncEngine: { getSyncedWorkspace: vi.fn().mockResolvedValue(null) },
}))

vi.mock('../core/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, isGuest: true }),
}))

vi.mock('../platform/index.js', () => ({
  isMobile: () => false,
  isDesktop: () => true,
  // PlatformService calls this in its constructor at import time, and the
  // Launcher pulls it in for the modifier glyph on its keyboard hints.
  getPlatform: () => 'macos',
}))

import { invoke } from '@tauri-apps/api/core'
import { openWorkspace } from './Launcher.jsx'
import { __resetWindowContext } from '../core/window/context.js'

describe('Launcher openWorkspace', () => {
  beforeEach(() => {
    __resetWindowContext()
    closeMock.mockClear()
    invoke.mockReset()
    state.label = 'launcher-1'
    // Make the desktop-Tauri detection in openWorkspace pass.
    window.__TAURI_INTERNALS__ = { invoke: vi.fn() }
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    delete window.__TAURI_INTERNALS__
  })

  it('closes the current launcher window after a successful open', async () => {
    invoke.mockResolvedValue(undefined)

    await openWorkspace('/tmp/notes')

    expect(invoke).toHaveBeenCalledWith('open_workspace_window', { workspacePath: '/tmp/notes' })
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('closes the main bootstrap window when it shows the launcher route', async () => {
    invoke.mockResolvedValue(undefined)
    state.label = 'main'

    await openWorkspace('/tmp/notes')

    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('does not close a workspace window after a successful open', async () => {
    invoke.mockResolvedValue(undefined)
    state.label = 'ws-notes-1a2b3c4d'

    await openWorkspace('/tmp/notes')

    expect(closeMock).not.toHaveBeenCalled()
  })

  it('does not close the window when the open fails', async () => {
    invoke.mockRejectedValue(new Error('boom'))

    await expect(openWorkspace('/tmp/notes')).rejects.toThrow('boom')

    expect(closeMock).not.toHaveBeenCalled()
  })
})
