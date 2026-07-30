import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Registry of captured event listeners so tests can fire Tauri events by hand.
const { listeners, listenOptions, validatePath, getValidatedWorkspacePath, saveWorkspacePath } = vi.hoisted(() => ({
  listeners: new Map(),
  listenOptions: new Map(),
  validatePath: vi.fn(),
  getValidatedWorkspacePath: vi.fn(),
  saveWorkspacePath: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name, cb, options) => {
    listeners.set(name, cb)
    listenOptions.set(name, options)
    return Promise.resolve(() => { listeners.delete(name); listenOptions.delete(name) })
  }),
}))

vi.mock('../core/workspace/manager.js', () => ({
  WorkspaceManager: {
    validatePath: (...args) => validatePath(...args),
    getValidatedWorkspacePath: (...args) => getValidatedWorkspacePath(...args),
    saveWorkspacePath: (...args) => saveWorkspacePath(...args),
  },
}))

import { useWorkspaceActivation } from './useWorkspaceActivation.js'

const SAVED_WORKSPACE = '/Users/pratham/School'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('useWorkspaceActivation', () => {
  beforeEach(() => {
    listeners.clear()
    listenOptions.clear()
    validatePath.mockReset()
    getValidatedWorkspacePath.mockReset()
    saveWorkspacePath.mockReset().mockResolvedValue(true)
    // Make the hook's Tauri detection pass so it registers event listeners.
    window.__TAURI_INTERNALS__ = { invoke: vi.fn() }
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    delete window.__TAURI_INTERNALS__
    window.history.replaceState({}, '', '/')
  })

  it('keeps a forceWelcome window on the launcher even when a workspace is saved', async () => {
    window.history.replaceState({}, '', '/?forceWelcome=true')
    getValidatedWorkspacePath.mockResolvedValue(SAVED_WORKSPACE)

    const { result } = renderHook(() => useWorkspaceActivation())

    // Give the hook enough time to run all 3 init attempts (50+100+150ms) —
    // the saved-path fallback must never run on a forceWelcome window.
    await sleep(500)

    expect(result.current).toBe(null)
    expect(getValidatedWorkspacePath).not.toHaveBeenCalled()
  })

  it('ignores workspace:activate events on a forceWelcome window', async () => {
    window.history.replaceState({}, '', '/?forceWelcome=true')
    getValidatedWorkspacePath.mockResolvedValue(SAVED_WORKSPACE)
    validatePath.mockResolvedValue(true)

    const { result } = renderHook(() => useWorkspaceActivation())
    await waitFor(() => expect(listeners.has('workspace:activate')).toBe(true))
    await sleep(100) // let init settle on the launcher route

    await act(async () => {
      await listeners.get('workspace:activate')({ payload: SAVED_WORKSPACE })
    })

    expect(result.current).toBe(null)
    // The event is rejected before any validation/activation work happens.
    expect(validatePath).not.toHaveBeenCalled()
  })

  it('activates the workspace from the workspacePath URL param', async () => {
    window.history.replaceState({}, '', '/?workspacePath=%2FUsers%2Fpratham%2Fnotes')
    validatePath.mockResolvedValue(true)
    getValidatedWorkspacePath.mockResolvedValue(SAVED_WORKSPACE)

    const { result } = renderHook(() => useWorkspaceActivation())

    await waitFor(() => expect(result.current).toBe('/Users/pratham/notes'))
    expect(validatePath).toHaveBeenCalledWith('/Users/pratham/notes')
    // URL param is primary: the saved-path fallback must not run.
    expect(getValidatedWorkspacePath).not.toHaveBeenCalled()
  })

  it('workspacePath URL param wins over forceWelcome', async () => {
    window.history.replaceState({}, '', '/?forceWelcome=true&workspacePath=%2FUsers%2Fpratham%2Fnotes')
    validatePath.mockResolvedValue(true)

    const { result } = renderHook(() => useWorkspaceActivation())

    await waitFor(() => expect(result.current).toBe('/Users/pratham/notes'))
  })

  it('still activates via workspace:activate events on a workspace window', async () => {
    window.history.replaceState({}, '', '/?workspacePath=%2FUsers%2Fpratham%2Fnotes')
    validatePath.mockResolvedValue(true)

    const { result } = renderHook(() => useWorkspaceActivation())
    await waitFor(() => expect(result.current).toBe('/Users/pratham/notes'))

    await act(async () => {
      await listeners.get('workspace:activate')({ payload: '/Users/pratham/other' })
    })

    expect(result.current).toBe('/Users/pratham/other')
  })

  it('restores the saved workspace on the bootstrap window (no URL params)', async () => {
    getValidatedWorkspacePath.mockResolvedValue(SAVED_WORKSPACE)

    const { result } = renderHook(() => useWorkspaceActivation())

    await waitFor(() => expect(result.current).toBe(SAVED_WORKSPACE), { timeout: 2000 })
  })

  it('stays on the launcher when no workspace is saved and no URL params exist', async () => {
    getValidatedWorkspacePath.mockResolvedValue(null)

    const { result } = renderHook(() => useWorkspaceActivation())

    await sleep(500)
    expect(result.current).toBe(null)
  })

  it('registers workspace:activate scoped to THIS window, not Any', async () => {
    // Regression: Rust emits workspace:activate via emit_to(<label>) at ONE
    // window. A bare listen() (target Any) receives events addressed to other
    // windows too — every open window used to switch to the newly opened
    // workspace. In jsdom there is no Tauri metadata, so the label resolves
    // to the fallback "main".
    renderHook(() => useWorkspaceActivation())

    await waitFor(() => expect(listenOptions.has('workspace:activate')).toBe(true))
    expect(listenOptions.get('workspace:activate')).toEqual({
      target: { kind: 'Window', label: 'main' },
    })
  })
})
