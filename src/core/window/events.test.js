import { describe, it, expect, vi } from 'vitest'

const { listen } = vi.hoisted(() => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

vi.mock('@tauri-apps/api/event', () => ({ listen }))

vi.mock('./context.js', () => ({
  getWindowContext: () => ({
    label: 'ws-notes-deadbeef',
    kind: 'workspace',
    workspacePath: '/Users/pratham/notes',
  }),
}))

import { listenWindow } from './events.js'

describe('listenWindow', () => {
  it('subscribes scoped to the current window, never Any', async () => {
    const handler = () => {}
    await listenWindow('workspace:activate', handler)
    expect(listen).toHaveBeenCalledWith('workspace:activate', handler, {
      target: { kind: 'Window', label: 'ws-notes-deadbeef' },
    })
  })

  it('resolves to the underlying unlisten function', async () => {
    const unlisten = await listenWindow('some-event', () => {})
    expect(typeof unlisten).toBe('function')
  })
})
