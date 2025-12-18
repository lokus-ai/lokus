import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Users, Settings, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import PeerList from './PeerList';

export default function IrohSyncStatus({ workspacePath, onClose }) {
  const [syncStatus, setSyncStatus] = useState(null);
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadStatus();
    loadPeers();

    // Refresh status every 10 seconds
    const interval = setInterval(() => {
      loadStatus();
      loadPeers();
    }, 10000);

    return () => clearInterval(interval);
  }, [workspacePath]);

  const loadStatus = async () => {
    try {
      const status = await invoke('iroh_sync_status', { workspacePath: workspacePath });
      setSyncStatus(status);
      setLoading(false);
    } catch (err) {
      console.error('[IrohSyncStatus] Failed to load status:', err);
      setErrorMessage('Failed to load sync status');
      setLoading(false);
    }
  };

  const loadPeers = async () => {
    try {
      const peerList = await invoke('iroh_list_peers', { workspacePath: workspacePath });
      setPeers(peerList);
    } catch (err) {
      console.error('[IrohSyncStatus] Failed to load peers:', err);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setErrorMessage('');

    try {
      const result = await invoke('iroh_manual_sync', { workspacePath: workspacePath });
      setLastSync(new Date());
      await loadStatus();
      await loadPeers();
    } catch (err) {
      console.error('[IrohSyncStatus] Manual sync failed:', err);
      setErrorMessage(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  };

  const getStatusText = () => {
    if (errorMessage) {
      return `Error: ${errorMessage}`;
    }
    if (syncing) {
      return 'Syncing...';
    }
    if (syncStatus) {
      const peerCount = syncStatus.connected_peers || 0;
      if (peerCount === 0) {
        return 'No peers connected - Waiting for connections';
      }
      if (syncStatus.is_synced) {
        return 'All changes synced';
      }
      return 'Syncing changes...';
    }
    return 'Loading...';
  };

  const getStatusIcon = () => {
    if (errorMessage) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (syncing) {
      return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (syncStatus?.connected_peers > 0 && syncStatus?.is_synced) {
      return <Check className="w-5 h-5 text-green-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-app-muted" />;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-app-panel border border-app-border rounded-lg shadow-xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-app-accent animate-spin" />
            <span className="ml-2 text-app-text">Loading sync status...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-panel border border-app-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">Iroh Sync Status</h2>
          <button
            onClick={onClose}
            className="text-app-muted hover:text-app-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status Section */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              {getStatusIcon()}
              <div>
                <div className="text-app-text font-medium">{getStatusText()}</div>
                {lastSync && (
                  <div className="text-xs text-app-muted">Last synced: {formatTime(lastSync)}</div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Sync Info */}
          <div className="mb-6 p-4 bg-app-bg rounded-lg">
            <h3 className="text-sm font-medium text-app-text mb-3">Sync Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-app-muted">Connected devices:</span>
                <span className="text-app-text font-medium">
                  {syncStatus?.connected_peers || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-muted">Status:</span>
                <span className={`font-medium ${syncStatus?.is_synced ? 'text-green-500' : 'text-yellow-500'}`}>
                  {syncStatus?.is_synced ? 'Synced' : 'Pending'}
                </span>
              </div>
              {syncStatus?.document_id && (
                <div className="flex justify-between items-center">
                  <span className="text-app-muted">Document ID:</span>
                  <span className="text-app-text font-mono text-[10px]" title={syncStatus.document_id}>
                    {syncStatus.document_id.substring(0, 12)}...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Connected Devices */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-app-text flex items-center gap-2">
                <Users className="w-4 h-4" />
                Connected Devices
              </h3>
              <span className="text-xs text-app-muted">
                {peers.length} {peers.length === 1 ? 'device' : 'devices'}
              </span>
            </div>
            <PeerList peers={peers} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-app-border">
          <button
            onClick={() => {
              // TODO: Open settings
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-app-muted hover:text-app-text transition-colors"
          >
            <Settings className="w-4 h-4" />
            View Settings
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-app-accent hover:bg-app-accent/80 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
