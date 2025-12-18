/**
 * Example Integration: Output Panel
 *
 * This file demonstrates how to integrate the OutputPanel component
 * into your application layout.
 */

import React, { useState } from 'react';
import OutputPanel from './OutputPanel';
import { useOutputChannels } from '../../hooks/useOutputChannels';

/**
 * Example 1: Bottom Panel Layout
 * Panel appears at the bottom of the screen
 */
export function BottomPanelLayout() {
  const [isOutputOpen, setIsOutputOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <h1>Main Content</h1>
        <button onClick={() => setIsOutputOpen(!isOutputOpen)}>
          Toggle Output Panel
        </button>
      </div>

      {/* Output panel at bottom */}
      {isOutputOpen && (
        <div style={{ height: '300px', borderTop: '1px solid var(--border)' }}>
          <OutputPanel
            isOpen={isOutputOpen}
            onClose={() => setIsOutputOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Example 2: Split Pane Layout
 * Panel appears in a resizable split pane
 */
export function SplitPaneLayout() {
  const [isOutputOpen, setIsOutputOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(300);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Main content */}
      <div style={{ flex: `1 1 calc(100% - ${panelHeight}px)`, overflow: 'auto' }}>
        <h1>Editor Area</h1>
      </div>

      {/* Resizable divider */}
      {isOutputOpen && (
        <div
          style={{
            height: '4px',
            background: 'rgb(var(--border))',
            cursor: 'ns-resize'
          }}
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startHeight = panelHeight;

            const handleMouseMove = (e) => {
              const delta = startY - e.clientY;
              setPanelHeight(Math.max(100, Math.min(600, startHeight + delta)));
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      )}

      {/* Output panel */}
      {isOutputOpen && (
        <div style={{ height: `${panelHeight}px` }}>
          <OutputPanel
            isOpen={isOutputOpen}
            onClose={() => setIsOutputOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Using with Command Palette
 * Show output panel via command
 */
export function CommandPaletteIntegration() {
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const { channels, showChannel } = useOutputChannels();

  // Register command: Show Output
  const handleShowOutput = () => {
    setIsOutputOpen(true);
  };

  // Register command: Show Output for specific plugin
  const handleShowPluginOutput = (pluginName) => {
    showChannel(pluginName);
    setIsOutputOpen(true);
  };

  return (
    <div>
      <button onClick={handleShowOutput}>
        View: Show Output
      </button>

      {channels.map(channel => (
        <button
          key={channel.name}
          onClick={() => handleShowPluginOutput(channel.name)}
        >
          View Output: {channel.name}
        </button>
      ))}

      {isOutputOpen && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '300px' }}>
          <OutputPanel
            isOpen={isOutputOpen}
            onClose={() => setIsOutputOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Status Bar Integration
 * Show channel count in status bar, click to open
 */
export function StatusBarIntegration() {
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const { channels } = useOutputChannels();

  return (
    <>
      {/* Status bar item */}
      <div
        onClick={() => setIsOutputOpen(!isOutputOpen)}
        style={{
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)'
        }}
        title="Show Output"
      >
        Output ({channels.length})
      </div>

      {/* Output panel */}
      {isOutputOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px', // Above status bar
          left: 0,
          right: 0,
          height: '300px',
          zIndex: 1000
        }}>
          <OutputPanel
            isOpen={isOutputOpen}
            onClose={() => setIsOutputOpen(false)}
          />
        </div>
      )}
    </>
  );
}

/**
 * Example 5: Testing Output Panel
 * Create test channels and add content
 */
export function TestOutputPanel() {
  const [isOutputOpen, setIsOutputOpen] = useState(true);

  const createTestChannel = () => {
    // This would typically be done by a plugin
    // For testing, you can import outputChannelManager directly
    import('../../plugins/managers/OutputChannelManager.js').then(({ default: manager }) => {
      const channel = manager.createChannel('Test Plugin', 'test-plugin-id');
      channel.appendLine('[INFO] Plugin loaded successfully');
      channel.appendLine('[DEBUG] Configuration: { theme: "dark" }');
      channel.appendLine('[INFO] Processing files...');

      // Simulate async output
      setTimeout(() => {
        channel.appendLine('[SUCCESS] Processed 10 files');
      }, 1000);

      setTimeout(() => {
        channel.appendLine('[ERROR] Failed to process file: test.txt');
      }, 2000);

      channel.show();
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Output Panel Testing</h2>

      <button onClick={createTestChannel}>
        Create Test Channel
      </button>

      <button onClick={() => setIsOutputOpen(!isOutputOpen)}>
        Toggle Panel
      </button>

      {isOutputOpen && (
        <div style={{ marginTop: '20px', height: '400px', border: '1px solid var(--border)' }}>
          <OutputPanel
            isOpen={isOutputOpen}
            onClose={() => setIsOutputOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
