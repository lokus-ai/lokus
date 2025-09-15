import { useState, useEffect } from "react";
import { 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Package,
  RefreshCcw,
  Zap
} from "lucide-react";

export default function ProgressTracker({
  pluginId,
  progress,
  onDismiss,
  compact = false,
  showDetails = true
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setAnimateIn(true), 10);
  }, []);

  useEffect(() => {
    // Auto dismiss after completion
    if (progress?.status === 'completed') {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [progress?.status]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  };

  if (!progress || !isVisible) return null;

  const getStatusInfo = () => {
    switch (progress.status) {
      case 'downloading':
        return {
          icon: Download,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          message: 'Downloading...'
        };
      case 'installing':
        return {
          icon: Package,
          color: 'text-app-accent',
          bgColor: 'bg-app-accent/10',
          borderColor: 'border-app-accent/30',
          message: 'Installing...'
        };
      case 'configuring':
        return {
          icon: Zap,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          message: 'Configuring...'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          message: 'Installation complete!'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          message: progress.error || 'Installation failed'
        };
      default:
        return {
          icon: RefreshCcw,
          color: 'text-app-muted',
          bgColor: 'bg-app-muted/10',
          borderColor: 'border-app-muted/30',
          message: 'Processing...'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;
  const progressPercent = Math.min(100, Math.max(0, progress.progress || 0));

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all duration-300 ${
        animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      } ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
        <Icon className={`w-3 h-3 ${statusInfo.color} ${
          progress.status === 'downloading' || progress.status === 'installing' ? 'animate-spin' : ''
        }`} />
        <span className="text-xs font-medium">{progressPercent}%</span>
      </div>
    );
  }

  return (
    <div className={`bg-app-panel border border-app-border rounded-lg shadow-lg transition-all duration-300 ${
      animateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${statusInfo.color} ${
            progress.status === 'downloading' || progress.status === 'installing' ? 'animate-spin' : ''
          }`} />
          <span className="text-sm font-medium text-app-text">
            {statusInfo.message}
          </span>
        </div>
        
        {(progress.status === 'completed' || progress.status === 'error') && (
          <button
            onClick={handleDismiss}
            className="p-1 text-app-muted hover:text-app-text transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Progress Content */}
      <div className="px-4 pb-4">
        {showDetails && (
          <div className="text-xs text-app-muted mb-2">
            Plugin ID: {pluginId}
          </div>
        )}

        {/* Progress Bar */}
        {progress.status !== 'error' && (
          <div className="relative">
            <div className="w-full h-2 bg-app-bg rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ease-out rounded-full ${
                  progress.status === 'completed' ? 'bg-green-500' : 'bg-app-accent'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            {/* Progress percentage */}
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-app-muted">
                {progress.status === 'completed' ? 'Complete' : `${progressPercent}%`}
              </span>
              {progress.status === 'downloading' && (
                <span className="text-xs text-app-muted">
                  {progress.downloadedSize && progress.totalSize 
                    ? `${formatBytes(progress.downloadedSize)} / ${formatBytes(progress.totalSize)}`
                    : 'Downloading...'
                  }
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error Details */}
        {progress.status === 'error' && progress.error && (
          <div className="mt-2 p-2 bg-red-500/5 border border-red-500/20 rounded text-xs text-red-600">
            {progress.error}
          </div>
        )}

        {/* Success Actions */}
        {progress.status === 'completed' && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1 text-xs bg-app-accent text-app-accent-fg rounded hover:bg-app-accent/90 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Error Actions */}
        {progress.status === 'error' && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1 text-xs bg-app-bg border border-app-border text-app-text rounded hover:bg-app-panel transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Animated progress indicator */}
      {(progress.status === 'downloading' || progress.status === 'installing') && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-app-accent to-transparent opacity-50">
            <div className="w-full h-full bg-app-accent animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}