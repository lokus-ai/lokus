import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';

export default function SyncStatus() {
  const { isAuthenticated } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [lastSync, setLastSync] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Mock sync functionality for now
  const triggerSync = async () => {
    if (!isAuthenticated || !isOnline) return;
    
    setSyncStatus('syncing');
    
    // Simulate sync process
    setTimeout(() => {
      setSyncStatus('success');
      setLastSync(new Date());
      
      // Reset to idle after showing success
      setTimeout(() => {
        setSyncStatus('idle');
      }, 2000);
    }, 1500);
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
    
    if (!isAuthenticated) {
      return <CloudOff className="w-4 h-4 text-gray-400" />;
    }

    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Cloud className="w-4 h-4 text-app-muted" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }
    
    if (!isAuthenticated) {
      return 'Not syncing';
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Sync failed';
      default:
        return lastSync ? `Last sync: ${formatTime(lastSync)}` : 'Ready to sync';
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  const getTooltip = () => {
    if (!isOnline) {
      return 'You are offline. Changes will sync when connection is restored.';
    }
    
    if (!isAuthenticated) {
      return 'Sign in to sync your notes across devices';
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing your changes to the cloud...';
      case 'success':
        return 'All changes have been synced successfully';
      case 'error':
        return 'Failed to sync. Click to retry.';
      default:
        return 'Click to sync manually';
    }
  };

  return (
    <div 
      className="flex items-center gap-2 px-2 py-1 text-xs text-app-muted hover:text-app-text cursor-pointer transition-colors"
      onClick={triggerSync}
      title={getTooltip()}
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">
        {getStatusText()}
      </span>
    </div>
  );
}