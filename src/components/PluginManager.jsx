import { useState, useEffect } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { filterPlugins, sortPlugins, formatPluginPermissions } from "../utils/pluginUtils.js";
import { 
  Search, 
  Filter, 
  Settings, 
  Download,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  Package,
  Loader
} from "lucide-react";

// Quick plugin status widget for toolbar/sidebar
export function PluginStatusWidget({ onOpenSettings }) {
  const { plugins, loading } = usePlugins();
  
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-app-muted">
        <Loader className="w-3 h-3 animate-spin" />
        Loading...
      </div>
    );
  }
  
  const enabledCount = plugins.filter(p => p.enabled).length;
  const totalCount = plugins.length;
  
  return (
    <button
      onClick={onOpenSettings}
      className="flex items-center gap-2 px-2 py-1 text-xs text-app-muted hover:text-app-text transition-colors"
      title={`${enabledCount} of ${totalCount} plugins enabled`}
    >
      <Package className="w-3 h-3" />
      <span>{enabledCount}/{totalCount}</span>
    </button>
  );
}

// Compact plugin list for sidebars
export function PluginList({ 
  searchable = true, 
  sortable = true, 
  showActions = true,
  maxHeight = "300px",
  filter = {},
  onPluginClick
}) {
  const { plugins, loading, togglePlugin } = usePlugins();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  
  const filteredPlugins = filterPlugins(plugins, searchQuery, filter);
  const sortedPlugins = sortPlugins(filteredPlugins, sortBy);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader className="w-6 h-6 animate-spin text-app-muted" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-app-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plugins..."
            className="w-full pl-7 pr-3 h-8 text-xs rounded-md bg-app-bg border border-app-border outline-none focus:ring-1 focus:ring-app-accent/40"
          />
        </div>
      )}
      
      {sortable && (
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-app-bg border border-app-border rounded outline-none focus:ring-1 focus:ring-app-accent/40"
        >
          <option value="name">Sort by Name</option>
          <option value="rating">Sort by Rating</option>
          <option value="downloads">Sort by Downloads</option>
          <option value="updated">Sort by Updated</option>
        </select>
      )}
      
      <div className="space-y-1 overflow-y-auto" style={{ maxHeight }}>
        {sortedPlugins.length === 0 ? (
          <div className="text-center py-4 text-xs text-app-muted">
            No plugins found
          </div>
        ) : (
          sortedPlugins.map(plugin => (
            <div
              key={plugin.id}
              className={`p-2 rounded-md border border-app-border bg-app-panel/30 hover:bg-app-panel/50 transition-colors ${
                onPluginClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onPluginClick?.(plugin)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{plugin.name}</span>
                    <span className="text-xs text-app-muted">v{plugin.version}</span>
                  </div>
                  <p className="text-xs text-app-muted truncate mt-1">{plugin.description}</p>
                </div>
                
                {showActions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlugin(plugin.id, !plugin.enabled);
                    }}
                    className={`p-1 rounded transition-colors ${
                      plugin.enabled 
                        ? 'text-green-500 hover:bg-green-500/10' 
                        : 'text-app-muted hover:bg-app-bg'
                    }`}
                    title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                  >
                    {plugin.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Plugin permission display component
export function PluginPermissions({ permissions = [], compact = false }) {
  const formattedPermissions = formatPluginPermissions(permissions);
  
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {formattedPermissions.map(permission => (
          <span
            key={permission.id}
            className={`px-2 py-1 text-xs rounded border ${
              permission.risk === 'high' 
                ? 'bg-red-50 border-red-200 text-red-700'
                : permission.risk === 'medium'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : 'bg-app-bg border-app-border text-app-muted'
            }`}
            title={permission.description}
          >
            {permission.label}
          </span>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {formattedPermissions.map(permission => (
        <div key={permission.id} className="flex items-center gap-3 p-2 rounded border border-app-border bg-app-bg/50">
          <div className={`w-2 h-2 rounded-full ${
            permission.risk === 'high' 
              ? 'bg-red-500'
              : permission.risk === 'medium'
              ? 'bg-yellow-500'
              : 'bg-green-500'
          }`} />
          <div>
            <div className="text-sm font-medium">{permission.label}</div>
            <div className="text-xs text-app-muted">{permission.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Plugin action buttons component
export function PluginActions({ 
  plugin, 
  showInstall = false, 
  showUninstall = false,
  showToggle = true,
  onInstall,
  onUninstall,
  size = "normal" 
}) {
  const { togglePlugin, installingPlugins } = usePlugins();
  const [showConfirm, setShowConfirm] = useState(false);
  
  const isInstalling = installingPlugins.has(plugin.id);
  const buttonSize = size === "small" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";
  
  return (
    <div className="flex items-center gap-2">
      {showInstall && (
        <button
          onClick={() => onInstall?.(plugin)}
          disabled={isInstalling}
          className={`${buttonSize} inline-flex items-center gap-2 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isInstalling ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Install
            </>
          )}
        </button>
      )}
      
      {showToggle && (
        <button
          onClick={() => togglePlugin(plugin.id, !plugin.enabled)}
          className={`${buttonSize} inline-flex items-center gap-2 border transition-colors ${
            plugin.enabled
              ? 'bg-green-500/10 border-green-500/30 text-green-600'
              : 'bg-app-bg border-app-border text-app-muted hover:bg-app-panel'
          }`}
        >
          {plugin.enabled ? <CheckCircle className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {plugin.enabled ? 'Enabled' : 'Disabled'}
        </button>
      )}
      
      {showUninstall && (
        <>
          <button
            onClick={() => setShowConfirm(true)}
            className={`${buttonSize} p-2 text-red-500 hover:bg-red-500/10 rounded-md border border-app-border transition-colors`}
            title="Uninstall plugin"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          {showConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-app-panel border border-app-border rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h3 className="text-lg font-semibold">Uninstall Plugin</h3>
                </div>
                
                <p className="text-app-muted mb-6">
                  Are you sure you want to uninstall "{plugin.name}"? This action cannot be undone.
                </p>
                
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 text-sm border border-app-border rounded-md hover:bg-app-bg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onUninstall?.(plugin);
                      setShowConfirm(false);
                    }}
                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    Uninstall
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default {
  PluginStatusWidget,
  PluginList,
  PluginPermissions,
  PluginActions
};