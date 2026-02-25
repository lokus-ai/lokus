/**
 * TableBubbleMenu — floating menu for table operations.
 *
 * Replaces the TipTap <BubbleMenu> component with a ProseMirror plugin
 * that renders table action buttons via createFloatingMenuPlugin.
 *
 * Usage:
 *   import { createTableBubbleMenuPlugin } from './TableBubbleMenu.jsx';
 *
 *   // Add to your plugins array:
 *   const plugins = [
 *     ...otherPlugins,
 *     createTableBubbleMenuPlugin(),
 *   ];
 *
 * The plugin creates a DOM element, renders React table action buttons into it,
 * and uses createFloatingMenuPlugin to position it near the current selection
 * when the selection is inside a table node.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PluginKey } from 'prosemirror-state';
import { createFloatingMenuPlugin } from '../lib/floating-menu-plugin.js';
import {
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
  mergeCells,
  splitCell,
  toggleHeaderRow,
  toggleHeaderColumn,
  toggleHeaderCell,
} from 'prosemirror-tables';

// ---------------------------------------------------------------------------
// Button component (same styling as original)
// ---------------------------------------------------------------------------

const Btn = ({ onClick, title, children, disabled }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`px-2 py-1 text-sm rounded border transition-colors
      ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-app-accent/10"}
      bg-app-panel border-app-border text-app-text`}
  >
    {children || title}
  </button>
);

// ---------------------------------------------------------------------------
// React component rendered inside the floating menu
// ---------------------------------------------------------------------------

const TableActions = ({ view }) => {
  if (!view) return null;

  // Helper: can a command execute? (dry-run without dispatch)
  const can = (cmd) => {
    try {
      return cmd(view.state, undefined, view);
    } catch {
      return false;
    }
  };

  // Helper: run a command with focus
  const run = (cmd) => {
    view.focus();
    cmd(view.state, view.dispatch, view);
  };

  return (
    <div className="flex gap-1 p-1 rounded-md border bg-app-panel border-app-border shadow-md">
      <Btn title="Insert row above" disabled={!can(addRowBefore)} onClick={() => run(addRowBefore)}>+ Row up</Btn>
      <Btn title="Insert row below" disabled={!can(addRowAfter)} onClick={() => run(addRowAfter)}>+ Row dn</Btn>
      <Btn title="Insert column left" disabled={!can(addColumnBefore)} onClick={() => run(addColumnBefore)}>+ Col lt</Btn>
      <Btn title="Insert column right" disabled={!can(addColumnAfter)} onClick={() => run(addColumnAfter)}>+ Col rt</Btn>

      <span className="w-px bg-app-border mx-1" />

      <Btn title="Toggle header row" onClick={() => run(toggleHeaderRow)}>Hdr Row</Btn>
      <Btn title="Toggle header column" onClick={() => run(toggleHeaderColumn)}>Hdr Col</Btn>
      <Btn title="Toggle header cell" onClick={() => run(toggleHeaderCell)}>Hdr Cell</Btn>

      <span className="w-px bg-app-border mx-1" />

      <Btn title="Merge cells" disabled={!can(mergeCells)} onClick={() => run(mergeCells)}>Merge</Btn>
      <Btn title="Split cell" disabled={!can(splitCell)} onClick={() => run(splitCell)}>Split</Btn>

      <span className="w-px bg-app-border mx-1" />

      <Btn title="Delete row" disabled={!can(deleteRow)} onClick={() => run(deleteRow)}>Del Row</Btn>
      <Btn title="Delete column" disabled={!can(deleteColumn)} onClick={() => run(deleteColumn)}>Del Col</Btn>
      <Btn title="Delete table" disabled={!can(deleteTable)} onClick={() => run(deleteTable)}>Del Tbl</Btn>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

const tableBubbleMenuKey = new PluginKey('tableBubbleMenu');

// ---------------------------------------------------------------------------
// shouldShow — returns true when cursor is inside a table
// ---------------------------------------------------------------------------

function isInsideTable(state) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (
      node.type.name === 'table' ||
      node.type.name === 'tableCell' ||
      node.type.name === 'tableHeader' ||
      node.type.name === 'tableRow'
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Factory: creates the floating-menu PM plugin for table actions
// ---------------------------------------------------------------------------

/**
 * Create a ProseMirror plugin that shows a floating table action menu
 * when the cursor is inside a table.
 *
 * @returns {import('prosemirror-state').Plugin}
 */
export function createTableBubbleMenuPlugin() {
  // Create the host DOM element for the React component
  const menuElement = document.createElement('div');
  menuElement.className = 'table-bubble-menu-host';
  menuElement.style.cssText = 'display:contents';

  // Mount a React root
  const root = createRoot(menuElement);

  // We store a reference to the current view so we can re-render when it updates
  let currentView = null;

  // Render helper
  function renderMenu(view) {
    currentView = view;
    root.render(<TableActions view={view} />);
  }

  // Create the floating menu plugin
  const plugin = createFloatingMenuPlugin({
    pluginKey: tableBubbleMenuKey,
    element: menuElement,
    shouldShow: (state, view) => {
      const visible = isInsideTable(state);
      // Re-render the React component so it can read the latest state
      // for button disabled states
      if (visible) {
        renderMenu(view);
      }
      return visible;
    },
    tippyOptions: {
      placement: 'top',
      offset: [0, 8],
    },
  });

  return plugin;
}

// ---------------------------------------------------------------------------
// Default export: the old React component is no longer used directly.
// Export createTableBubbleMenuPlugin as the primary API.
// Keep a stub default export for backward compat if something imports it.
// ---------------------------------------------------------------------------

const TableBubbleMenu = () => {
  // This component is no longer rendered as a React child.
  // Use createTableBubbleMenuPlugin() to add the plugin to the PM plugins array.
  return null;
};

export default TableBubbleMenu;
