import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Trash2, Search, Filter, RefreshCw, Play, Pause } from 'lucide-react';

export default function LogViewer({ enabled = true }) {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const logContainerRef = useRef(null);

  const logLevels = ['all', 'debug', 'info', 'warn', 'error'];

  useEffect(() => {
    if (enabled && !isPaused) {
      loadLogs();
      const interval = setInterval(loadLogs, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [enabled, isPaused]);

  useEffect(() => {
    // Filter logs based on search query and level filter
    let filtered = logs;
    
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.method?.toLowerCase().includes(query) ||
        log.path?.toLowerCase().includes(query) ||
        log.clientId?.toLowerCase().includes(query)
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, searchQuery, levelFilter]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, isAutoScroll]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      
      // Simulate loading logs - in real implementation, call Tauri command
      // const newLogs = await invoke('get_mcp_logs', { limit: 100 });
      
      const mockLogs = [
        {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Client connected successfully',
          clientId: 'dev-client-001',
          method: 'GET',
          path: '/health',
          statusCode: 200,
          responseTime: 45,
          userAgent: 'MCP-Client/1.2.0'
        },
        {
          id: Date.now() + Math.random() + 1,
          timestamp: new Date(Date.now() - 5000).toISOString(),
          level: 'warn',
          message: 'Rate limit warning for client',
          clientId: 'prod-bot-001',
          method: 'POST',
          path: '/resources',
          statusCode: 429,
          responseTime: 234,
          userAgent: 'MCP-Bot/2.0.1'
        },
        {
          id: Date.now() + Math.random() + 2,
          timestamp: new Date(Date.now() - 10000).toISOString(),
          level: 'error',
          message: 'Authentication failed - invalid API key',
          clientId: 'unknown',
          method: 'GET',
          path: '/tools',
          statusCode: 401,
          responseTime: 12,
          userAgent: 'curl/7.68.0'
        },
        {
          id: Date.now() + Math.random() + 3,
          timestamp: new Date(Date.now() - 15000).toISOString(),
          level: 'debug',
          message: 'Processing tool execution request',
          clientId: 'test-client-001',
          method: 'POST',
          path: '/tools/execute',
          statusCode: 200,
          responseTime: 567,
          userAgent: 'MCP-Test/0.9.0'
        }
      ];
      
      // Add new logs to existing ones (simulating real-time updates)
      setLogs(prev => {
        const combined = [...prev, ...mockLogs];
        // Keep only last 1000 logs to prevent memory issues
        return combined.slice(-1000);
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      // Clear logs - in real implementation, call Tauri command
      // await invoke('clear_mcp_logs');
      setLogs([]);
      setFilteredLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const exportLogs = async () => {
    try {
      const logData = filteredLogs.map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        clientId: log.clientId,
        method: log.method,
        path: log.path,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        userAgent: log.userAgent
      }));

      const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-logs-${new Date().toISOString().slice(0, 19)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'debug': return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
      case 'info': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'warn': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'error': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusCodeColor = (code) => {
    if (code >= 200 && code < 300) return 'text-green-600 dark:text-green-400';
    if (code >= 300 && code < 400) return 'text-blue-600 dark:text-blue-400';
    if (code >= 400 && code < 500) return 'text-yellow-600 dark:text-yellow-400';
    if (code >= 500) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  if (!enabled) {
    return (
      <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
        <div className="text-center py-8 text-app-muted">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Logging is disabled</p>
          <p className="text-sm">Enable logging in the server configuration to view request logs</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-app-text">Request Logs</h2>
          <p className="text-sm text-app-muted">Real-time server request and error logs</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              isPaused 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          
          <button
            onClick={exportLogs}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <button
            onClick={clearLogs}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-10 pr-3 h-9 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-app-muted" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-9 px-3 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
          >
            {logLevels.map(level => (
              <option key={level} value={level}>
                {level === 'all' ? 'All Levels' : level.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        
        <label className="flex items-center gap-2 text-sm text-app-text">
          <input
            type="checkbox"
            checked={isAutoScroll}
            onChange={(e) => setIsAutoScroll(e.target.checked)}
            className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent/40"
          />
          Auto-scroll
        </label>
      </div>

      {/* Log Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        {logLevels.slice(1).map(level => (
          <div key={level} className="bg-app-bg border border-app-border rounded-lg p-3">
            <div className="text-xs text-app-muted mb-1">{level.toUpperCase()}</div>
            <div className="text-lg font-semibold text-app-text">
              {logs.filter(log => log.level === level).length}
            </div>
          </div>
        ))}
        <div className="bg-app-bg border border-app-border rounded-lg p-3">
          <div className="text-xs text-app-muted mb-1">TOTAL</div>
          <div className="text-lg font-semibold text-app-text">{logs.length}</div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-app-bg border border-app-border rounded-lg overflow-hidden">
        <div
          ref={logContainerRef}
          className="h-96 overflow-y-auto font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-app-muted">
              {logs.length === 0 ? 'No logs available' : 'No logs match the current filters'}
            </div>
          ) : (
            <div className="space-y-1 p-4">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-12 gap-3 py-2 border-b border-app-border/30 last:border-b-0 hover:bg-app-panel/30 transition-colors"
                >
                  <div className="col-span-2 text-xs text-app-muted">
                    {formatTimestamp(log.timestamp)}
                  </div>
                  
                  <div className="col-span-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-xs">
                    <div className="text-app-text">{log.method}</div>
                    <div className="text-app-muted truncate">{log.path}</div>
                  </div>
                  
                  <div className="col-span-1 text-xs">
                    <span className={`font-medium ${getStatusCodeColor(log.statusCode)}`}>
                      {log.statusCode}
                    </span>
                  </div>
                  
                  <div className="col-span-1 text-xs text-app-muted">
                    {log.responseTime}ms
                  </div>
                  
                  <div className="col-span-2 text-xs text-app-muted truncate">
                    {log.clientId}
                  </div>
                  
                  <div className="col-span-3 text-xs text-app-text">
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between mt-4 text-xs text-app-muted">
        <div className="flex items-center gap-4">
          <span>Showing {filteredLogs.length} of {logs.length} logs</span>
          {isPaused && (
            <span className="text-yellow-600 dark:text-yellow-400">⏸ Paused</span>
          )}
          {isLoading && (
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          )}
        </div>
        
        {lastUpdate && (
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        )}
      </div>
    </section>
  );
}