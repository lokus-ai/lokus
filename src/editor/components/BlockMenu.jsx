/**
 * BlockMenu.jsx
 *
 * Floating block context menu for Lokus.
 *
 * Rendered as a React portal attached to `document.body` so it always sits
 * above the editor content regardless of overflow or stacking context.
 *
 * Lifecycle:
 *   1. Phase 2 (BlockHandle plugin) dispatches `lokus:open-block-menu` on
 *      `document` with `{ pos, blockNode, view }` when the user clicks the
 *      drag-handle (⋮⋮).
 *   2. This component listens for that event, resolves the pixel coordinates,
 *      and renders the menu.
 *   3. The menu closes on: click outside, Escape key, or any menu action.
 *
 * The component is a singleton — mount it once inside your root layout and it
 * will respond to all `lokus:open-block-menu` events in the application.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  turnInto,
  duplicateBlock,
  deleteBlock,
  moveBlockUp,
  moveBlockDown,
  copyBlockLink,
  selectBlock,
} from '../commands/block-commands.js'
import { lokusSchema } from '../schema/lokus-schema.js'
import './BlockMenu.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Menu width in pixels — used for viewport-edge clamping. */
const MENU_WIDTH = 220
/** Minimum margin from viewport edges. */
const VIEWPORT_MARGIN = 8

// ---------------------------------------------------------------------------
// Turn-into submenu options
// ---------------------------------------------------------------------------

const TURN_INTO_OPTIONS = [
  { label: 'Paragraph', type: 'paragraph', attrs: {} },
  { label: 'Heading 1', type: 'heading', attrs: { level: 1 } },
  { label: 'Heading 2', type: 'heading', attrs: { level: 2 } },
  { label: 'Heading 3', type: 'heading', attrs: { level: 3 } },
  { label: 'Blockquote', type: 'blockquote', attrs: {} },
  { label: 'Code Block', type: 'codeBlock', attrs: {} },
  { label: 'Callout', type: 'callout', attrs: {} },
  // Lists are wrappers, not direct block types — handled separately below.
]

// ---------------------------------------------------------------------------
// Helper: clamp a position so the menu stays on-screen
// ---------------------------------------------------------------------------

function clampPosition(x, y, menuHeight = 300) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const clampedX = Math.min(Math.max(x, VIEWPORT_MARGIN), vw - MENU_WIDTH - VIEWPORT_MARGIN)
  const clampedY = Math.min(Math.max(y, VIEWPORT_MARGIN), vh - menuHeight - VIEWPORT_MARGIN)

  return { x: clampedX, y: clampedY }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * A single menu item rendered as a button.
 */
function MenuItem({ icon, label, shortcut, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      className={`block-menu-item${danger ? ' block-menu-item--danger' : ''}`}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()} // keep editor focus
    >
      {icon && <span className="block-menu-icon" aria-hidden="true">{icon}</span>}
      <span>{label}</span>
      {shortcut && <span className="block-menu-shortcut">{shortcut}</span>}
      {children}
    </button>
  )
}

/**
 * The "Turn into" item with a hover/focus submenu.
 */
function TurnIntoItem({ onSelect }) {
  const schema = lokusSchema

  return (
    <div className="block-menu-item block-menu-item--submenu" tabIndex={0}>
      <span className="block-menu-icon" aria-hidden="true">↩</span>
      <span>Turn into</span>
      <div className="block-menu-submenu" role="menu">
        {TURN_INTO_OPTIONS.map(({ label, type, attrs }) => {
          const nodeType = schema.nodes[type]
          if (!nodeType) return null
          return (
            <button
              key={label}
              type="button"
              className="block-menu-item"
              role="menuitem"
              onClick={() => onSelect(nodeType, attrs)}
              onMouseDown={(e) => e.preventDefault()}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BlockMenu (main component)
// ---------------------------------------------------------------------------

/**
 * Singleton floating block menu.
 *
 * Mount once anywhere in your component tree:
 * ```jsx
 * <BlockMenu />
 * ```
 */
export default function BlockMenu() {
  const [menu, setMenu] = useState(null) // null | { x, y, view, blockNode, pmPos }
  const menuRef = useRef(null)

  // -------------------------------------------------------------------------
  // Open / close
  // -------------------------------------------------------------------------

  const closeMenu = useCallback(() => setMenu(null), [])

  /** Handle the custom `lokus:open-block-menu` event from BlockHandle. */
  const handleOpenEvent = useCallback((e) => {
    const { pos, blockNode, view } = e.detail ?? {}
    if (!view || pos == null) return

    // Derive pixel coordinates from the ProseMirror position.
    let x = e.detail.clientX ?? 0
    let y = e.detail.clientY ?? 0

    // If the event carries a DOM reference to the handle, use its rect.
    if (e.detail.handleEl instanceof Element) {
      const rect = e.detail.handleEl.getBoundingClientRect()
      x = rect.right + 4
      y = rect.top
    } else if (view.coordsAtPos) {
      // Fall back to PM coords for the block position.
      try {
        const coords = view.coordsAtPos(pos)
        x = coords.left
        y = coords.bottom + 4
      } catch {
        // coordsAtPos can throw for out-of-range positions — ignore.
      }
    }

    const { x: cx, y: cy } = clampPosition(x, y)

    setMenu({
      x: cx,
      y: cy,
      view,
      blockNode,
      pmPos: pos,
    })
  }, [])

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------

  useEffect(() => {
    document.addEventListener('lokus:open-block-menu', handleOpenEvent)
    return () => {
      document.removeEventListener('lokus:open-block-menu', handleOpenEvent)
    }
  }, [handleOpenEvent])

  /** Close on Escape key. */
  useEffect(() => {
    if (!menu) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeMenu()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [menu, closeMenu])

  /** Close on click outside the menu. */
  useEffect(() => {
    if (!menu) return
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu()
      }
    }
    // Use `pointerdown` so we catch the event before any click handler.
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menu, closeMenu])

  // -------------------------------------------------------------------------
  // Command runners
  // -------------------------------------------------------------------------

  /**
   * Execute a PM command against the current view state and close the menu.
   * @param {Function} command - standard PM command (state, dispatch, view) => bool
   */
  const run = useCallback((command) => {
    if (!menu?.view) return
    const { view } = menu
    command(view.state, view.dispatch, view)
    closeMenu()
    // Return focus to editor.
    view.focus()
  }, [menu, closeMenu])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!menu) return null

  const { x, y, view } = menu

  return createPortal(
    <div
      ref={menuRef}
      className="block-menu"
      role="menu"
      aria-label="Block options"
      style={{ left: x, top: y }}
      // Prevent the menu from stealing editor focus on mouse interaction.
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Turn into */}
      <TurnIntoItem
        onSelect={(nodeType, attrs) => {
          run(turnInto(nodeType, attrs))
        }}
      />

      <div className="block-menu-divider" />

      {/* Duplicate */}
      <MenuItem
        icon="⎘"
        label="Duplicate"
        shortcut="⌘⇧D"
        onClick={() => run(duplicateBlock)}
      />

      {/* Copy link to block */}
      <MenuItem
        icon="🔗"
        label="Copy link to block"
        onClick={() => run(copyBlockLink)}
      />

      <div className="block-menu-divider" />

      {/* Move up */}
      <MenuItem
        icon="↑"
        label="Move up"
        shortcut="⌘⇧↑"
        onClick={() => run(moveBlockUp)}
      />

      {/* Move down */}
      <MenuItem
        icon="↓"
        label="Move down"
        shortcut="⌘⇧↓"
        onClick={() => run(moveBlockDown)}
      />

      <div className="block-menu-divider" />

      {/* Delete */}
      <MenuItem
        icon="🗑"
        label="Delete"
        danger
        onClick={() => run(deleteBlock)}
      />
    </div>,
    document.body,
  )
}
