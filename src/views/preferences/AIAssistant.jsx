import { useState } from 'react';
import { Bot, Sparkles, Zap, Copy, CheckCircle } from 'lucide-react';

export default function AIAssistant() {
  const [copySuccess, setCopySuccess] = useState(false);

  const command = 'claude mcp add lokus node src/mcp-server/stdio-server.js';

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
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
            Connect your AI assistant to work with your notes and workspace
          </p>
        </div>
      </div>

      {/* Connection Instructions Card */}
      <div className="bg-app-panel/40 border border-app-border rounded-lg p-6">
        <div className="flex items-start space-x-4">
          {/* AI Assistant Icon */}
          <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-medium text-app-text">AI Assistant Connection</h3>
            <p className="text-sm text-app-muted mt-1">
              Connect your AI assistant to read your notes, search content, and help with writing
            </p>
          </div>
        </div>

        {/* Simple Connection Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
              <span className="text-xs text-white font-bold">1</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">To connect Claude Code to your Lokus workspace, run this command in your terminal:</h4>
              
              <div className="mt-3 p-3 bg-gray-900 rounded border text-sm font-mono text-green-400 relative">
                <code>{command}</code>
                <button
                  onClick={() => copyToClipboard(command)}
                  className={`absolute top-2 right-2 p-1.5 rounded transition-colors ${
                    copySuccess 
                      ? 'bg-green-600 text-white' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`}
                  title="Copy command"
                >
                  {copySuccess ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              <p className="text-xs text-blue-800 mt-3">
                This connects Claude Code to your Lokus workspace so it can read notes, search content, and help with writing.
              </p>
              
              <div className="mt-3">
                <p className="text-xs text-blue-800 font-medium">
                  After running the command, you can ask Claude Code to:
                </p>
                <ul className="text-xs text-blue-800 mt-1 space-y-1">
                  <li>• "Search my notes about project ideas"</li>
                  <li>• "Create a new note with today's meeting agenda"</li>
                  <li>• "Format this text with proper headings"</li>
                  <li>• "Help me organize my workspace"</li>
                </ul>
              </div>
            </div>
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
            AI can search through all your notes and find relevant content
          </p>
        </div>

        <div className="bg-app-panel/20 border border-app-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="font-medium text-app-text">Content Creation</span>
          </div>
          <p className="text-sm text-app-muted">
            Generate new notes, format text, and enhance your writing
          </p>
        </div>

        <div className="bg-app-panel/20 border border-app-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span className="font-medium text-app-text">Workspace Integration</span>
          </div>
          <p className="text-sm text-app-muted">
            Direct access to your files, themes, and workspace settings
          </p>
        </div>
      </div>

    </div>
  );
}