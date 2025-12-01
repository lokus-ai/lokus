import { useState, useEffect } from 'react';
import { Users, Clock, Globe, Activity, X, RefreshCw } from 'lucide-react';

export default function ConnectionMonitor() {
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadConnections();
    
    if (autoRefresh) {
      const interval = setInterval(loadConnections, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      
      // Simulate loading connections - in real implementation, call Tauri command
      // const connections = await invoke('get_active_connections');
      
      const mockConnections = [
        {
          id: 'conn_1',
          clientId: 'dev-client-001',
          clientName: 'Development Environment',
          clientVersion: '1.2.0',
          ipAddress: '127.0.0.1',
          userAgent: 'MCP-Client/1.2.0 (Development)',
          connectedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          lastActivity: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          requestCount: 45,
          apiKey: 'mcp_dev_abc123...vwx234yz',
          status: 'active',
          permissions: ['read', 'write']
        },
        {
          id: 'conn_2',
          clientId: 'prod-bot-001',
          clientName: 'Production Bot',
          clientVersion: '2.0.1',
          ipAddress: '192.168.1.100',
          userAgent: 'MCP-Bot/2.0.1 (Production)',
          connectedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          lastActivity: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          requestCount: 234,
          apiKey: 'mcp_prod_zyx987...edc876ba',
          status: 'active',
          permissions: ['read']
        },
        {
          id: 'conn_3',
          clientId: 'test-client-001',
          clientName: 'Test Runner',
          clientVersion: '0.9.0',
          ipAddress: '127.0.0.1',
          userAgent: 'MCP-Test/0.9.0 (Testing)',
          connectedAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
          lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          requestCount: 12,
          apiKey: 'mcp_test_111222...ddddeee',
          status: 'idle',
          permissions: ['read', 'write', 'admin']
        }
      ];
      
      setConnections(mockConnections);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectClient = async (connectionId) => {
    try {
      // Disconnect client - in real implementation, call Tauri command
      // await invoke('disconnect_client', { connectionId });
      
      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    } catch (error) {
      console.error('Failed to disconnect client:', error);
    }
  };

  const formatDuration = (isoString) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return '<1m';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'idle': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'disconnected': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getPermissionColor = (permission) => {
    switch (permission) {
      case 'read': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'write': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-app-text">Active Connections</h2>
          <p className="text-sm text-app-muted">Monitor connected MCP clients and their activity</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-app-text">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent/40"
            />
            Auto-refresh
          </label>
          
          <button
            onClick={loadConnections}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-app-muted" />
            <span className="text-sm text-app-muted">Total Connections</span>
          </div>
          <div className="text-2xl font-semibold text-app-text">{connections.length}</div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-600" />
            <span className="text-sm text-app-muted">Active</span>
          </div>
          <div className="text-2xl font-semibold text-green-600">
            {connections.filter(c => c.status === 'active').length}
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-app-muted">Idle</span>
          </div>
          <div className="text-2xl font-semibold text-yellow-600">
            {connections.filter(c => c.status === 'idle').length}
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-app-muted" />
            <span className="text-sm text-app-muted">Total Requests</span>
          </div>
          <div className="text-2xl font-semibold text-app-text">
            {connections.reduce((sum, c) => sum + c.requestCount, 0)}
          </div>
        </div>
      </div>

      {/* Connections List */}
      <div className="space-y-4">
        {connections.length === 0 ? (
          <div className="text-center py-8 text-app-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No active connections</p>
            <p className="text-sm">Clients will appear here when they connect to the MCP server</p>
          </div>
        ) : (
          connections.map((connection) => (
            <div key={connection.id} className="bg-app-bg border border-app-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-app-text">{connection.clientName}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(connection.status)}`}>
                      {connection.status}
                    </span>
                    <div className="flex gap-1">
                      {connection.permissions.map((permission) => (
                        <span
                          key={permission}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPermissionColor(permission)}`}
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-sm text-app-muted space-y-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <span className="font-medium">Client ID:</span>
                        <br />
                        <code className="text-xs">{connection.clientId}</code>
                      </div>
                      <div>
                        <span className="font-medium">Version:</span>
                        <br />
                        {connection.clientVersion}
                      </div>
                      <div>
                        <span className="font-medium">IP Address:</span>
                        <br />
                        {connection.ipAddress}
                      </div>
                      <div>
                        <span className="font-medium">Requests:</span>
                        <br />
                        {connection.requestCount.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-app-border/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">Connected:</span> {formatDuration(connection.connectedAt)} ago
                        </div>
                        <div>
                          <span className="font-medium">Last Activity:</span> {formatDuration(connection.lastActivity)} ago
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <div className="text-xs text-app-muted">
                        <span className="font-medium">User Agent:</span> {connection.userAgent}
                      </div>
                      <div className="text-xs text-app-muted">
                        <span className="font-medium">API Key:</span> <code>{connection.apiKey}</code>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => disconnectClient(connection.id)}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Disconnect client"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Last Update Info */}
      {lastUpdate && (
        <div className="mt-4 pt-4 border-t border-app-border text-xs text-app-muted text-center">
          Last updated: {lastUpdate.toLocaleTimeString()}
          {autoRefresh && ' (auto-refreshing every 5 seconds)'}
        </div>
      )}
    </section>
  );
}