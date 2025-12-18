import { useState, useEffect } from 'react';
import terminalManager from '../plugins/managers/TerminalManager.js';

/**
 * React hook for accessing terminal state from TerminalManager
 * @returns {Object} Terminal state and utilities
 */
export function useTerminals() {
  const [terminals, setTerminals] = useState([]);
  const [activeTerminal, setActiveTerminal] = useState(null);

  useEffect(() => {
    // Initialize state
    const updateTerminals = () => {
      setTerminals(terminalManager.getTerminals());
    };

    const updateActive = () => {
      setActiveTerminal(terminalManager.getActiveTerminal());
    };

    // Set initial state
    updateTerminals();
    updateActive();

    // Subscribe to terminal events
    const handleCreated = () => {
      updateTerminals();
      updateActive();
    };

    const handleDisposed = () => {
      updateTerminals();
      updateActive();
    };

    const handleData = () => {
      updateTerminals();
    };

    const handleOutput = () => {
      updateTerminals();
    };

    const handleActiveChanged = (terminal) => {
      setActiveTerminal(terminal);
    };

    const handleShown = () => {
      updateActive();
    };

    const handleHidden = () => {
      updateActive();
    };

    terminalManager.on('terminal-created', handleCreated);
    terminalManager.on('terminal-disposed', handleDisposed);
    terminalManager.on('terminal-data', handleData);
    terminalManager.on('terminal-output', handleOutput);
    terminalManager.on('active-terminal-changed', handleActiveChanged);
    terminalManager.on('terminal-shown', handleShown);
    terminalManager.on('terminal-hidden', handleHidden);

    // Cleanup
    return () => {
      terminalManager.off('terminal-created', handleCreated);
      terminalManager.off('terminal-disposed', handleDisposed);
      terminalManager.off('terminal-data', handleData);
      terminalManager.off('terminal-output', handleOutput);
      terminalManager.off('active-terminal-changed', handleActiveChanged);
      terminalManager.off('terminal-shown', handleShown);
      terminalManager.off('terminal-hidden', handleHidden);
    };
  }, []);

  // Utility functions
  const sendText = (terminalId, text, addNewLine = true) => {
    terminalManager.sendText(terminalId, text, addNewLine);
  };

  const showTerminal = (terminalId, preserveFocus = false) => {
    terminalManager.showTerminal(terminalId, preserveFocus);
  };

  const hideTerminal = (terminalId) => {
    terminalManager.hideTerminal(terminalId);
  };

  const disposeTerminal = (terminalId) => {
    terminalManager.disposeTerminal(terminalId);
  };

  const clearTerminal = (terminalId) => {
    terminalManager.clearTerminal(terminalId);
  };

  const getTerminal = (terminalId) => {
    return terminalManager.getTerminal(terminalId);
  };

  return {
    terminals,
    activeTerminal,
    sendText,
    showTerminal,
    hideTerminal,
    disposeTerminal,
    clearTerminal,
    getTerminal,
  };
}

export default useTerminals;
