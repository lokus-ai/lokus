import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertTriangle } from 'lucide-react';
import { syncEngine } from '../core/sync/SyncEngine';
import { useAuth } from '../core/auth/AuthContext';

export default function SyncIndicator() {
  const [status, setStatus] = useState('idle');
  const [errorDetail, setErrorDetail] = useState(null);
  const { isAuthenticated, isGuest } = useAuth();

  useEffect(() => {
    const unsub = syncEngine.onStatusChange((s, detail) => {
      setStatus(s);
      if (s === 'error') setErrorDetail(detail || null);
      if (s !== 'error') setErrorDetail(null);
      if (s === 'synced') setTimeout(() => setStatus('idle'), 3000);
    });
    return unsub;
  }, []);

  if (!isAuthenticated || isGuest) return null;

  const config = {
    idle: { icon: Cloud, className: 'text-app-muted', label: 'Synced' },
    syncing: { icon: Loader2, className: 'text-blue-500 animate-spin', label: 'Syncing...' },
    synced: { icon: Check, className: 'text-green-500', label: 'Synced' },
    error: { icon: AlertTriangle, className: 'text-amber-500', label: 'Sync error' },
  }[status] || { icon: CloudOff, className: 'text-app-muted', label: 'Offline' };

  const Icon = config.icon;

  const title = status === 'error' && errorDetail
    ? `Sync error: ${errorDetail}`
    : config.label;

  return (
    <div className="obsidian-status-bar-item" title={title}>
      <Icon className={`w-3.5 h-3.5 ${config.className}`} />
    </div>
  );
}
