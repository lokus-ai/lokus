import { 
  Star, 
  Download, 
  User, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Shield,
  AlertTriangle,
  Package,
  ExternalLink,
  Settings,
  Trash2
} from "lucide-react";
import InstallButton from "./installation/InstallButton.jsx";
import ProgressTracker from "./installation/ProgressTracker.jsx";

export default function PluginCard({
  plugin,
  viewMode = "grid", // "grid" or "list"
  isSelected = false,
  isInstalled = false,
  isInstalling = false,
  installationProgress = null,
  onSelect,
  onInstall,
  onUninstall,
  onConfigure,
  showActions = true
}) {
  const handleCardClick = () => {
    onSelect?.(plugin);
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    action();
  };

  const formatDownloads = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (viewMode === "list") {
    return (
      <div 
        className={`flex items-center gap-4 p-4 border border-app-border rounded-lg bg-app-panel/30 cursor-pointer transition-all hover:bg-app-panel/50 hover:border-app-border-hover ${
          isSelected ? 'ring-2 ring-app-accent border-app-accent bg-app-panel/60' : ''
        }`}
        onClick={handleCardClick}
      >
        {/* Plugin Icon/Avatar */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center flex-shrink-0">
          <Package className="w-6 h-6 text-app-accent" />
        </div>

        {/* Plugin Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-app-text truncate">{plugin.name}</h3>
                <span className="text-xs text-app-muted bg-app-bg px-2 py-0.5 rounded">
                  v{plugin.version}
                </span>
                {plugin.verified && (
                  <Shield className="w-4 h-4 text-blue-500" title="Verified publisher" />
                )}
                {plugin.featured && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-app-accent/20 text-app-accent text-xs rounded">
                    <Star className="w-3 h-3 fill-current" />
                    Featured
                  </div>
                )}
                {plugin.trending && (
                  <TrendingUp className="w-4 h-4 text-green-500" title="Trending" />
                )}
              </div>
              
              <p className="text-sm text-app-muted line-clamp-1 mb-2">{plugin.description}</p>
              
              <div className="flex items-center gap-4 text-xs text-app-muted">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {plugin.author}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  {plugin.rating}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {formatDownloads(plugin.downloads)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(plugin.lastUpdated)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        {showActions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {installationProgress ? (
              <ProgressTracker 
                pluginId={plugin.id}
                progress={installationProgress}
                compact
              />
            ) : isInstalled ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs rounded border border-green-500/30">
                  <CheckCircle className="w-3 h-3" />
                  Installed
                </div>
                <button
                  onClick={(e) => handleActionClick(e, () => onConfigure?.(plugin))}
                  className="p-1.5 text-app-muted hover:text-app-text hover:bg-app-bg rounded transition-colors"
                  title="Configure plugin"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleActionClick(e, () => onUninstall?.(plugin.id))}
                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  title="Uninstall plugin"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <InstallButton
                plugin={plugin}
                isInstalling={isInstalling}
                onInstall={() => onInstall?.(plugin)}
                size="small"
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div 
      className={`border border-app-border rounded-lg p-4 bg-app-panel/30 cursor-pointer transition-all hover:bg-app-panel/50 hover:border-app-border-hover ${
        isSelected ? 'ring-2 ring-app-accent border-app-accent bg-app-panel/60' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-app-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-app-text truncate">{plugin.name}</h3>
              {plugin.verified && (
                <Shield className="w-4 h-4 text-blue-500" title="Verified publisher" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-app-muted">v{plugin.version}</span>
              {plugin.price === "free" && (
                <span className="text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                  Free
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Badges */}
        <div className="flex flex-col gap-1 items-end">
          {plugin.featured && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-app-accent/20 text-app-accent text-xs rounded">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
          )}
          {plugin.trending && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-600 text-xs rounded">
              <TrendingUp className="w-3 h-3" />
              Trending
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-app-muted line-clamp-2 mb-3">{plugin.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {plugin.tags?.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-1 bg-app-bg text-xs text-app-muted rounded border border-app-border">
            {tag}
          </span>
        ))}
        {plugin.tags?.length > 3 && (
          <span className="px-2 py-1 bg-app-bg text-xs text-app-muted rounded border border-app-border">
            +{plugin.tags.length - 3}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-app-muted mb-4">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {plugin.author}
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-500" />
          {plugin.rating}
        </span>
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {formatDownloads(plugin.downloads)}
        </span>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-app-muted">
            <Clock className="w-3 h-3" />
            {formatDate(plugin.lastUpdated)}
          </div>
          
          <div className="flex items-center gap-2">
            {installationProgress ? (
              <ProgressTracker 
                pluginId={plugin.id}
                progress={installationProgress}
                compact
              />
            ) : isInstalled ? (
              <div className="flex items-center gap-1">
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs rounded border border-green-500/30">
                  <CheckCircle className="w-3 h-3" />
                  Installed
                </div>
                <button
                  onClick={(e) => handleActionClick(e, () => onConfigure?.(plugin))}
                  className="p-1 text-app-muted hover:text-app-text hover:bg-app-bg rounded transition-colors"
                  title="Configure"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <InstallButton
                plugin={plugin}
                isInstalling={isInstalling}
                onInstall={() => onInstall?.(plugin)}
                size="small"
              />
            )}
          </div>
        </div>
      )}

      {/* Security warning for high-risk permissions */}
      {plugin.permissions?.some(p => p.includes('shell') || p.includes('network') || p.includes('file-system')) && !isInstalled && (
        <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-500/10 border border-orange-500/30 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3" />
          This plugin requires elevated permissions
        </div>
      )}
    </div>
  );
}