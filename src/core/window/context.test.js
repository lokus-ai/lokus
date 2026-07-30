import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { label: 'main' },
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: state.label }),
}))

import {
  getWindowContext,
  isWorkspaceWindow,
  isLauncherWindow,
  isPrefsWindow,
  __resetWindowContext,
} from './context.js'

function setSearch(search) {
  window.history.replaceState({}, '', search ? `/${search}` : '/')
}

describe('window context', () => {
  beforeEach(() => {
    __resetWindowContext()
    state.label = 'main'
    setSearch('')
    localStorage.clear()
  })

  it('detects the prefs window by label', () => {
    state.label = 'prefs'
    const ctx = getWindowContext()
    expect(ctx).toEqual({ label: 'prefs', kind: 'prefs', workspacePath: null })
    expect(isPrefsWindow()).toBe(true)
    expect(isWorkspaceWindow()).toBe(false)
    expect(isLauncherWindow()).toBe(false)
  })

  it('detects the prefs window by ?view=prefs regardless of label', () => {
    state.label = 'main'
    setSearch('?view=prefs')
    expect(getWindowContext().kind).toBe('prefs')
  })

  it('detects a workspace window from a ws-* label with ?workspacePath=', () => {
    state.label = 'ws-notes-1a2b3c4d'
    setSearch('?workspacePath=%2FUsers%2Fme%2Fnotes')
    const ctx = getWindowContext()
    expect(ctx.kind).toBe('workspace')
    expect(ctx.workspacePath).toBe('/Users/me/notes')
    expect(isWorkspaceWindow()).toBe(true)
  })

  it('detects a workspace window from ?workspacePath= even on the main label', () => {
    state.label = 'main'
    setSearch('?workspacePath=/work/notes')
    const ctx = getWindowContext()
    expect(ctx.kind).toBe('workspace')
    expect(ctx.workspacePath).toBe('/work/notes')
  })

  it('detects a launcher window from a launcher-* label with ?forceWelcome=true', () => {
    state.label = 'launcher-1700000000000'
    setSearch('?forceWelcome=true')
    const ctx = getWindowContext()
    expect(ctx.kind).toBe('launcher')
    expect(ctx.workspacePath).toBe(null)
    expect(isLauncherWindow()).toBe(true)
  })

  it('keeps a forceWelcome window as launcher even when a workspace is saved', () => {
    // A saved workspace must not flip a launcher window to kind "workspace":
    // the kind comes from the window's own URL/label, never from saved state.
    localStorage.setItem('lokus.workspace.path', '/Users/me/school')
    state.label = 'launcher-1700000000000'
    setSearch('?forceWelcome=true')
    const ctx = getWindowContext()
    expect(ctx.kind).toBe('launcher')
    expect(isLauncherWindow()).toBe(true)
    expect(isWorkspaceWindow()).toBe(false)
  })

  it('treats the main bootstrap window with no params as a launcher', () => {
    state.label = 'main'
    expect(getWindowContext().kind).toBe('launcher')
  })

  it('caches the context after the first resolve', () => {
    state.label = 'main'
    const first = getWindowContext()
    state.label = 'prefs'
    setSearch('?view=prefs')
    expect(getWindowContext()).toBe(first)
  })
})
