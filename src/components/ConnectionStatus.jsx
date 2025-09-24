import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { gmailAuth, gmailQueue } from '../services/gmail.js';

export default function ConnectionStatus({ className = '' }) {
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    checking: true,
    error: null,
    queueStats: null
  });

  useEffect(() => {
    checkConnectionStatus();
    // Check status every 30 seconds
    const interval = setInterval(checkConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setGmailStatus(prev => ({ ...prev, checking: true }));
      
      // Check Gmail authentication
      const isAuthenticated = await gmailAuth.isAuthenticated();
      
      let queueStats = null;
      if (isAuthenticated) {
        try {
          queueStats = await gmailQueue.getQueueStats();
        } catch (error) {
          console.warn('Could not fetch queue stats:', error);
        }
      }
      
      setGmailStatus({
        connected: isAuthenticated,
        checking: false,
        error: null,
        queueStats
      });
    } catch (error) {
      console.error('Failed to check Gmail status:', error);
      setGmailStatus({
        connected: false,
        checking: false,
        error: error.message,
        queueStats: null
      });
    }
  };

  const getStatusIcon = () => {
    if (gmailStatus.checking) {
      return <Clock className="w-4 h-4 animate-pulse text-app-text-secondary" />;
    }
    
    if (gmailStatus.error) {
      return <AlertCircle className="w-4 h-4 text-app-danger" />;
    }
    
    if (gmailStatus.connected) {
      return <CheckCircle className="w-4 h-4 text-app-success" />;
    }
    
    return <WifiOff className="w-4 h-4 text-app-text-secondary" />;
  };

  const getStatusText = () => {
    if (gmailStatus.checking) return 'Checking...';
    if (gmailStatus.error) return 'Error';
    if (gmailStatus.connected) return 'Connected';
    return 'Disconnected';
  };

  const getStatusColor = () => {
    if (gmailStatus.checking) return 'text-app-text-secondary';
    if (gmailStatus.error) return 'text-app-danger';
    if (gmailStatus.connected) return 'text-app-success';
    return 'text-app-text-secondary';
  };

  const formatQueueStats = () => {
    if (!gmailStatus.queueStats) return null;
    
    const { pending, failed } = gmailStatus.queueStats;
    const items = [];
    
    if (pending > 0) {
      items.push(`${pending} pending`);
    }
    
    if (failed > 0) {
      items.push(`${failed} failed`);
    }
    
    return items.length > 0 ? items.join(', ') : 'Queue empty';
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        <span className={getStatusColor()}>Gmail</span>
      </div>
      
      {gmailStatus.connected && gmailStatus.queueStats && (
        <div className="text-xs text-app-text-secondary">
          ({formatQueueStats()})
        </div>
      )}
      
      {gmailStatus.error && (
        <div 
          className="text-xs text-app-danger cursor-help"
          title={gmailStatus.error}
        >
          ({gmailStatus.error.substring(0, 20)}...)
        </div>
      )}
    </div>
  );
}