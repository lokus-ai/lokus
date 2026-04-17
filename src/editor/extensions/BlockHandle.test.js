/**
 * BlockHandle.test.js
 *
 * Basic unit tests for the BlockHandle ProseMirror plugin.
 * Uses jsdom (configured in vitest.config.js) + a real EditorView.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Plugin } from 'prosemirror-state'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { lokusSchema } from '../schema/lokus-schema.js'
import { createBlockHandlePlugin, blockHandleKey } from './BlockHandle.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDoc(content = []) {
  return lokusSchema.nodeFromJSON({
    type: 'doc',
    content: content.length
      ? content
      : [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
  })
}

function createView(doc) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)

  const state = EditorState.create({
    schema: lokusSchema,
    doc,
    plugins: [createBlockHandlePlugin()],
  })

  const view = new EditorView(mount, { state })
  return { view, mount }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBlockHandlePlugin()', () => {
  it('returns a ProseMirror Plugin instance', () => {
    const plugin = createBlockHandlePlugin()
    expect(plugin).toBeInstanceOf(Plugin)
  })

  it('has the expected PluginKey', () => {
    const plugin = createBlockHandlePlugin()
    expect(plugin.spec.key).toBe(blockHandleKey)
  })
})

describe('BlockHandleView — DOM initialisation', () => {
  let view
  let mount

  beforeEach(() => {
    const result = createView(buildDoc())
    view = result.view
    mount = result.mount
  })

  afterEach(() => {
    if (view) view.destroy()
    if (mount.parentElement) mount.parentElement.removeChild(mount)
    // Clean up any orphaned handles from body
    document.querySelectorAll('.block-handle').forEach(el => el.remove())
  })

  it('appends exactly one .block-handle element to document.body', () => {
    const handles = document.body.querySelectorAll('.block-handle')
    expect(handles.length).toBe(1)
  })

  it('the handle is initially hidden (no --visible class)', () => {
    const handle = document.body.querySelector('.block-handle')
    expect(handle.classList.contains('block-handle--visible')).toBe(false)
  })

  it('the handle contains a grip element and a plus button', () => {
    const handle = document.body.querySelector('.block-handle')
    expect(handle.querySelector('.block-handle__grip')).toBeTruthy()
    expect(handle.querySelector('.block-handle__plus')).toBeTruthy()
  })

  it('the grip element has 6 dot children', () => {
    const grip = document.body.querySelector('.block-handle__grip')
    const dots = grip.querySelectorAll('.block-handle__dot')
    expect(dots.length).toBe(6)
  })

  it('the grip is draggable', () => {
    const grip = document.body.querySelector('.block-handle__grip')
    expect(grip.getAttribute('draggable')).toBe('true')
  })

  it('removes the handle element when the view is destroyed', () => {
    view.destroy()
    view = null
    const handles = document.body.querySelectorAll('.block-handle')
    expect(handles.length).toBe(0)
  })
})

describe('BlockHandleView — multiple plugin instances', () => {
  it('each EditorView gets its own handle element', () => {
    const doc = buildDoc()

    const mount1 = document.createElement('div')
    const mount2 = document.createElement('div')
    document.body.appendChild(mount1)
    document.body.appendChild(mount2)

    const state1 = EditorState.create({
      schema: lokusSchema,
      doc,
      plugins: [createBlockHandlePlugin()],
    })
    const state2 = EditorState.create({
      schema: lokusSchema,
      doc,
      plugins: [createBlockHandlePlugin()],
    })

    const view1 = new EditorView(mount1, { state: state1 })
    const view2 = new EditorView(mount2, { state: state2 })

    const handles = document.body.querySelectorAll('.block-handle')
    expect(handles.length).toBe(2)
    expect(handles[0]).not.toBe(handles[1])

    view1.destroy()
    view2.destroy()
    mount1.remove()
    mount2.remove()
    // Clean up remaining handles
    document.querySelectorAll('.block-handle').forEach(el => el.remove())
  })
})
