import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as P from './primitives.jsx';

/**
 * Props: none. Talks to the Tauri MCP commands directly.
 */
export default function AIAssistant() {
  const [setupState, setSetupState] = useState('checking'); // checking, not-setup, setting-up, success, error
  const [message, setMessage] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      setSetupState('checking');
      const status = await invoke('check_mcp_status');
      setIsConfigured(status);
      setSetupState(status ? 'success' : 'not-setup');
    } catch (error) {
      setSetupState('not-setup');
    }
  };

  const handleSetup = async () => {
    try {
      setSetupState('setting-up');
      setMessage('');

      // First, bundle the MCP server if needed
      await invoke('setup_mcp_integration');

      // Wait a moment for the setup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSetupState('success');
      setIsConfigured(true);
    } catch (error) {
      setMessage(error.toString());
      setSetupState('error');
    }
  };

  const handleRestart = async () => {
    try {
      setSetupState('setting-up');
      setMessage('');
      const result = await invoke('restart_mcp_server');
      setSetupState('success');
      setMessage(result);
    } catch (error) {
      setMessage(error.toString());
      setSetupState('error');
    }
  };

  const statusHint = {
    checking: 'Reading the Claude Desktop config…',
    'setting-up': 'Writing the Claude Desktop config…',
    success: 'Claude Desktop can reach this workspace.',
    error: 'The config could not be written. Check that Claude Desktop is installed, then try again.',
    'not-setup': 'Claude Desktop cannot see your notes yet.',
  }[setupState];

  const busy = setupState === 'setting-up' || setupState === 'checking';

  return (
    <P.Page
      title="AI assistant"
      lede="Claude Desktop can read, search and create notes in this workspace through a server that runs on this machine."
    >
      <P.Group label="Claude Desktop">
        <P.Row label="Connection" hint={statusHint}>
          {isConfigured ? (
            <div className="flex items-center gap-2">
              <P.Button onClick={checkSetupStatus} disabled={busy}>Recheck</P.Button>
              <P.Button onClick={handleRestart} disabled={busy}>Restart server</P.Button>
            </div>
          ) : (
            <P.Button tone="primary" onClick={handleSetup} disabled={busy}>
              {setupState === 'setting-up' ? 'Connecting…' : 'Connect'}
            </P.Button>
          )}
        </P.Row>

        {message && (
          <P.Note tone={setupState === 'error' ? 'danger' : 'success'}>{message}</P.Note>
        )}

        {!isConfigured && (
          <P.Note>
            Don't have it?{' '}
            <a
              href="https://claude.ai/download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-app-accent hover:text-app-accent-hover underline underline-offset-2 rounded-sm
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/50"
            >
              Download Claude Desktop
            </a>
            .
          </P.Note>
        )}
      </P.Group>

      {isConfigured && (
        <P.Group
          label="Using it"
          hint="Claude reads the config when it launches, so restart Claude Desktop, then open a new conversation."
        >
          <P.Empty>
            Ask it what notes you have, to search them for a topic, or to create one. If it doesn't
            know about Lokus, quit Claude Desktop completely and open it again.
          </P.Empty>
        </P.Group>
      )}

      <P.Group label="What it can reach">
        <P.Row label="Search" hint="Finds notes by content across the whole workspace." />
        <P.Row label="Write" hint="Creates and edits notes where you tell it to." />
        <P.Row
          label="Nothing else"
          hint="The server runs locally over Model Context Protocol. Files leave this machine only when you paste them into a conversation."
        />
      </P.Group>
    </P.Page>
  );
}
