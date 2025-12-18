import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bot, CheckCircle, AlertCircle, Loader2, ExternalLink, Settings } from 'lucide-react';

export function AIAssistantSetup() {
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
        return 'Setting up AI Assistant...';
      case 'success':
        return 'AI Assistant is configured and ready!';
      case 'error':
        return 'Setup failed. Please try again.';
      case 'not-setup':
        return isConfigured ? 'AI Assistant is configured' : 'AI Assistant not configured';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="ai-assistant-setup p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <Bot className="w-8 h-8 text-blue-500" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            AI Assistant Integration
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Connect Lokus with AI Desktop for AI-powered features. This enables your AI assistant to help you with your notes, search, and organization.
          </p>

          <div className="flex items-center space-x-2 mb-4">
            {getStatusIcon()}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getStatusText()}
            </span>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="flex items-center space-x-3">
            {!isConfigured && setupState !== 'setting-up' && (
              <button
                onClick={handleSetup}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={setupState === 'setting-up'}
              >
                <Settings className="inline-block w-4 h-4 mr-2" />
                Enable AI Assistant
              </button>
            )}

            {isConfigured && (
              <button
                onClick={checkSetupStatus}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Refresh Status
              </button>
            )}

            <a
              href="https://docs.lokus.so/ai-integration"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-500 hover:text-blue-600 transition-colors"
            >
              Setup Guide
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>

          {isConfigured && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
                ✓ Setup Complete!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-400 mb-2">
                To use the AI Assistant:
              </p>
              <ol className="text-sm text-green-700 dark:text-green-400 space-y-1 list-decimal list-inside">
                <li>Open your AI Desktop app (not the web version)</li>
                <li>Start a new conversation</li>
                <li>Ask your assistant about your Lokus notes!</li>
              </ol>
              <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                Note: You may need to restart your AI Desktop after setup.
              </p>
            </div>
          )}

          <details className="mt-4">
            <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              What does this do?
            </summary>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                This integration allows AI Desktop to access your Lokus workspace through the Model Context Protocol (MCP).
                Your AI assistant can then help you search notes, create new content, organize information, and answer questions about your knowledge base.
                Your data stays local and private - it only accesses when you explicitly ask.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}