import { useState, useEffect } from 'react';
import { Play, Square, RotateCcw, Activity, AlertTriangle } from 'lucide-react';

export default function ServerControlPanel({ config, onConfigChange }) {
  const [serverState, setServerState] = useState('stopped'); // stopped, starting, running, stopping, error
  const [serverPid, setServerPid] = useState(null);
  const [uptime, setUptime] = useState(0);
  const [lastError, setLastError] = useState('');
  const [serverInfo, setServerInfo] = useState({
    version: '1.0.0',
    startTime: null,
    activeConnections: 0
  });

  useEffect(() => {
    // Check server status on mount
    checkServerStatus();
    
    // Set up polling for server status
    const interval = setInterval(checkServerStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update uptime every second when server is running
    if (serverState === 'running' && serverInfo.startTime) {
      const interval = setInterval(() => {
        setUptime(Math.floor((Date.now() - serverInfo.startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [serverState, serverInfo.startTime]);

  const checkServerStatus = async () => {
    try {
      // Simulate API call to check server status
      // In real implementation, this would call a Tauri command
      const response = await fetch(`http://${config.host}:${config.port}/health`, {
        method: 'GET',
        timeout: 1000
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        setServerState('running');
        setServerInfo(prev => ({
          ...prev,
          ...data,
          startTime: prev.startTime || Date.now()
        }));
        setLastError('');
      } else {
        setServerState('stopped');
        setServerInfo(prev => ({ ...prev, startTime: null }));
        setUptime(0);
      }
    } catch (error) {
      setServerState('stopped');
      setServerInfo(prev => ({ ...prev, startTime: null }));
      setUptime(0);
    }
  };

  const startServer = async () => {
    try {
      setServerState('starting');
      setLastError('');
      
      // Simulate server start - in real implementation, call Tauri command
      // await invoke('start_mcp_server', { config });
      
      // Simulate startup delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if port is available
      const isPortAvailable = await checkPortAvailable(config.port);
      if (!isPortAvailable) {
        throw new Error(`Port ${config.port} is already in use`);
      }
      
      setServerState('running');
      setServerInfo(prev => ({
        ...prev,
        startTime: Date.now(),
        activeConnections: 0
      }));
      setUptime(0);
      
    } catch (error) {
      setServerState('error');
      setLastError(error.message || 'Failed to start server');
      setTimeout(() => setServerState('stopped'), 3000);
    }
  };

  const stopServer = async () => {
    try {
      setServerState('stopping');
      setLastError('');
      
      // Simulate server stop - in real implementation, call Tauri command
      // await invoke('stop_mcp_server');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setServerState('stopped');
      setServerInfo(prev => ({ ...prev, startTime: null, activeConnections: 0 }));
      setUptime(0);
      
    } catch (error) {
      setServerState('error');
      setLastError(error.message || 'Failed to stop server');
      setTimeout(() => setServerState('running'), 3000);
    }
  };

  const restartServer = async () => {
    if (serverState === 'running') {
      await stopServer();
      // Wait a bit before starting
      setTimeout(startServer, 1500);
    } else {
      await startServer();
    }
  };

  const checkPortAvailable = async (port) => {
    // Simulate port check - in real implementation, this would be a Tauri command
    return new Promise(resolve => {
      setTimeout(() => {
        // Randomly fail sometimes to simulate port conflicts
        resolve(Math.random() > 0.1);
      }, 500);
    });
  };

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = () => {
    switch (serverState) {
      case 'running': return 'text-green-600 dark:text-green-400';
      case 'stopped': return 'text-gray-500 dark:text-gray-400';
      case 'starting': case 'stopping': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (serverState) {
      case 'running': return <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default: return <div className="w-5 h-5 rounded-full bg-gray-400" />;
    }
  };

  return (
    <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-app-text">Server Control</h2>
          <p className="text-sm text-app-muted">Start, stop, and monitor the MCP server</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium capitalize ${getStatusColor()}`}>
              {serverState}
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={startServer}
              disabled={serverState === 'running' || serverState === 'starting' || !config.enabled}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700 disabled:hover:bg-green-600"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
            
            <button
              onClick={stopServer}
              disabled={serverState === 'stopped' || serverState === 'stopping'}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
            
            <button
              onClick={restartServer}
              disabled={serverState === 'starting' || serverState === 'stopping' || !config.enabled}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-app-accent text-app-accent-fg hover:bg-app-accent/90"
            >
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>
          </div>
        </div>
      </div>

      {/* Server Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="text-sm text-app-muted mb-1">Server Address</div>
          <div className="text-lg font-mono text-app-text">
            {config.host}:{config.port}
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="text-sm text-app-muted mb-1">Uptime</div>
          <div className="text-lg font-mono text-app-text">
            {serverState === 'running' ? formatUptime(uptime) : '--'}
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="text-sm text-app-muted mb-1">Active Connections</div>
          <div className="text-lg font-mono text-app-text">
            {serverState === 'running' ? serverInfo.activeConnections : '--'}
          </div>
        </div>
      </div>

      {/* Server Details */}
      {serverState === 'running' && (
        <div className="mt-6 bg-app-bg border border-app-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-app-text mb-3">Server Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-app-muted">Version:</span>
              <span className="text-app-text font-mono">{serverInfo.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-app-muted">PID:</span>
              <span className="text-app-text font-mono">{serverPid || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-app-muted">Start Time:</span>
              <span className="text-app-text font-mono">
                {serverInfo.startTime ? new Date(serverInfo.startTime).toLocaleTimeString() : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-app-muted">Rate Limiting:</span>
              <span className="text-app-text">
                {config.rateLimiting?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {lastError && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <strong>Error:</strong> {lastError}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {serverState === 'running' && (
        <div className="mt-6 pt-4 border-t border-app-border">
          <div className="text-sm text-app-muted mb-3">Quick Actions</div>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`http://${config.host}:${config.port}/health`, '_blank')}
              className="px-3 py-1.5 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors"
            >
              Health Check
            </button>
            <button
              onClick={() => window.open(`http://${config.host}:${config.port}/docs`, '_blank')}
              className="px-3 py-1.5 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors"
            >
              API Docs
            </button>
            <button
              onClick={checkServerStatus}
              className="px-3 py-1.5 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )}
    </section>
  );
}