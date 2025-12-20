import React, { useState, useEffect, useRef } from 'react';
import terminalManager from '../../plugins/managers/TerminalManager.js';
import './TerminalPanel.css';

export function TerminalPanel({ isOpen, onClose }) {
  const [terminals, setTerminals] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const outputRef = useRef(null);

  useEffect(() => {
    // Load terminals
    setTerminals(terminalManager.getTerminals());
    const active = terminalManager.getActiveTerminal();
    if (active) setActiveId(active.id);

    // Subscribe to events
    const onCreated = () => {
      setTerminals(terminalManager.getTerminals());
      const active = terminalManager.getActiveTerminal();
      if (active) setActiveId(active.id);
    };

    const onDisposed = () => {
      setTerminals(terminalManager.getTerminals());
      const active = terminalManager.getActiveTerminal();
      setActiveId(active ? active.id : null);
    };

    const onData = () => {
      setTerminals([...terminalManager.getTerminals()]);
    };

    const onOutput = () => {
      setTerminals([...terminalManager.getTerminals()]);
    };

    const onActiveChanged = (terminal) => {
      setActiveId(terminal ? terminal.id : null);
    };

    terminalManager.on('terminal-created', onCreated);
    terminalManager.on('terminal-disposed', onDisposed);
    terminalManager.on('terminal-data', onData);
    terminalManager.on('terminal-output', onOutput);
    terminalManager.on('active-terminal-changed', onActiveChanged);

    return () => {
      terminalManager.off('terminal-created', onCreated);
      terminalManager.off('terminal-disposed', onDisposed);
      terminalManager.off('terminal-data', onData);
      terminalManager.off('terminal-output', onOutput);
      terminalManager.off('active-terminal-changed', onActiveChanged);
    };
  }, []);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminals, activeId]);

  const activeTerminal = terminals.find(t => t.id === activeId);

  const handleSend = () => {
    if (activeTerminal && input.trim()) {
      terminalManager.sendText(activeId, input);
      setInput('');
    }
  };

  const handleClose = (e, terminalId) => {
    e.stopPropagation();
    terminalManager.disposeTerminal(terminalId);
  };

  const handleNewTerminal = () => {
    const id = `terminal-${Date.now()}`;
    terminalManager.createTerminal({
      id,
      name: `Terminal ${terminals.length + 1}`,
      pluginId: 'lokus-core'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <div className="terminal-tabs">
          {terminals.map(t => (
            <div
              key={t.id}
              className={`terminal-tab ${t.id === activeId ? 'active' : ''}`}
            >
              <button
                className="terminal-tab-button"
                onClick={() => setActiveId(t.id)}
              >
                {t.name}
              </button>
              <button
                className="terminal-tab-close"
                onClick={(e) => handleClose(e, t.id)}
                title="Close terminal"
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="terminal-new-btn"
            onClick={handleNewTerminal}
            title="New Terminal"
          >
            +
          </button>
        </div>
        <button className="terminal-close" onClick={onClose} title="Close panel">×</button>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {activeTerminal?.output.map((line, i) => (
          <div key={i} className={`terminal-line terminal-line-${line.type}`}>
            {line.text}
          </div>
        ))}
        {!activeTerminal && terminals.length === 0 && (
          <div className="terminal-empty">No terminals available</div>
        )}
        {!activeTerminal && terminals.length > 0 && (
          <div className="terminal-empty">No terminal selected</div>
        )}
      </div>

      <div className="terminal-input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type command..."
          className="terminal-input"
          disabled={!activeTerminal}
        />
        <button
          onClick={handleSend}
          className="terminal-send"
          disabled={!activeTerminal || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default TerminalPanel;
