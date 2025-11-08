import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Server,
  Zap,
  Clock,
  RefreshCw,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Info,
  Disc,
  Network,
  ThermometerSun,
  Power,
  Package
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { useTheme } from '../hooks/theme.jsx';

/**
 * SystemMonitor Component
 * Real-time system monitoring with CPU, Memory, Processes, and System Info
 */
export default function SystemMonitor() {
  // Subscribe to theme changes to trigger re-renders
  const { theme } = useTheme();
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [lokusMetrics, setLokusMetrics] = useState(null);
  const [startupMetrics, setStartupMetrics] = useState(null);
  const [performanceEvents, setPerformanceEvents] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'cpu_usage', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [memHistory, setMemHistory] = useState([]);
  const [lokusCpuHistory, setLokusCpuHistory] = useState([]);
  const [lokusMemHistory, setLokusMemHistory] = useState([]);
  const [expandedProcess, setExpandedProcess] = useState(null);

  const unlistenRef = useRef(null);
  const maxHistoryPoints = 60; // 1 minute of history at 1s intervals

  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format percentage
  const formatPercent = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  // Format uptime
  const formatUptime = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Load system info and startup metrics on mount
  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        const info = await invoke('monitor_get_system_info');
        setSystemInfo(info);

        // Load startup metrics
        try {
          const startup = await invoke('monitor_get_startup_metrics');
          setStartupMetrics(startup);
        } catch (err) {
          console.log('Startup metrics not available yet');
        }

        setLoading(false);
      } catch (err) {
        setError(`Failed to load system info: ${err}`);
        setLoading(false);
      }
    };

    loadSystemInfo();
  }, []);

  // Start monitoring on mount
  useEffect(() => {
    startMonitoring();
    return () => {
      stopMonitoring();
    };
  }, []);

  // Start monitoring
  const startMonitoring = async () => {
    try {
      // Start broadcast
      await invoke('monitor_start_broadcast', { intervalMs: 1000 });
      setIsMonitoring(true);

      // Listen for metrics
      const unlisten = await listen('system:metrics', (event) => {
        const metricsData = event.payload;
        setMetrics(metricsData);

        // Update CPU history
        setCpuHistory(prev => {
          const newHistory = [...prev, metricsData.cpu_usage];
          if (newHistory.length > maxHistoryPoints) {
            newHistory.shift();
          }
          return newHistory;
        });

        // Update memory history
        setMemHistory(prev => {
          const memPercent = (metricsData.memory_used / metricsData.memory_total) * 100;
          const newHistory = [...prev, memPercent];
          if (newHistory.length > maxHistoryPoints) {
            newHistory.shift();
          }
          return newHistory;
        });

        // Also fetch Lokus metrics
        fetchLokusMetrics();
      });

      unlistenRef.current = unlisten;

      // Initial fetch of Lokus metrics
      fetchLokusMetrics();
    } catch (err) {
      setError(`Failed to start monitoring: ${err}`);
    }
  };

  // Fetch Lokus's own metrics
  const fetchLokusMetrics = async () => {
    try {
      const lokus = await invoke('monitor_get_lokus_metrics');
      setLokusMetrics(lokus);

      // Update Lokus CPU history
      setLokusCpuHistory(prev => {
        const newHistory = [...prev, lokus.cpu_usage];
        if (newHistory.length > maxHistoryPoints) {
          newHistory.shift();
        }
        return newHistory;
      });

      // Update Lokus memory history
      setLokusMemHistory(prev => {
        const newHistory = [...prev, lokus.memory_percent];
        if (newHistory.length > maxHistoryPoints) {
          newHistory.shift();
        }
        return newHistory;
      });
    } catch (err) {
      // Silently fail - Lokus metrics might not be available yet
    }
  };

  // Stop monitoring
  const stopMonitoring = async () => {
    try {
      await invoke('monitor_stop_broadcast');
      setIsMonitoring(false);

      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
    }
  };

  // Toggle monitoring
  const toggleMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  // Load processes
  const loadProcesses = async () => {
    try {
      const processList = await invoke('monitor_get_processes', { limit: 20 });
      setProcesses(processList);
    } catch (err) {
      setError(`Failed to load processes: ${err}`);
    }
  };

  // Load processes when tab changes
  useEffect(() => {
    if (activeTab === 'processes') {
      loadProcesses();
    }
  }, [activeTab]);

  // Sort processes
  const sortedProcesses = React.useMemo(() => {
    const sorted = [...processes];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'name') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [processes, sortConfig]);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Render metric card
  const MetricCard = ({ icon: Icon, title, value, subtitle, color, trend }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon size={20} style={{ color: color || 'rgb(var(--accent))' }} />
          <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
            {title}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-3xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
            {value}
          </div>
          {subtitle && (
            <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
              {subtitle}
            </div>
          )}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs mt-2"
               style={{ color: trend > 0 ? 'rgb(var(--danger))' : 'rgb(var(--success))' }}>
            {trend > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render simple line chart
  const LineChart = ({ data, color, height = 100, label }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
      if (!canvasRef.current || data.length === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const chartHeight = canvas.height;

      // Get computed CSS variables for proper theme colors
      const computedStyle = getComputedStyle(document.documentElement);
      const borderColor = computedStyle.getPropertyValue('--border').trim();

      // Clear canvas
      ctx.clearRect(0, 0, width, chartHeight);

      // Draw grid with theme-aware border color
      const gridColor = borderColor.includes('rgb')
        ? borderColor.replace('rgb(', 'rgba(').replace(')', ', 0.3)')
        : `rgba(${borderColor}, 0.3)`;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw line
      if (data.length < 2) return;

      const max = Math.max(...data, 100);
      const min = 0;
      const range = max - min;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.forEach((value, index) => {
        const x = (width / (data.length - 1)) * index;
        const y = chartHeight - ((value - min) / range) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Fill area under line
      ctx.lineTo(width, chartHeight);
      ctx.lineTo(0, chartHeight);
      ctx.closePath();
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ', 0.1)');
      ctx.fill();

    }, [data, color, theme]);

    return (
      <div className="w-full">
        <div className="text-xs mb-2 font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
          {label}
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={height}
          className="w-full rounded"
          style={{ height: `${height}px`, backgroundColor: 'rgb(var(--bg))' }}
        />
      </div>
    );
  };

  // Render overview tab
  const renderOverview = () => {
    if (!metrics) {
      return (
        <div className="flex items-center justify-center h-[400px]" style={{ color: 'rgb(var(--muted))' }}>
          <RefreshCw size={24} className="animate-spin" />
          <span className="ml-2">Loading metrics...</span>
        </div>
      );
    }

    const memPercent = (metrics.memory_used / metrics.memory_total) * 100;

    return (
      <div className="flex flex-col gap-6">
        {/* Lokus App Performance - PRIMARY */}
        {lokusMetrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package size={20} style={{ color: '#8b5cf6' }} />
                Lokus App Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-sm mb-2" style={{ color: 'rgb(var(--muted))' }}>CPU Usage</div>
                  <div className="text-4xl font-semibold" style={{ color: '#8b5cf6' }}>
                    {formatPercent(lokusMetrics.cpu_usage)}
                  </div>
                </div>
                <div>
                  <div className="text-sm mb-2" style={{ color: 'rgb(var(--muted))' }}>Memory Usage</div>
                  <div className="text-4xl font-semibold" style={{ color: '#8b5cf6' }}>
                    {formatBytes(lokusMetrics.memory_usage)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'rgb(var(--muted))' }}>
                    {formatPercent(lokusMetrics.memory_percent)} of total
                  </div>
                </div>
              </div>

              {/* Lokus Performance Charts */}
              <div className="flex flex-col gap-6">
                <LineChart
                  data={lokusCpuHistory}
                  color="#8b5cf6"
                  height={100}
                  label={`Lokus CPU - Current: ${formatPercent(lokusMetrics.cpu_usage)}`}
                />
                <LineChart
                  data={lokusMemHistory}
                  color="#8b5cf6"
                  height={100}
                  label={`Lokus Memory - Current: ${formatPercent(lokusMetrics.memory_percent)}`}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Resources - SECONDARY */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor size={18} style={{ color: 'rgb(var(--muted))' }} />
              <span style={{ color: 'rgb(var(--muted))' }}>System Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs mb-1" style={{ color: 'rgb(var(--muted))' }}>System CPU</div>
                <div className="text-2xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
                  {formatPercent(metrics.cpu_usage)}
                </div>
                <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                  {systemInfo ? `${systemInfo.cpu_count} cores` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'rgb(var(--muted))' }}>System Memory</div>
                <div className="text-2xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
                  {formatBytes(metrics.memory_used)}
                </div>
                <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                  {formatPercent(memPercent)} of {formatBytes(metrics.memory_total)}
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: 'rgb(var(--muted))' }}>Processes</div>
                <div className="text-2xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
                  {metrics.process_count}
                </div>
                <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render processes tab
  const renderProcesses = () => {
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Server size={18} style={{ color: 'rgb(var(--accent))' }} />
            <h3 className="m-0 text-base font-semibold" style={{ color: 'rgb(var(--text))' }}>
              Top 20 Processes
            </h3>
          </div>

          <Button onClick={loadProcesses} variant="outline" size="sm">
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>

        {/* Process Table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: 'rgb(var(--bg))', borderBottom: '1px solid rgb(var(--border))' }}>
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                    style={{ color: 'rgb(var(--text))' }}
                    onClick={() => handleSort('pid')}
                  >
                    PID {sortConfig.key === 'pid' && (
                      sortConfig.direction === 'desc' ? '↓' : '↑'
                    )}
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                    style={{ color: 'rgb(var(--text))' }}
                    onClick={() => handleSort('name')}
                  >
                    Name {sortConfig.key === 'name' && (
                      sortConfig.direction === 'desc' ? '↓' : '↑'
                    )}
                  </th>
                  <th
                    className="px-4 py-3 text-right font-semibold cursor-pointer select-none"
                    style={{ color: 'rgb(var(--text))' }}
                    onClick={() => handleSort('cpu_usage')}
                  >
                    CPU {sortConfig.key === 'cpu_usage' && (
                      sortConfig.direction === 'desc' ? '↓' : '↑'
                    )}
                  </th>
                  <th
                    className="px-4 py-3 text-right font-semibold cursor-pointer select-none"
                    style={{ color: 'rgb(var(--text))' }}
                    onClick={() => handleSort('memory_usage')}
                  >
                    Memory {sortConfig.key === 'memory_usage' && (
                      sortConfig.direction === 'desc' ? '↓' : '↑'
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProcesses.map((process, index) => (
                  <tr
                    key={process.pid}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: index < sortedProcesses.length - 1
                        ? '1px solid rgb(var(--border))'
                        : 'none'
                    }}
                    onClick={() => setExpandedProcess(
                      expandedProcess === process.pid ? null : process.pid
                    )}
                  >
                    <td className="px-4 py-3" style={{ color: 'rgb(var(--muted))' }}>
                      {process.pid}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'rgb(var(--text))' }}>
                      <div className="flex items-center gap-2">
                        {expandedProcess === process.pid ? (
                          <ChevronDown size={14} style={{ color: 'rgb(var(--muted))' }} />
                        ) : (
                          <ChevronRight size={14} style={{ color: 'rgb(var(--muted))' }} />
                        )}
                        {process.name}
                      </div>
                      {expandedProcess === process.pid && process.cmd && (
                        <div className="mt-2 p-2 rounded text-xs font-mono break-all"
                             style={{ backgroundColor: 'rgb(var(--bg))', color: 'rgb(var(--muted))' }}>
                          {process.cmd}
                        </div>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      style={{ color: process.cpu_usage > 50 ? 'rgb(var(--danger))' : 'rgb(var(--text))' }}
                    >
                      {formatPercent(process.cpu_usage)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'rgb(var(--text))' }}>
                      {formatBytes(process.memory_usage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render system info tab
  const renderSystemInfo = () => {
    if (!systemInfo) {
      return (
        <div className="flex items-center justify-center h-[400px]" style={{ color: 'rgb(var(--muted))' }}>
          Loading system information...
        </div>
      );
    }

    const InfoSection = ({ icon: Icon, title, items }) => (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon size={18} style={{ color: 'rgb(var(--accent))' }} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {items.map((item, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm pb-3"
                     style={{ borderBottom: index < items.length - 1 ? '1px solid rgb(var(--border))' : 'none' }}>
                  <span style={{ color: 'rgb(var(--muted))' }}>{item.label}</span>
                  <span className="font-medium text-right max-w-[60%] break-words" style={{ color: 'rgb(var(--text))' }}>
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );

    const uptimeSeconds = Math.floor(Date.now() / 1000) - systemInfo.boot_time;

    return (
      <div className="flex flex-col gap-4">
        <InfoSection
          icon={Monitor}
          title="System"
          items={[
            { label: 'Operating System', value: systemInfo.os },
            { label: 'Version', value: systemInfo.os_version },
            { label: 'Kernel', value: systemInfo.kernel_version },
            { label: 'Hostname', value: systemInfo.hostname },
            { label: 'Uptime', value: formatUptime(uptimeSeconds) }
          ]}
        />

        <InfoSection
          icon={Cpu}
          title="Processor"
          items={[
            { label: 'CPU Brand', value: systemInfo.cpu_brand },
            { label: 'Cores', value: `${systemInfo.cpu_count} cores` }
          ]}
        />

        <InfoSection
          icon={MemoryStick}
          title="Memory"
          items={[
            { label: 'Total RAM', value: formatBytes(systemInfo.total_memory) }
          ]}
        />
      </div>
    );
  };

  // Render startup performance tab
  const renderStartupPerformance = () => {
    const formatMilliseconds = (ms) => {
      if (ms === null || ms === undefined || isNaN(ms)) return 'N/A';
      if (ms < 1000) return `${ms.toFixed(0)}ms`;
      return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatTimestamp = (timestamp) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Startup Metrics Summary */}
        {startupMetrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap size={18} style={{ color: 'rgb(var(--accent))' }} />
                Startup Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5">
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'rgb(var(--muted))' }}>
                    Total Startup Time
                  </div>
                  <div className="text-2xl font-semibold" style={{ color: 'rgb(var(--accent))' }}>
                    {formatMilliseconds(startupMetrics.total_startup_time)}
                  </div>
                </div>
                {startupMetrics.tauri_init_time && (
                  <div>
                    <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'rgb(var(--muted))' }}>
                      Tauri Init
                    </div>
                    <div className="text-xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
                      {formatMilliseconds(startupMetrics.tauri_init_time)}
                    </div>
                  </div>
                )}
                {startupMetrics.window_create_time && (
                  <div>
                    <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'rgb(var(--muted))' }}>
                      Window Create
                    </div>
                    <div className="text-xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
                      {formatMilliseconds(startupMetrics.window_create_time)}
                    </div>
                  </div>
                )}
                {startupMetrics.frontend_load_time && (
                  <div>
                    <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'rgb(var(--muted))' }}>
                      Frontend Load
                    </div>
                    <div className="text-xl font-semibold" style={{ color: 'rgb(var(--text))' }}>
                      {formatMilliseconds(startupMetrics.frontend_load_time)}
                    </div>
                  </div>
                )}
              </div>

              {/* Startup Phases Timeline */}
              {startupMetrics.phases && startupMetrics.phases.length > 0 && (
                <div>
                  <Separator className="mb-4" />
                  <div className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--text))' }}>
                    Startup Phases
                  </div>
                  <div className="flex flex-col gap-2">
                    {startupMetrics.phases.map((phase, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 rounded text-sm"
                        style={{ backgroundColor: 'rgb(var(--bg))' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 rounded" style={{ background: 'rgb(var(--accent))' }} />
                          <span style={{ color: 'rgb(var(--text))' }}>{phase.name}</span>
                        </div>
                        <span className="font-medium" style={{ color: 'rgb(var(--accent))' }}>
                          {formatMilliseconds(phase.duration_ms)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Performance Events Log */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Clock size={18} style={{ color: 'rgb(var(--accent))' }} />
                Recent Performance Events
              </CardTitle>
              <Button
                onClick={async () => {
                  try {
                    const events = await invoke('monitor_get_performance_events');
                    setPerformanceEvents(events);
                  } catch (err) {
                    console.error('Failed to load performance events:', err);
                  }
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw size={14} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {performanceEvents.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-[400px] overflow-auto">
                {performanceEvents.slice().reverse().map((event, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start p-3 rounded text-sm"
                    style={{ backgroundColor: 'rgb(var(--bg))' }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge>{event.event_type}</Badge>
                        <span className="font-medium" style={{ color: 'rgb(var(--text))' }}>{event.operation}</span>
                      </div>
                      {event.metadata && (
                        <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                          {event.metadata}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-medium" style={{ color: 'rgb(var(--accent))' }}>
                        {formatMilliseconds(event.duration_ms)}
                      </div>
                      <div className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm" style={{ color: 'rgb(var(--muted))' }}>
                No performance events logged yet. Events will appear here as file operations and other activities occur.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Main render
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen"
           style={{ backgroundColor: 'rgb(var(--bg))', color: 'rgb(var(--text))' }}>
        <RefreshCw size={32} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4"
           style={{ backgroundColor: 'rgb(var(--bg))', color: 'rgb(var(--danger))' }}>
        <Activity size={48} />
        <div className="text-base font-semibold">Error</div>
        <div className="text-sm" style={{ color: 'rgb(var(--muted))' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col"
         style={{ backgroundColor: 'rgb(var(--bg))', color: 'rgb(var(--text))', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgb(var(--border))', backgroundColor: 'rgb(var(--panel))' }}>
        <div className="flex items-center gap-3">
          <Activity size={24} style={{ color: 'rgb(var(--accent))' }} />
          <h1 className="m-0 text-lg font-semibold" style={{ color: 'rgb(var(--text))' }}>
            System Monitor
          </h1>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {metrics && systemInfo && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--muted))' }}>
              <Clock size={14} />
              <span>Uptime: {formatUptime(Math.floor(Date.now() / 1000) - systemInfo.boot_time)}</span>
            </div>
          )}

          <Button
            onClick={toggleMonitoring}
            className="text-white font-medium"
            style={{ background: isMonitoring ? 'var(--danger)' : 'var(--success)' }}
          >
            {isMonitoring ? (
              <>
                <Pause size={14} />
                Stop Monitoring
              </>
            ) : (
              <>
                <Play size={14} />
                Start Monitoring
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="px-6 justify-start rounded-none" style={{ borderBottom: '1px solid rgb(var(--border))' }}>
          <TabsTrigger value="overview" className="gap-2">
            <Activity size={16} />
            Overview
          </TabsTrigger>
          <TabsTrigger value="processes" className="gap-2">
            <Server size={16} />
            Processes
          </TabsTrigger>
          <TabsTrigger value="system-info" className="gap-2">
            <Info size={16} />
            System Info
          </TabsTrigger>
          <TabsTrigger value="startup" className="gap-2">
            <Zap size={16} />
            Startup Performance
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="overview" className="m-0">
            {renderOverview()}
          </TabsContent>
          <TabsContent value="processes" className="m-0">
            {renderProcesses()}
          </TabsContent>
          <TabsContent value="system-info" className="m-0">
            {renderSystemInfo()}
          </TabsContent>
          <TabsContent value="startup" className="m-0">
            {renderStartupPerformance()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
