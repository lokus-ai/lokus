import { useState } from "react";
import { usePlugins } from "../../hooks/usePlugins.jsx";
import { 
  Settings, 
  ToggleLeft, 
  ToggleRight, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Package,
  Search,
  Filter,
  RefreshCcw,
  Info,
  ExternalLink,
  Zap,
  Shield
} from "lucide-react";

export default function PluginManager() {
  const { 
    plugins, 
    enabledPlugins, 
    togglePlugin, 
    uninstallPlugin, 
    loading,
    refreshPlugins 
  } = usePlugins();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // "all", "enabled", "disabled"
  const [showUninstallDialog, setShowUninstallDialog] = useState(null);

  // Filter and search plugins
  const filteredPlugins = Array.from(enabledPlugins.values())
    .filter(plugin => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!plugin.name.toLowerCase().includes(query) && 
            !plugin.description.toLowerCase().includes(query) &&
            !plugin.author.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      if (filter === "enabled") return plugin.enabled;
      if (filter === "disabled") return !plugin.enabled;
      return true;
    });

  const handleTogglePlugin = async (pluginId, enabled) => {
    try {
      await togglePlugin(pluginId, enabled);
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin:`, error);
    }
  };

  const handleUninstallPlugin = async (plugin) => {
    try {
      await uninstallPlugin(plugin.id);
      setShowUninstallDialog(null);
    } catch (error) {
      console.error(`Failed to uninstall plugin:`, error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCcw className="w-6 h-6 animate-spin text-app-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-app-text">Installed Plugins</h3>
        <button
          onClick={refreshPlugins}
          className="p-1 text-app-muted hover:text-app-text transition-colors"
          title="Refresh plugins"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Search and Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-app-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search installed plugins..."
            className="w-full pl-7 pr-3 h-8 text-xs rounded-md bg-app-bg border border-app-border outline-none focus:ring-1 focus:ring-app-accent/40"
          />
        </div>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-app-bg border border-app-border rounded outline-none focus:ring-1 focus:ring-app-accent/40"
        >
          <option value="all">All Plugins</option>
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
      </div>

      {/* Plugin List */}
      {filteredPlugins.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 mx-auto mb-4 text-app-muted/50" />
          <h3 className="text-sm font-medium mb-2">
            {enabledPlugins.size === 0 ? "No Plugins Installed" : "No Plugins Found"}
          </h3>
          <p className="text-xs text-app-muted">
            {enabledPlugins.size === 0 
              ? "Browse the marketplace to discover and install plugins"
              : "Try adjusting your search or filter"
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredPlugins.map(plugin => (
            <PluginManagerCard
              key={plugin.id}
              plugin={plugin}
              onToggle={handleTogglePlugin}
              onUninstall={() => setShowUninstallDialog(plugin)}
            />
          ))}
        </div>
      )}

      {/* Plugin Status Summary */}
      {enabledPlugins.size > 0 && (
        <div className="pt-3 border-t border-app-border">
          <div className="text-xs text-app-muted">
            {Array.from(enabledPlugins.values()).filter(p => p.enabled).length} of {enabledPlugins.size} plugins enabled
          </div>
        </div>
      )}

      {/* Uninstall Confirmation Dialog */}
      {showUninstallDialog && (
        <UninstallDialog
          plugin={showUninstallDialog}
          onConfirm={() => handleUninstallPlugin(showUninstallDialog)}
          onCancel={() => setShowUninstallDialog(null)}
        />
      )}
    </div>
  );
}

function PluginManagerCard({ plugin, onToggle, onUninstall }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="p-3 border border-app-border rounded-lg bg-app-panel/30 hover:bg-app-panel/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Plugin Icon */}
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-app-accent" />
          </div>
          
          {/* Plugin Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-app-text truncate">{plugin.name}</h4>
              {plugin.verified && (
                <Shield className="w-3 h-3 text-blue-500" title="Verified" />
              )}
              <span className="text-xs text-app-muted">v{plugin.version}</span>
            </div>
            
            <p className="text-xs text-app-muted line-clamp-1 mb-2">{plugin.description}</p>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-app-muted">by {plugin.author}</span>
              {plugin.enabled && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Active
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-app-muted hover:text-app-text transition-colors"
            title="Plugin details"
          >
            <Info className="w-3 h-3" />
          </button>
          
          <button
            onClick={() => onToggle(plugin.id, !plugin.enabled)}
            className={`p-1 transition-colors ${
              plugin.enabled 
                ? 'text-green-500 hover:bg-green-500/10' 
                : 'text-app-muted hover:bg-app-bg hover:text-app-text'
            }`}
            title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
          >
            {plugin.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          
          <button
            onClick={onUninstall}
            className="p-1 text-red-500 hover:bg-red-500/10 transition-colors"
            title="Uninstall plugin"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-app-border space-y-2">
          <div className="text-xs text-app-muted">
            <strong>Category:</strong> {plugin.category || 'General'}
          </div>
          
          {plugin.permissions && plugin.permissions.length > 0 && (
            <div className="text-xs text-app-muted">
              <strong>Permissions:</strong> {plugin.permissions.join(', ')}
            </div>
          )}
          
          {plugin.dependencies && plugin.dependencies.length > 0 && (
            <div className="text-xs text-app-muted">
              <strong>Dependencies:</strong> {plugin.dependencies.join(', ')}
            </div>
          )}
          
          <div className="text-xs text-app-muted">
            <strong>Updated:</strong> {new Date(plugin.lastUpdated).toLocaleDateString()}
          </div>

          {plugin.homepage && (
            <div className="pt-2">
              <button
                onClick={() => window.open(plugin.homepage, '_blank')}
                className="inline-flex items-center gap-1 text-xs text-app-accent hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Visit Homepage
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UninstallDialog({ plugin, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-panel border border-app-border rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <h3 className="text-lg font-semibold">Uninstall Plugin</h3>
        </div>
        
        <div className="mb-6">
          <p className="text-app-muted mb-4">
            Are you sure you want to uninstall <strong>{plugin.name}</strong>?
          </p>
          
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-600">
                <p className="font-medium mb-1">This action cannot be undone</p>
                <ul className="text-xs space-y-1">
                  <li>• Plugin files will be permanently deleted</li>
                  <li>• Plugin settings and data will be lost</li>
                  <li>• You'll need to reinstall to use this plugin again</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-app-border rounded-md hover:bg-app-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Uninstall Plugin
          </button>
        </div>
      </div>
    </div>
  );
}