/**
 * Example Usage: Terminal Panel Integration
 *
 * This file demonstrates how to integrate the TerminalPanel component
 * into your application and create test terminals.
 */

import React, { useState } from 'react';
import TerminalPanel from './TerminalPanel';
import terminalManager from '../../plugins/managers/TerminalManager';

/**
 * Example 1: Basic Integration
 * Simple panel with toggle button
 */
export function BasicTerminalExample() {
  const [isOpen, setIsOpen] = useState(false);

  const createTestTerminal = () => {
    // Create a test terminal
    const terminal = {
      id: `terminal-${Date.now()}`,
      name: `Test Terminal ${Date.now()}`,
      pluginId: 'test-plugin',
    };

    terminalManager.createTerminal(terminal);

    // Simulate some output
    setTimeout(() => {
      terminalManager.writeOutput(terminal.id, 'Welcome to Lokus Terminal!', 'stdout');
      terminalManager.writeOutput(terminal.id, 'Type commands below...', 'stdout');
    }, 100);
  };

  return (
    <div>
      <div style={{ padding: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? 'Hide' : 'Show'} Terminal Panel
        </button>
        <button onClick={createTestTerminal}>
          Create Test Terminal
        </button>
      </div>

      <div style={{ height: '400px', position: 'relative' }}>
        <TerminalPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </div>
  );
}

/**
 * Example 2: Integration with Plugin System
 * This shows how a plugin would create and use terminals
 */
export function PluginTerminalExample() {
  const [isOpen, setIsOpen] = useState(false);

  const simulatePluginTerminal = () => {
    // Simulate a plugin creating a terminal via TerminalAPI
    const terminal = {
      id: `plugin-terminal-${Date.now()}`,
      name: 'My Plugin Terminal',
      pluginId: 'my-awesome-plugin',
    };

    const created = terminalManager.createTerminal(terminal);

    // Show the terminal and panel
    terminalManager.showTerminal(created.id);
    setIsOpen(true);

    // Simulate plugin writing output over time
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      terminalManager.writeOutput(
        created.id,
        `Plugin output line ${counter}`,
        'stdout'
      );

      if (counter === 5) {
        terminalManager.writeOutput(
          created.id,
          'Warning: Something might be wrong!',
          'stderr'
        );
      }

      if (counter >= 10) {
        clearInterval(interval);
        terminalManager.writeOutput(
          created.id,
          'Plugin execution completed.',
          'stdout'
        );
      }
    }, 1000);
  };

  return (
    <div>
      <div style={{ padding: '20px' }}>
        <button onClick={simulatePluginTerminal}>
          Simulate Plugin Terminal
        </button>
      </div>

      <div style={{ height: '400px', position: 'relative' }}>
        <TerminalPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </div>
  );
}

/**
 * Example 3: Using the useTerminals Hook
 * This shows how to access terminal state in any component
 */
import { useTerminals } from '../../hooks/useTerminals';

export function TerminalStatsComponent() {
  const {
    terminals,
    activeTerminal,
    sendText,
    clearTerminal,
    disposeTerminal,
  } = useTerminals();

  return (
    <div style={{ padding: '20px' }}>
      <h3>Terminal Statistics</h3>
      <ul>
        <li>Total Terminals: {terminals.length}</li>
        <li>Active Terminal: {activeTerminal?.name || 'None'}</li>
        <li>Total Output Lines: {terminals.reduce((sum, t) => sum + t.output.length, 0)}</li>
      </ul>

      <h4>Terminal List</h4>
      <ul>
        {terminals.map(terminal => (
          <li key={terminal.id}>
            <strong>{terminal.name}</strong>
            {' - '}
            {terminal.output.length} lines
            <button onClick={() => clearTerminal(terminal.id)}>Clear</button>
            <button onClick={() => disposeTerminal(terminal.id)}>Close</button>
          </li>
        ))}
      </ul>

      {activeTerminal && (
        <div>
          <h4>Quick Command</h4>
          <button onClick={() => sendText(activeTerminal.id, 'echo Hello from React!')}>
            Send Test Command
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Full Application Integration
 * This shows how to integrate the terminal into a workspace view
 */
export function WorkspaceWithTerminal() {
  const [isTerminalOpen, setTerminalOpen] = useState(false);
  const { terminals } = useTerminals();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Toolbar */}
      <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <button onClick={() => setTerminalOpen(!isTerminalOpen)}>
          Terminal ({terminals.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: isTerminalOpen ? 0.6 : 1, overflow: 'auto', padding: '20px' }}>
          <h2>Main Workspace Content</h2>
          <p>Your editor or content goes here...</p>
        </div>

        {/* Terminal Panel (bottom 40% when open) */}
        {isTerminalOpen && (
          <div style={{ flex: 0.4, minHeight: '200px', maxHeight: '50vh' }}>
            <TerminalPanel
              isOpen={isTerminalOpen}
              onClose={() => setTerminalOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example 5: Testing Terminal Features
 * Useful for development and testing
 */
export function TerminalTestBench() {
  const [isOpen, setIsOpen] = useState(true);
  const [terminalId, setTerminalId] = useState(null);

  const createTerminal = () => {
    const terminal = {
      id: `test-${Date.now()}`,
      name: `Terminal ${Date.now()}`,
      pluginId: 'test',
    };
    const created = terminalManager.createTerminal(terminal);
    setTerminalId(created.id);
    terminalManager.showTerminal(created.id);
  };

  const writeStdout = () => {
    if (terminalId) {
      terminalManager.writeOutput(terminalId, 'This is standard output', 'stdout');
    }
  };

  const writeStderr = () => {
    if (terminalId) {
      terminalManager.writeOutput(terminalId, 'This is an error message', 'stderr');
    }
  };

  const sendInput = () => {
    if (terminalId) {
      terminalManager.sendText(terminalId, 'echo "Hello World"');
    }
  };

  const clearOutput = () => {
    if (terminalId) {
      terminalManager.clearTerminal(terminalId);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Terminal Test Bench</h2>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={createTerminal}>Create Terminal</button>
        <button onClick={writeStdout} disabled={!terminalId}>Write Stdout</button>
        <button onClick={writeStderr} disabled={!terminalId}>Write Stderr</button>
        <button onClick={sendInput} disabled={!terminalId}>Send Input</button>
        <button onClick={clearOutput} disabled={!terminalId}>Clear Output</button>
      </div>

      <div style={{ height: '400px', border: '1px solid #ccc' }}>
        <TerminalPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </div>
  );
}
