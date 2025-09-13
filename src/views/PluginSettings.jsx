import { useEffect, useState } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { filterPlugins, sortPlugins } from "../utils/pluginUtils.js";
import { PluginPermissions, PluginActions } from "../components/PluginManager.jsx";
import { 
  Settings, 
  Download, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  AlertTriangle, 
  CheckCircle,
  Circle,
  Search,
  Filter,
  RefreshCcw,
  ExternalLink,
  Shield,
  Clock,
  User,
  Star
} from "lucide-react";

export default function PluginSettings() {
  const { 
    plugins, 
    loading, 
    togglePlugin, 
    uninstallPlugin, 
    updatePluginSettings 
  } = usePlugins();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, enabled, disabled
  const [selectedPlugin, setSelectedPlugin] = useState(null);

  const filteredPlugins = filterPlugins(plugins, searchQuery, {
    status: filterStatus === "all" ? undefined : filterStatus
  });

  const PluginCard = ({ plugin }) => (
    <div 
      className={`border border-app-border rounded-lg p-4 bg-app-panel/50 cursor-pointer transition-colors ${
        selectedPlugin?.id === plugin.id ? 'ring-2 ring-app-accent border-app-accent' : 'hover:bg-app-panel/70'
      }`}
      onClick={() => setSelectedPlugin(plugin)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-app-text truncate">{plugin.name}</h3>
            <span className="text-xs text-app-muted bg-app-bg px-2 py-1 rounded">
              v{plugin.version}
            </span>
          </div>
          <p className="text-sm text-app-muted mb-3 line-clamp-2">{plugin.description}</p>
          
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
              {plugin.downloads.toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlugin(plugin.id);
            }}
            className={`p-1 rounded transition-colors ${
              plugin.enabled 
                ? 'text-green-500 hover:bg-green-500/10' 
                : 'text-app-muted hover:bg-app-bg'
            }`}
            title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
          >
            {plugin.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {plugin.conflicts.length > 0 && (
        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
          <div className="flex items-center gap-1 text-yellow-600">
            <AlertTriangle className="w-3 h-3" />
            Conflicts with: {plugin.conflicts.join(', ')}
          </div>
        </div>
      )}
    </div>
  );

  const PluginDetails = ({ plugin }) => (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">{plugin.name}</h2>
          <p className="text-app-muted mb-3">{plugin.description}</p>
          
          <div className="flex items-center gap-4 text-sm text-app-muted">
            <span>Version {plugin.version}</span>
            <span>by {plugin.author}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {new Date(plugin.lastUpdated).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <PluginActions 
          plugin={plugin}
          showUninstall={true}
          onUninstall={(p) => uninstallPlugin(p.id)}
        />
      </div>

      {/* Permissions */}
      <div>
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Permissions
        </h3>
        <PluginPermissions permissions={plugin.permissions} />
      </div>

      {/* Dependencies */}
      {plugin.dependencies.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Dependencies</h3>
          <div className="space-y-1">
            {plugin.dependencies.map(dep => (
              <div key={dep} className="text-sm text-app-muted px-3 py-1 bg-app-bg rounded border">
                {dep}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div>
        <h3 className="text-sm font-medium mb-3">Settings</h3>
        <div className="space-y-4">
          {Object.entries(plugin.settings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-app-muted">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </label>
              {typeof value === 'boolean' ? (
                <button
                  onClick={() => updatePluginSettings(plugin.id, { [key]: !value })}
                  className={`p-1 rounded transition-colors ${
                    value ? 'text-green-500' : 'text-app-muted'
                  }`}
                >
                  {value ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              ) : typeof value === 'string' ? (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updatePluginSettings(plugin.id, { [key]: e.target.value })}
                  className="px-2 py-1 text-sm bg-app-bg border border-app-border rounded outline-none focus:ring-2 focus:ring-app-accent/40"
                  placeholder={`Enter ${key}`}
                />
              ) : (
                <select
                  value={value}
                  onChange={(e) => updatePluginSettings(plugin.id, { [key]: e.target.value })}
                  className="px-2 py-1 text-sm bg-app-bg border border-app-border rounded outline-none focus:ring-2 focus:ring-app-accent/40"
                >
                  <option value="basic">Basic</option>
                  <option value="medium">Medium</option>
                  <option value="advanced">Advanced</option>
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      <header className="h-12 px-4 flex items-center border-b border-app-border bg-app-panel">
        <div className="font-medium">Plugin Settings</div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-5">
        {/* Plugin List */}
        <div className="col-span-2 border-r border-app-border flex flex-col">
          {/* Search and Filter */}
          <div className="p-4 border-b border-app-border bg-app-panel/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plugins..."
                className="w-full pl-8 pr-3 h-9 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-app-muted" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-app-bg border border-app-border rounded outline-none focus:ring-2 focus:ring-app-accent/40"
              >
                <option value="all">All Plugins</option>
                <option value="enabled">Enabled Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>
          </div>

          {/* Plugin List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-app-muted" />
                <p className="text-app-muted">Loading plugins...</p>
              </div>
            ) : filteredPlugins.length === 0 ? (
              <div className="p-8 text-center">
                <Settings className="w-8 h-8 mx-auto mb-2 text-app-muted" />
                <p className="text-app-muted">No plugins found</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredPlugins.map(plugin => (
                  <PluginCard key={plugin.id} plugin={plugin} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plugin Details */}
        <div className="col-span-3 flex flex-col">
          {selectedPlugin ? (
            <div className="flex-1 p-6 overflow-y-auto">
              <PluginDetails plugin={selectedPlugin} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Settings className="w-16 h-16 mx-auto mb-4 text-app-muted/50" />
                <h3 className="text-lg font-medium mb-2">Select a Plugin</h3>
                <p className="text-app-muted">Choose a plugin from the list to view its details and settings</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}