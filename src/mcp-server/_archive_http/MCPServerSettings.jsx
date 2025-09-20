import { useState, useEffect } from 'react';
import { readConfig, updateConfig } from '../../core/config/store.js';
import mcpServerManager from '../../core/mcp/manager.js';
import ServerControlPanel from '../../components/MCPServer/ServerControlPanel.jsx';
import APIKeyManager from '../../components/MCPServer/APIKeyManager.jsx';
import ConnectionMonitor from '../../components/MCPServer/ConnectionMonitor.jsx';
import MetricsDashboard from '../../components/MCPServer/MetricsDashboard.jsx';
import LogViewer from '../../components/MCPServer/LogViewer.jsx';
import ServerStatus from '../../components/MCPServer/ServerStatus.jsx';
import { AlertCircle, Info, Play, Square, RefreshCw } from 'lucide-react';

export default function MCPServerSettings() {
  const [mcpConfig, setMcpConfig] = useState({
    enabled: false,
    port: 3001,
    host: 'localhost',
    corsOrigins: ['http://localhost:3000'],
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    },
    logging: {
      enabled: true,
      level: 'info'
    }
  });

  const [saveStatus, setSaveStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [serverStatus, setServerStatus] = useState(mcpServerManager.getStatus());

  useEffect(() => {
    loadMCPConfig();
  }, []);

  const loadMCPConfig = async () => {
    try {
      const config = await readConfig();
      if (config.mcpServer) {
        setMcpConfig(prev => ({ ...prev, ...config.mcpServer }));
      }
    } catch (error) {
      console.error('Failed to load MCP config:', error);
    }
  };

  const saveMCPConfig = async () => {
    try {
      setSaveStatus('saving');
      await updateConfig({ mcpServer: mcpConfig });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
      console.error('Failed to save MCP config:', error);
    }
  };

  const validatePort = (port) => {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      return 'Port must be between 1024 and 65535';
    }
    return null;
  };

  const validateCORSOrigin = (origin) => {
    try {
      new URL(origin);
      return null;
    } catch {
      return 'Invalid URL format';
    }
  };

  const updateMCPConfig = (key, value) => {
    setMcpConfig(prev => ({ ...prev, [key]: value }));
    
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const updateNestedConfig = (category, key, value) => {
    setMcpConfig(prev => ({
      ...prev,
      [category]: { ...prev[category], [key]: value }
    }));
  };

  const addCORSOrigin = () => {
    const newOrigin = prompt('Enter CORS origin (e.g., http://localhost:3000):');
    if (newOrigin) {
      const error = validateCORSOrigin(newOrigin);
      if (error) {
        alert(error);
        return;
      }
      
      if (!mcpConfig.corsOrigins.includes(newOrigin)) {
        updateMCPConfig('corsOrigins', [...mcpConfig.corsOrigins, newOrigin]);
      }
    }
  };

  const removeCORSOrigin = (origin) => {
    updateMCPConfig('corsOrigins', mcpConfig.corsOrigins.filter(o => o !== origin));
  };

  const handlePortChange = (e) => {
    const port = e.target.value;
    const error = validatePort(port);
    
    if (error) {
      setErrors(prev => ({ ...prev, port: error }));
    } else {
      setErrors(prev => {
        const next = { ...prev };
        delete next.port;
        return next;
      });
    }
    
    updateMCPConfig('port', parseInt(port) || port);
  };

  // Server control functions
  const handleStartServer = async () => {
    try {
      await mcpServerManager.start();
      setServerStatus(mcpServerManager.getStatus());
    } catch (error) {
      console.error('Failed to start MCP server:', error);
    }
  };

  const handleStopServer = async () => {
    try {
      await mcpServerManager.stop();
      setServerStatus(mcpServerManager.getStatus());
    } catch (error) {
      console.error('Failed to stop MCP server:', error);
    }
  };

  const handleRestartServer = async () => {
    try {
      await mcpServerManager.restart();
      setServerStatus(mcpServerManager.getStatus());
    } catch (error) {
      console.error('Failed to restart MCP server:', error);
    }
  };

  // Update server status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setServerStatus(mcpServerManager.getStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-app-text">MCP Server</h1>
          <p className="text-sm text-app-muted mt-1">
            Configure and manage the Model Context Protocol server for external integrations
          </p>
        </div>
        <ServerStatus />
      </div>

      {/* Server Status & Controls */}
      <section className="bg-app-panel/40 border border-app-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-app-text">Server Status</h2>
            <p className="text-sm text-app-muted mt-1">
              Current MCP server status and controls
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`h-3 w-3 rounded-full ${serverStatus.isRunning ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <div>
              <span className="font-medium text-app-text">
                {serverStatus.isRunning ? 'Running' : 'Stopped'}
              </span>
              {serverStatus.isRunning && (
                <span className="text-sm text-app-muted ml-2">
                  Port {serverStatus.port}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            {!serverStatus.isRunning ? (
              <button
                onClick={handleStartServer}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Play size={16} />
                <span>Start Server</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleStopServer}
                  className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Square size={16} />
                  <span>Stop</span>
                </button>
                <button
                  onClick={handleRestartServer}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <RefreshCw size={16} />
                  <span>Restart</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {serverStatus.isRunning && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Connection Info:</strong> MCP server is running at {serverStatus.url}
            </p>
            <p className="text-xs text-green-700 mt-1">
              To connect Claude Code: <code className="bg-green-100 px-1 rounded">claude mcp add lokus --command "node" --args "test-mcp-server.js"</code>
            </p>
          </div>
        )}
      </section>

      {/* Enable/Disable Toggle */}
      <section className="bg-app-panel/40 border border-app-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-app-text">Enable MCP Server</h2>
            <p className="text-sm text-app-muted mt-1">
              Allow external applications to connect via the Model Context Protocol
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={mcpConfig.enabled}
              onChange={(e) => updateMCPConfig('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-app-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-app-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-app-accent"></div>
          </label>
        </div>
        
        {mcpConfig.enabled && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Security Notice:</strong> The MCP server will be accessible to external applications. 
                Ensure you trust all connected clients and review the API key management settings below.
              </div>
            </div>
          </div>
        )}
      </section>

      {mcpConfig.enabled && (
        <>
          {/* Basic Configuration */}
          <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
            <h2 className="text-lg font-medium text-app-text mb-4">Server Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  Host
                </label>
                <input
                  type="text"
                  value={mcpConfig.host}
                  onChange={(e) => updateMCPConfig('host', e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
                  placeholder="localhost"
                />
                <p className="text-xs text-app-muted mt-1">
                  Server host address (use 0.0.0.0 for external access)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  Port
                </label>
                <input
                  type="number"
                  min="1024"
                  max="65535"
                  value={mcpConfig.port}
                  onChange={handlePortChange}
                  className={`w-full h-10 px-3 rounded-md bg-app-bg border outline-none focus:ring-2 focus:ring-app-accent/40 ${
                    errors.port ? 'border-red-500' : 'border-app-border'
                  }`}
                  placeholder="3001"
                />
                {errors.port && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <p className="text-xs text-red-500">{errors.port}</p>
                  </div>
                )}
                <p className="text-xs text-app-muted mt-1">
                  Port number (1024-65535)
                </p>
              </div>
            </div>
          </section>

          {/* CORS Origins */}
          <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-app-text">CORS Origins</h2>
                <p className="text-sm text-app-muted">Allowed origins for cross-origin requests</p>
              </div>
              <button
                onClick={addCORSOrigin}
                className="px-3 py-1.5 text-sm bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors"
              >
                Add Origin
              </button>
            </div>
            
            <div className="space-y-2">
              {mcpConfig.corsOrigins.map((origin, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-app-bg border border-app-border rounded-md">
                  <code className="text-sm text-app-text">{origin}</code>
                  <button
                    onClick={() => removeCORSOrigin(origin)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              {mcpConfig.corsOrigins.length === 0 && (
                <p className="text-sm text-app-muted italic">No origins configured</p>
              )}
            </div>
          </section>

          {/* Rate Limiting */}
          <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
            <h2 className="text-lg font-medium text-app-text mb-4">Rate Limiting</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={mcpConfig.rateLimiting.enabled}
                  onChange={(e) => updateNestedConfig('rateLimiting', 'enabled', e.target.checked)}
                  className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent/40"
                />
                <span className="text-sm text-app-text">Enable rate limiting</span>
              </label>
              
              {mcpConfig.rateLimiting.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                  <div>
                    <label className="block text-sm font-medium text-app-text mb-2">
                      Max Requests
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={mcpConfig.rateLimiting.maxRequests}
                      onChange={(e) => updateNestedConfig('rateLimiting', 'maxRequests', parseInt(e.target.value))}
                      className="w-full h-10 px-3 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-app-text mb-2">
                      Window (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={mcpConfig.rateLimiting.windowMs}
                      onChange={(e) => updateNestedConfig('rateLimiting', 'windowMs', parseInt(e.target.value))}
                      className="w-full h-10 px-3 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Logging */}
          <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
            <h2 className="text-lg font-medium text-app-text mb-4">Logging</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={mcpConfig.logging.enabled}
                  onChange={(e) => updateNestedConfig('logging', 'enabled', e.target.checked)}
                  className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent/40"
                />
                <span className="text-sm text-app-text">Enable request logging</span>
              </label>
              
              {mcpConfig.logging.enabled && (
                <div className="ml-7">
                  <label className="block text-sm font-medium text-app-text mb-2">
                    Log Level
                  </label>
                  <select
                    value={mcpConfig.logging.level}
                    onChange={(e) => updateNestedConfig('logging', 'level', e.target.value)}
                    className="w-48 h-10 px-3 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
                  >
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Server Control Panel */}
          <ServerControlPanel 
            config={mcpConfig}
            onConfigChange={setMcpConfig}
          />

          {/* API Key Management */}
          <APIKeyManager />

          {/* Connection Monitor */}
          <ConnectionMonitor />

          {/* Metrics Dashboard */}
          <MetricsDashboard />

          {/* Log Viewer */}
          <LogViewer enabled={mcpConfig.logging.enabled} />

          {/* Save Configuration */}
          <div className="flex items-center justify-between pt-6 border-t border-app-border">
            <p className="text-sm text-app-muted">
              Changes require server restart to take effect
            </p>
            <button
              onClick={saveMCPConfig}
              disabled={saveStatus === 'saving' || Object.keys(errors).length > 0}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                saveStatus === 'saving'
                  ? 'bg-app-muted text-app-bg cursor-wait'
                  : saveStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : Object.keys(errors).length > 0
                  ? 'bg-app-border text-app-muted cursor-not-allowed'
                  : 'bg-app-accent text-app-accent-fg hover:bg-app-accent/90'
              }`}
            >
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'success'
                ? 'Saved!'
                : saveStatus === 'error'
                ? 'Error'
                : 'Save Configuration'
              }
            </button>
          </div>
        </>
      )}
    </div>
  );
}