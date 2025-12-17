import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bot, Sparkles, Zap, CheckCircle, AlertCircle, Loader2, Settings, RefreshCw, ExternalLink } from 'lucide-react';

export default function AIAssistant() {
  const [setupState, setSetupState] = useState('checking'); // checking, not-setup, setting-up, success, error
  const [errorMessage, setErrorMessage] = useState('');
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
      setErrorMessage('');

      // First, bundle the MCP server if needed
      const result = await invoke('setup_mcp_integration');

      // Wait a moment for the setup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSetupState('success');
      setIsConfigured(true);
    } catch (error) {
      setErrorMessage(error.toString());
      setSetupState('error');
    }
  };

  const getStatusIcon = () => {
    switch (setupState) {
      case 'checking':
      case 'setting-up':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Bot className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (setupState) {
      case 'checking':
        return 'Checking AI Assistant status...';
      case 'setting-up':
        return 'Setting up AI Assistant connection...';
      case 'success':
        return 'AI Assistant is connected and ready!';
      case 'error':
        return 'Setup failed. Please try again.';
      case 'not-setup':
        return isConfigured ? 'AI Assistant is configured' : 'AI Assistant not connected';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Bot className="h-8 w-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-semibold text-app-text">AI Assistant</h1>
          <p className="text-sm text-app-muted mt-1">
            Connect Claude Desktop to your notes and workspace
          </p>
        </div>
      </div>

      {/* Main Setup Card */}
      <div className="bg-app-panel/40 border border-app-border rounded-lg p-6">
        <div className="flex items-start space-x-4">
          {/* Icon */}
          <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 text-white" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-medium text-app-text">Claude Desktop Integration</h3>
            <p className="text-sm text-app-muted mt-1">
              Enable Claude to read your notes, search content, and help with writing
            </p>

            {/* Status */}
            <div className="flex items-center space-x-2 mt-4">
              {getStatusIcon()}
              <span className="text-sm font-medium text-app-text">
                {getStatusText()}
              </span>
            </div>

            {/* Error/Success Message */}
            {errorMessage && (
              <div className={`mt-4 p-3 border rounded-md ${errorMessage.includes('successfully')
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                <p className={`text-sm ${errorMessage.includes('successfully')
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}>{errorMessage}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mt-4">
              {!isConfigured && setupState !== 'setting-up' && (
                <button
                  onClick={handleSetup}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
                  disabled={setupState === 'setting-up'}
                >
                  <Settings className="w-4 h-4" />
                  <span>Enable AI Assistant</span>
                </button>
              )}

              {isConfigured && (
                <>
                  <button
                    onClick={checkSetupStatus}
                    className="px-4 py-2 bg-app-panel border border-app-border text-app-text rounded-md hover:bg-app-bg transition-colors focus:outline-none focus:ring-2 focus:ring-app-border flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh Status</span>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        setSetupState('setting-up');
                        setErrorMessage('');
                        const result = await invoke('restart_mcp_server');
                        setSetupState('success');
                        setErrorMessage(result);
                      } catch (error) {
                        setErrorMessage(error.toString());
                        setSetupState('error');
                      }
                    }}
                    className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 flex items-center space-x-2"
                    disabled={setupState === 'setting-up'}
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Restart MCP Server</span>
                  </button>
                </>
              )}

              <a
                href="https://claude.ai/download"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-500 hover:text-blue-600 transition-colors"
              >
                Download Claude Desktop
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>

            {/* Success Instructions */}
            {isConfigured && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
                  ✓ Setup Complete!
                </h4>
                <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                  To use the AI Assistant:
                </p>
                <ol className="text-sm text-green-700 dark:text-green-400 space-y-1 list-decimal list-inside">
                  <li>Open Claude Desktop (not the website)</li>
                  <li>Restart Claude Desktop if it was already running</li>
                  <li>Start a new conversation</li>
                  <li>Try these commands:</li>
                </ol>
                <ul className="text-sm text-green-700 dark:text-green-400 mt-2 ml-6 space-y-1">
                  <li>• "What notes do I have in my Lokus workspace?"</li>
                  <li>• "Search for notes about [topic]"</li>
                  <li>• "Create a new note called [name]"</li>
                  <li>• "Show me my workspace info"</li>
                </ul>
                <p className="text-xs text-green-600 dark:text-green-500 mt-3">
                  Note: If Claude doesn't respond to Lokus commands, restart Claude Desktop.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-app-panel/20 border border-app-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <span className="font-medium text-app-text">Smart Search</span>
          </div>
          <p className="text-sm text-app-muted">
            AI can search through all your notes and find relevant content instantly
          </p>
        </div>

        <div className="bg-app-panel/20 border border-app-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="font-medium text-app-text">Content Creation</span>
          </div>
          <p className="text-sm text-app-muted">
            Generate new notes, format text, and enhance your writing with AI help
          </p>
        </div>

        <div className="bg-app-panel/20 border border-app-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span className="font-medium text-app-text">Privacy First</span>
          </div>
          <p className="text-sm text-app-muted">
            Your notes stay local. Claude only accesses them when you explicitly ask
          </p>
        </div>
      </div>

      {/* Technical Details */}
      <details className="mt-4">
        <summary className="text-sm text-app-muted cursor-pointer hover:text-app-text">
          Technical Details
        </summary>
        <div className="mt-2 p-3 bg-app-panel/20 rounded-md">
          <p className="text-xs text-app-muted">
            This integration uses the Model Context Protocol (MCP) to allow Claude Desktop to interact with your Lokus workspace.
            The connection is local and secure - your data never leaves your computer unless you explicitly share it in a conversation.
            The MCP server runs locally and provides Claude with tools to list, read, create, and search your notes.
          </p>
        </div>
      </details>
    </div>
  );
}