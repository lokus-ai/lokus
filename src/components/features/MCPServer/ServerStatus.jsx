import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Clock, Wifi, WifiOff } from 'lucide-react';

export default function ServerStatus() {
  const [status, setStatus] = useState({
    state: 'stopped', // stopped, starting, running, stopping, error
    uptime: 0,
    connections: 0,
    lastCheck: null,
    health: {
      healthy: false,
      latency: null,
      error: null
    }
  });

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const checkServerStatus = async () => {
    try {
      const startTime = performance.now();
      
      // Simulate health check - in real implementation, call Tauri command or HTTP endpoint
      // const response = await fetch('http://localhost:3001/health');
      
      // Simulate different server states
      const mockStates = ['running', 'stopped', 'error'];
      const randomState = mockStates[Math.floor(Math.random() * mockStates.length)];
      
      if (randomState === 'running') {
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        
        setStatus(prev => ({
          ...prev,
          state: 'running',
          uptime: prev.state === 'running' ? prev.uptime + 3 : 0,
          connections: Math.floor(Math.random() * 5) + 1,
          lastCheck: new Date(),
          health: {
            healthy: true,
            latency,
            error: null
          }
        }));
      } else if (randomState === 'error') {
        setStatus(prev => ({
          ...prev,
          state: 'error',
          uptime: 0,
          connections: 0,
          lastCheck: new Date(),
          health: {
            healthy: false,
            latency: null,
            error: 'Connection timeout'
          }
        }));
      } else {
        setStatus(prev => ({
          ...prev,
          state: 'stopped',
          uptime: 0,
          connections: 0,
          lastCheck: new Date(),
          health: {
            healthy: false,
            latency: null,
            error: null
          }
        }));
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        state: 'error',
        uptime: 0,
        connections: 0,
        lastCheck: new Date(),
        health: {
          healthy: false,
          latency: null,
          error: error.message || 'Health check failed'
        }
      }));
    }
  };

  const formatUptime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getStatusIcon = () => {
    switch (status.state) {
      case 'running':
        return <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'starting':
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-pulse" />;
      case 'stopping':
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-pulse" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'stopped':
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-400 dark:bg-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status.state) {
      case 'running': return 'text-green-600 dark:text-green-400';
      case 'starting': case 'stopping': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'stopped': default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status.state) {
      case 'running': return 'Running';
      case 'starting': return 'Starting';
      case 'stopping': return 'Stopping';
      case 'error': return 'Error';
      case 'stopped': default: return 'Stopped';
    }
  };

  const getHealthIcon = () => {
    if (status.state !== 'running') return null;
    
    if (status.health.healthy) {
      return <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />;
    } else {
      return <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
  };

  return (
    <div className="bg-app-bg border border-app-border rounded-lg p-4 min-w-64">
      {/* Main Status */}
      <div className="flex items-center gap-3 mb-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className={`font-medium ${getStatusColor()}`}>
            MCP Server {getStatusText()}
          </div>
          {status.state === 'running' && (
            <div className="text-sm text-app-muted">
              Uptime: {formatUptime(status.uptime)}
            </div>
          )}
          {status.state === 'error' && status.health.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {status.health.error}
            </div>
          )}
        </div>
        {getHealthIcon()}
      </div>

      {/* Details */}
      {status.state === 'running' && (
        <div className="space-y-2 pt-2 border-t border-app-border/50">
          <div className="flex justify-between text-sm">
            <span className="text-app-muted">Connections:</span>
            <span className="text-app-text font-medium">{status.connections}</span>
          </div>
          
          {status.health.latency !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-app-muted">Latency:</span>
              <span className={`font-medium ${
                status.health.latency < 100 
                  ? 'text-green-600 dark:text-green-400'
                  : status.health.latency < 500
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {status.health.latency}ms
              </span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-app-muted">Status:</span>
            <span className="text-green-600 dark:text-green-400 font-medium">Healthy</span>
          </div>
        </div>
      )}

      {/* Last Check */}
      {status.lastCheck && (
        <div className="mt-3 pt-2 border-t border-app-border/50 text-xs text-app-muted text-center">
          Last check: {status.lastCheck.toLocaleTimeString()}
        </div>
      )}

      {/* Quick Actions for Running State */}
      {status.state === 'running' && (
        <div className="mt-3 pt-2 border-t border-app-border/50">
          <div className="flex gap-2">
            <button
              onClick={() => window.open('http://localhost:3001/health', '_blank')}
              className="flex-1 px-2 py-1 text-xs border border-app-border rounded hover:bg-app-panel transition-colors"
            >
              Health Check
            </button>
            <button
              onClick={() => window.open('http://localhost:3001/docs', '_blank')}
              className="flex-1 px-2 py-1 text-xs border border-app-border rounded hover:bg-app-panel transition-colors"
            >
              API Docs
            </button>
          </div>
        </div>
      )}

      {/* Connection Indicator */}
      <div className="mt-3 flex items-center justify-center">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          status.state === 'running' && status.health.healthy
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
            : status.state === 'error'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status.state === 'running' && status.health.healthy
              ? 'bg-green-500 animate-pulse'
              : status.state === 'error'
              ? 'bg-red-500'
              : 'bg-gray-400'
          }`} />
          {status.state === 'running' && status.health.healthy
            ? 'Connected'
            : status.state === 'error'
            ? 'Disconnected'
            : 'Offline'
          }
        </div>
      </div>
    </div>
  );
}