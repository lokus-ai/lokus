import React from 'react';
import { useLayoutStore } from '../stores/layout';
import { useEditorGroupStore } from '../stores/editorGroups';
import { useColumnResize } from '../features/layout';

/**
 * WorkspaceShell — pure CSS grid layout container.
 *
 * Grid areas:
 *
 *   toolbar      | toolbar      | toolbar      | toolbar
 *   icon-sidebar | left-sidebar | main         | right-sidebar
 *   icon-sidebar | left-sidebar | bottom-panel | right-sidebar
 *   status-bar   | status-bar   | status-bar   | status-bar
 *
 * Columns:  [icon-sidebar] [left-sidebar] [main] [right-sidebar]
 * Rows:     [toolbar] [main+bottom 1fr] [bottom-panel auto] [status-bar auto]
 *
 * Sidebar visibility is driven entirely by grid-template-columns widths.
 * Children own all their own backgrounds, borders, and overflow.
 */
export default function WorkspaceShell({
  toolbar,
  iconSidebar,
  leftSidebar,
  mainContent,
  rightSidebar,
  bottomPanel,
  statusBar,
}) {
  const showLeft = useLayoutStore((s) => s.showLeft);
  const showRight = useLayoutStore((s) => s.showRight);
  const leftW = useLayoutStore((s) => s.leftW);
  const rightW = useLayoutStore((s) => s.rightW);
  const showTerminalPanel = useLayoutStore((s) => s.showTerminalPanel);
  const showOutputPanel = useLayoutStore((s) => s.showOutputPanel);
  const bottomPanelHeight = useLayoutStore((s) => s.bottomPanelHeight);

  const showBottom = showTerminalPanel || showOutputPanel;
  const { startLeftDrag, startRightDrag } = useColumnResize({});

  // In split mode, collapse toolbar row so panes extend to the very top.
  // Also toggle a body class so the app-titlebar (in App.jsx) collapses too.
  const isSplitMode = useEditorGroupStore((s) => s.layout.type !== 'group');

  React.useEffect(() => {
    document.body.classList.toggle('split-mode', isSplitMode);
    return () => document.body.classList.remove('split-mode');
  }, [isSplitMode]);

  const gridTemplateColumns = [
    '48px',                                    // icon-sidebar — always visible
    showLeft  ? `${leftW}px`  : '0px',         // left-sidebar
    '1fr',                                     // main
    showRight ? `${rightW}px` : '0px',         // right-sidebar
  ].join(' ');

  const gridTemplateRows = [
    isSplitMode ? '0px' : 'auto',              // toolbar — collapsed in split mode
    '1fr',                                     // main content expands here
    showBottom ? `${bottomPanelHeight}px` : '0px', // bottom-panel
    'auto',                                    // status-bar
  ].join(' ');

  const gridTemplateAreas = `
    "toolbar       toolbar       toolbar       toolbar"
    "icon-sidebar  left-sidebar  main          right-sidebar"
    "icon-sidebar  left-sidebar  bottom-panel  right-sidebar"
    "status-bar    status-bar    status-bar    status-bar"
  `;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows,
        gridTemplateAreas,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── toolbar ── */}
      <div style={{ gridArea: 'toolbar', minWidth: 0, overflow: 'hidden' }}>
        {toolbar}
      </div>

      {/* ── icon-sidebar ── */}
      <div style={{ gridArea: 'icon-sidebar', minWidth: 0, overflow: 'hidden' }}>
        {iconSidebar}
      </div>

      {/* ── left-sidebar ── */}
      <div style={{ gridArea: 'left-sidebar', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {showLeft && leftSidebar}
        {showLeft && (
          <div
            onMouseDown={startLeftDrag}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 4,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10,
            }}
          />
        )}
      </div>

      {/* ── main content ── */}
      <div className="bg-app-bg" style={{ gridArea: 'main', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {mainContent}
      </div>

      {/* ── bottom-panel ── */}
      <div style={{ gridArea: 'bottom-panel', minWidth: 0, overflow: 'hidden' }}>
        {showBottom && bottomPanel}
      </div>

      {/* ── right-sidebar ── */}
      <div style={{ gridArea: 'right-sidebar', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {showRight && rightSidebar}
        {showRight && (
          <div
            onMouseDown={startRightDrag}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 4,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10,
            }}
          />
        )}
      </div>

      {/* ── status-bar ── */}
      <div style={{ gridArea: 'status-bar', minWidth: 0, overflow: 'hidden' }}>
        {statusBar}
      </div>
    </div>
  );
}
