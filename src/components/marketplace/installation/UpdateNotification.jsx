import { useState, useEffect } from "react";
import { 
  Download, 
  X, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  RefreshCcw,
  Package,
  Star,
  ChevronRight
} from "lucide-react";

export default function UpdateNotification({
  updates = [],
  onUpdatePlugin,
  onUpdateAll,
  onDismiss,
  position = "bottom-right" // "top-right", "bottom-right", "bottom-left", "top-left"
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissedUpdates, setDismissedUpdates] = useState(new Set());
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [updatingPlugins, setUpdatingPlugins] = useState(new Set());

  // Mock updates data - in real implementation, this would come from the plugin system
  const mockUpdates = [
    {
      id: "advanced-tables",
      name: "Advanced Tables",
      currentVersion: "1.4.1",
      newVersion: "1.4.2",
      updateType: "patch", // "major", "minor", "patch", "security"
      description: "Bug fixes and performance improvements",
      criticality: "low",
      size: "1.2 MB",
      releaseDate: "2024-01-18"
    },
    {
      id: "notion-sync",
      name: "Notion Integration", 
      currentVersion: "0.9.4",
      newVersion: "0.9.5",
      updateType: "security",
      description: "Security patch for API authentication",
      criticality: "high",
      size: "850 KB",
      releaseDate: "2024-01-20"
    }
  ];

  const availableUpdates = updates.length > 0 ? updates : mockUpdates;
  const visibleUpdates = availableUpdates.filter(update => !dismissedUpdates.has(update.id));

  useEffect(() => {
    if (visibleUpdates.length > 0) {
      setIsVisible(true);
    }
  }, [visibleUpdates.length]);

  useEffect(() => {
    // Auto-expand for security updates
    if (visibleUpdates.some(update => update.updateType === "security")) {
      setIsCollapsed(false);
    }
  }, [visibleUpdates]);

  const handleUpdatePlugin = async (plugin) => {
    setUpdatingPlugins(prev => new Set([...prev, plugin.id]));
    try {
      await onUpdatePlugin?.(plugin);
      setDismissedUpdates(prev => new Set([...prev, plugin.id]));
    } catch (error) {
      console.error(`Failed to update plugin ${plugin.id}:`, error);
    } finally {
      setUpdatingPlugins(prev => {
        const newSet = new Set(prev);
        newSet.delete(plugin.id);
        return newSet;
      });
    }
  };

  const handleUpdateAll = async () => {
    const updatePromises = visibleUpdates.map(update => handleUpdatePlugin(update));
    await Promise.allSettled(updatePromises);
  };

  const handleDismissUpdate = (updateId) => {
    setDismissedUpdates(prev => new Set([...prev, updateId]));
  };

  const handleDismissAll = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const getCriticalityColor = (criticality) => {
    switch (criticality) {
      case 'high': return 'text-red-600 bg-red-500/10 border-red-500/30';
      case 'medium': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-600 bg-green-500/10 border-green-500/30';
      default: return 'text-app-muted bg-app-bg border-app-border';
    }
  };

  const getUpdateTypeIcon = (updateType) => {
    switch (updateType) {
      case 'security': return AlertTriangle;
      case 'major': return RefreshCcw;
      case 'minor': return Package;
      case 'patch': return CheckCircle;
      default: return Download;
    }
  };

  const getPositionClasses = () => {
    const base = "fixed z-50 max-w-sm w-full";
    switch (position) {
      case 'top-right': return `${base} top-4 right-4`;
      case 'bottom-left': return `${base} bottom-4 left-4`;
      case 'top-left': return `${base} top-4 left-4`;
      default: return `${base} bottom-4 right-4`;
    }
  };

  if (!isVisible || visibleUpdates.length === 0) {
    return null;
  }

  return (
    <div className={getPositionClasses()}>
      <div className="bg-app-panel border border-app-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-app-accent" />
              <div>
                <h3 className="font-medium text-app-text">
                  Plugin Updates ({visibleUpdates.length})
                </h3>
                {visibleUpdates.some(u => u.updateType === "security") && (
                  <p className="text-xs text-red-600">Security updates available</p>
                )}
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-app-muted transition-transform ${
              !isCollapsed ? 'rotate-90' : ''
            }`} />
          </button>
          
          <button
            onClick={handleDismissAll}
            className="p-1 text-app-muted hover:text-app-text transition-colors"
            title="Dismiss all updates"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="max-h-80 overflow-y-auto">
            {/* Update All Button */}
            {visibleUpdates.length > 1 && (
              <div className="p-4 border-b border-app-border">
                <button
                  onClick={handleUpdateAll}
                  className="w-full px-3 py-2 text-sm bg-app-accent text-app-accent-fg rounded-lg hover:bg-app-accent/90 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Update All ({visibleUpdates.length})
                </button>
              </div>
            )}

            {/* Updates List */}
            <div className="p-2 space-y-2">
              {visibleUpdates.map(update => {
                const UpdateIcon = getUpdateTypeIcon(update.updateType);
                const isUpdating = updatingPlugins.has(update.id);
                const criticalityColors = getCriticalityColor(update.criticality);

                return (
                  <div
                    key={update.id}
                    className="p-3 border border-app-border rounded-lg bg-app-bg/50 hover:bg-app-bg transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <UpdateIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          update.updateType === 'security' ? 'text-red-500' : 'text-app-accent'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-app-text truncate">{update.name}</h4>
                            <span className={`px-1.5 py-0.5 text-xs rounded border ${criticalityColors}`}>
                              {update.criticality}
                            </span>
                          </div>
                          <div className="text-xs text-app-muted mb-1">
                            {update.currentVersion} → {update.newVersion}
                          </div>
                          <p className="text-xs text-app-muted line-clamp-1">{update.description}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDismissUpdate(update.id)}
                        className="p-1 text-app-muted hover:text-app-text transition-colors flex-shrink-0"
                        title="Dismiss this update"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-app-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(update.releaseDate).toLocaleDateString()}
                        </span>
                        <span>Size: {update.size}</span>
                      </div>
                      
                      <button
                        onClick={() => handleUpdatePlugin(update)}
                        disabled={isUpdating}
                        className={`px-3 py-1 text-xs rounded transition-colors inline-flex items-center gap-1 ${
                          isUpdating
                            ? 'bg-app-muted/20 text-app-muted cursor-not-allowed'
                            : update.updateType === 'security'
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-app-accent text-app-accent-fg hover:bg-app-accent/90'
                        }`}
                      >
                        {isUpdating ? (
                          <>
                            <RefreshCcw className="w-3 h-3 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            Update
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed Summary */}
        {isCollapsed && (
          <div className="p-4">
            <div className="text-sm text-app-muted">
              {visibleUpdates.filter(u => u.updateType === "security").length > 0 && (
                <span className="text-red-600 font-medium">
                  {visibleUpdates.filter(u => u.updateType === "security").length} security update(s), 
                </span>
              )} {visibleUpdates.length} total updates available
            </div>
          </div>
        )}
      </div>
    </div>
  );
}