import { useState, useEffect } from 'react';
import { BarChart3, Clock, TrendingUp, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState({
    overview: {
      totalRequests: 0,
      averageResponseTime: 0,
      successRate: 0,
      errorRate: 0
    },
    timeRanges: {
      lastHour: { requests: 0, errors: 0, avgResponseTime: 0 },
      last24Hours: { requests: 0, errors: 0, avgResponseTime: 0 },
      last7Days: { requests: 0, errors: 0, avgResponseTime: 0 }
    },
    endpoints: [],
    responseTimeHistory: [],
    errorHistory: []
  });
  
  const [timeRange, setTimeRange] = useState('24h');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [timeRange, autoRefresh]);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      
      // Simulate loading metrics - in real implementation, call Tauri command
      // const metrics = await invoke('get_server_metrics', { timeRange });
      
      const mockMetrics = {
        overview: {
          totalRequests: 15423,
          averageResponseTime: 245,
          successRate: 98.7,
          errorRate: 1.3
        },
        timeRanges: {
          lastHour: { requests: 156, errors: 3, avgResponseTime: 234 },
          last24Hours: { requests: 3847, errors: 52, avgResponseTime: 267 },
          last7Days: { requests: 15423, errors: 201, avgResponseTime: 245 }
        },
        endpoints: [
          { path: '/health', requests: 5234, avgResponseTime: 45, successRate: 100, errors: 0 },
          { path: '/resources', requests: 3847, avgResponseTime: 234, successRate: 99.1, errors: 35 },
          { path: '/tools', requests: 2945, avgResponseTime: 312, successRate: 98.9, errors: 32 },
          { path: '/prompts', requests: 2156, avgResponseTime: 189, successRate: 97.8, errors: 47 },
          { path: '/roots', requests: 1241, avgResponseTime: 156, successRate: 99.8, errors: 3 }
        ],
        responseTimeHistory: generateTimeSeriesData(24, 50, 500),
        errorHistory: generateTimeSeriesData(24, 0, 20)
      };
      
      setMetrics(mockMetrics);
      setLastUpdate(new Date());
    } catch { } finally {
      setIsLoading(false);
    }
  };

  const generateTimeSeriesData = (hours, min, max) => {
    const data = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const value = Math.floor(Math.random() * (max - min) + min);
      data.push({
        time: time.toISOString(),
        value
      });
    }
    
    return data;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getSuccessRateColor = (rate) => {
    if (rate >= 99) return 'text-green-600 dark:text-green-400';
    if (rate >= 95) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getResponseTimeColor = (time) => {
    if (time <= 200) return 'text-green-600 dark:text-green-400';
    if (time <= 500) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-app-text">Metrics Dashboard</h2>
          <p className="text-sm text-app-muted">Monitor server performance and request analytics</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-9 px-3 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
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
            onClick={loadMetrics}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-app-muted" />
            <span className="text-sm text-app-muted">Total Requests</span>
          </div>
          <div className="text-2xl font-semibold text-app-text">
            {formatNumber(metrics.overview.totalRequests)}
          </div>
          <div className="text-xs text-app-muted mt-1">
            +{formatNumber(metrics.timeRanges.last24Hours.requests)} today
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-app-muted" />
            <span className="text-sm text-app-muted">Avg Response Time</span>
          </div>
          <div className={`text-2xl font-semibold ${getResponseTimeColor(metrics.overview.averageResponseTime)}`}>
            {metrics.overview.averageResponseTime}ms
          </div>
          <div className="text-xs text-app-muted mt-1">
            {metrics.timeRanges.last24Hours.avgResponseTime}ms today
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-app-muted" />
            <span className="text-sm text-app-muted">Success Rate</span>
          </div>
          <div className={`text-2xl font-semibold ${getSuccessRateColor(metrics.overview.successRate)}`}>
            {metrics.overview.successRate.toFixed(1)}%
          </div>
          <div className="text-xs text-app-muted mt-1">
            {((1 - metrics.timeRanges.last24Hours.errors / metrics.timeRanges.last24Hours.requests) * 100).toFixed(1)}% today
          </div>
        </div>
        
        <div className="bg-app-bg border border-app-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-app-muted" />
            <span className="text-sm text-app-muted">Error Rate</span>
          </div>
          <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
            {metrics.overview.errorRate.toFixed(1)}%
          </div>
          <div className="text-xs text-app-muted mt-1">
            {metrics.timeRanges.last24Hours.errors} errors today
          </div>
        </div>
      </div>

      {/* Time Range Summary */}
      <div className="bg-app-bg border border-app-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-app-text mb-3">Time Range Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-app-muted mb-1">Last Hour</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Requests:</span>
                <span className="font-mono">{metrics.timeRanges.lastHour.requests}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Errors:</span>
                <span className="font-mono text-red-600">{metrics.timeRanges.lastHour.errors}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avg Response:</span>
                <span className="font-mono">{metrics.timeRanges.lastHour.avgResponseTime}ms</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-app-muted mb-1">Last 24 Hours</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Requests:</span>
                <span className="font-mono">{metrics.timeRanges.last24Hours.requests}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Errors:</span>
                <span className="font-mono text-red-600">{metrics.timeRanges.last24Hours.errors}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avg Response:</span>
                <span className="font-mono">{metrics.timeRanges.last24Hours.avgResponseTime}ms</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-app-muted mb-1">Last 7 Days</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Requests:</span>
                <span className="font-mono">{metrics.timeRanges.last7Days.requests}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Errors:</span>
                <span className="font-mono text-red-600">{metrics.timeRanges.last7Days.errors}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avg Response:</span>
                <span className="font-mono">{metrics.timeRanges.last7Days.avgResponseTime}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Endpoint Statistics */}
      <div className="bg-app-bg border border-app-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-app-text mb-3">Endpoint Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border/50">
                <th className="text-left py-2 text-app-muted font-medium">Endpoint</th>
                <th className="text-right py-2 text-app-muted font-medium">Requests</th>
                <th className="text-right py-2 text-app-muted font-medium">Avg Response</th>
                <th className="text-right py-2 text-app-muted font-medium">Success Rate</th>
                <th className="text-right py-2 text-app-muted font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {metrics.endpoints.map((endpoint, index) => (
                <tr key={index} className="border-b border-app-border/30 last:border-b-0">
                  <td className="py-2">
                    <code className="text-app-text bg-app-panel px-2 py-0.5 rounded text-xs">
                      {endpoint.path}
                    </code>
                  </td>
                  <td className="text-right py-2 font-mono">{formatNumber(endpoint.requests)}</td>
                  <td className={`text-right py-2 font-mono ${getResponseTimeColor(endpoint.avgResponseTime)}`}>
                    {endpoint.avgResponseTime}ms
                  </td>
                  <td className={`text-right py-2 font-mono ${getSuccessRateColor(endpoint.successRate)}`}>
                    {endpoint.successRate.toFixed(1)}%
                  </td>
                  <td className="text-right py-2 font-mono text-red-600">
                    {endpoint.errors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Response Time Chart */}
      <div className="bg-app-bg border border-app-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-app-text mb-3">Response Time Trend</h3>
        <div className="h-32 flex items-end gap-1">
          {metrics.responseTimeHistory.map((point, index) => (
            <div
              key={index}
              className="flex-1 bg-app-accent/20 hover:bg-app-accent/40 transition-colors rounded-t relative group"
              style={{ height: `${(point.value / 500) * 100}%` }}
              title={`${new Date(point.time).toLocaleTimeString()}: ${point.value}ms`}
            >
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-app-text text-app-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {point.value}ms
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-app-muted mt-2">
          <span>{timeRange === '1h' ? '1 hour ago' : timeRange === '24h' ? '24 hours ago' : '7 days ago'}</span>
          <span>Now</span>
        </div>
      </div>

      {/* Last Update Info */}
      {lastUpdate && (
        <div className="text-xs text-app-muted text-center">
          <Calendar className="w-3 h-3 inline mr-1" />
          Last updated: {lastUpdate.toLocaleTimeString()}
          {autoRefresh && ' (auto-refreshing every 10 seconds)'}
        </div>
      )}
    </section>
  );
}