import { useLayoutStore } from '../../stores/layout';
import { useWorkspaceStore } from '../../stores/workspace';
import TerminalPanel from '../../components/TerminalPanel/TerminalPanel.jsx';
import { OutputPanel } from '../../components/OutputPanel/OutputPanel.jsx';
import { isDesktop } from '../../platform/index.js';

/**
 * BottomPanel — Terminal and Output panels with tab switching and resize handle.
 *
 * Only renders on desktop when showTerminalPanel or showOutputPanel is true.
 * Reads height and active tab from useLayoutStore.
 * Panel open/close state still on useWorkspaceStore during the migration.
 */
export default function BottomPanel({ workspacePath, onResizeStart }) {
  const bottomPanelHeight = useLayoutStore((s) => s.bottomPanelHeight);
  const bottomPanelTab = useLayoutStore((s) => s.bottomPanelTab);

  const showTerminalPanel = useWorkspaceStore((s) => s.showTerminalPanel);
  const showOutputPanel = useWorkspaceStore((s) => s.showOutputPanel);

  if (!isDesktop() || (!showTerminalPanel && !showOutputPanel)) {
    return null;
  }

  const handleClosePanel = () => {
    useWorkspaceStore.setState({ showTerminalPanel: false });
    useWorkspaceStore.setState({ showOutputPanel: false });
  };

  const handleSelectTerminal = () => {
    useLayoutStore.getState().setBottomTab('terminal');
    useWorkspaceStore.setState({ showTerminalPanel: true });
    useWorkspaceStore.setState({ showOutputPanel: false });
  };

  const handleSelectOutput = () => {
    useLayoutStore.getState().setBottomTab('output');
    useWorkspaceStore.setState({ showOutputPanel: true });
    useWorkspaceStore.setState({ showTerminalPanel: false });
  };

  return (
    <div
      style={{
        height: `${bottomPanelHeight}px`,
        borderTop: '1px solid rgb(var(--border))',
        backgroundColor: 'rgb(var(--panel))',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          cursor: 'ns-resize',
          backgroundColor: 'transparent',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(var(--accent), 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />

      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgb(var(--border))',
          backgroundColor: 'rgb(var(--panel))',
          height: '32px',
        }}
      >
        {/* Terminal tab — desktop only */}
        {isDesktop() && (
          <button
            onClick={handleSelectTerminal}
            style={{
              padding: '0 12px',
              height: '100%',
              border: 'none',
              background:
                bottomPanelTab === 'terminal' ? 'rgb(var(--app-panel))' : 'transparent',
              color:
                bottomPanelTab === 'terminal'
                  ? 'rgb(var(--text))'
                  : 'rgb(var(--text-muted))',
              cursor: 'pointer',
              fontSize: '13px',
              borderBottom:
                bottomPanelTab === 'terminal'
                  ? '2px solid rgb(var(--accent))'
                  : 'none',
              fontWeight: bottomPanelTab === 'terminal' ? '500' : 'normal',
            }}
          >
            Terminal
          </button>
        )}

        {/* Output tab */}
        <button
          onClick={handleSelectOutput}
          style={{
            padding: '0 12px',
            height: '100%',
            border: 'none',
            background:
              bottomPanelTab === 'output' ? 'rgb(var(--app-panel))' : 'transparent',
            color:
              bottomPanelTab === 'output'
                ? 'rgb(var(--text))'
                : 'rgb(var(--text-muted))',
            cursor: 'pointer',
            fontSize: '13px',
            borderBottom:
              bottomPanelTab === 'output'
                ? '2px solid rgb(var(--accent))'
                : 'none',
            fontWeight: bottomPanelTab === 'output' ? '500' : 'normal',
          }}
        >
          Output
        </button>

        {/* Spacer + Close button */}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClosePanel}
          style={{
            padding: '0 12px',
            height: '100%',
            border: 'none',
            background: 'transparent',
            color: 'rgb(var(--text-muted))',
            cursor: 'pointer',
            fontSize: '16px',
          }}
          title="Close panel"
        >
          ×
        </button>
      </div>

      {/* Panel Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {isDesktop() && bottomPanelTab === 'terminal' && showTerminalPanel && (
          <TerminalPanel
            isOpen={showTerminalPanel}
            onClose={handleClosePanel}
          />
        )}
        {bottomPanelTab === 'output' && showOutputPanel && (
          <OutputPanel
            isOpen={showOutputPanel}
            onClose={handleClosePanel}
          />
        )}
      </div>
    </div>
  );
}
