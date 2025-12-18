import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './SyncStatus.css';

function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // Poll sync status every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [statusData, metricsData] = await Promise.all([
          invoke('iroh_sync_status'),
          invoke('iroh_get_sync_metrics')
        ]);
        setStatus(statusData);
        setMetrics(metricsData);
      } catch (error) {
        console.error('Failed to fetch sync data:', error);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleForceSync = async () => {
    setLoading(true);
    try {
      const result = await invoke('iroh_force_sync_all');
      console.log('Force sync result:', result);
    } catch (error) {
      console.error('Force sync failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  const formatDuration = (ms) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };
  
  if (!status || !metrics) {
    return null;
  }
  
  const syncIcon = status.status === 'syncing' ? '⟳' : '✓';
  const syncClass = status.status === 'syncing' ? 'syncing' : 'synced';
  
  return (
    <div className={`sync-status ${expanded ? 'expanded' : ''}`}>
      <div 
        className="sync-status-header" 
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`sync-icon ${syncClass}`}>{syncIcon}</span>
        <span className="sync-text">
          {status.status === 'syncing' ? 'Syncing...' : 'All files synced'}
        </span>
        <span className="sync-toggle">{expanded ? '▼' : '▲'}</span>
      </div>
      
      {expanded && (
        <div className="sync-status-details">
          <div className="sync-metrics">
            <div className="metric">
              <span className="metric-label">Files:</span>
              <span className="metric-value">
                {metrics.files_scanned || 0}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Uploaded:</span>
              <span className="metric-value">
                {metrics.files_uploaded || 0} 
                <span className="metric-size">
                  ({formatBytes(metrics.bytes_uploaded)})
                </span>
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Downloaded:</span>
              <span className="metric-value">
                {metrics.files_downloaded || 0}
                <span className="metric-size">
                  ({formatBytes(metrics.bytes_downloaded)})
                </span>
              </span>
            </div>
            {metrics.errors_count > 0 && (
              <div className="metric error">
                <span className="metric-label">Errors:</span>
                <span className="metric-value">{metrics.errors_count}</span>
              </div>
            )}
          </div>
          
          <div className="sync-timing">
            <div className="timing-info">
              Last sync: {formatDuration(metrics.last_sync_duration_ms)} ago
            </div>
          </div>
          
          <div className="sync-actions">
            <button 
              className="sync-button"
              onClick={handleForceSync}
              disabled={loading}
            >
              {loading ? 'Syncing...' : 'Force Sync Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncStatus;