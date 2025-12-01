import { useEffect, useState } from "react";
import { usePlugins } from "../../../hooks/usePlugins.jsx";
import { 
  Settings, 
  Download, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Search,
  RefreshCcw,
  ExternalLink,
  Shield,
  User,
  Package,
  Zap
} from "lucide-react";

export default function PluginSettings({ onOpenPluginDetail }) {
  const { 
    plugins, 
    loading, 
    error, 
    enabledPlugins,
    togglePlugin, 
    installPlugin, 
    uninstallPlugin, 
    refreshPlugins 
  } = usePlugins();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [activeTab, setActiveTab] = useState("installed");

  useEffect(() => {
    refreshPlugins();
  }, [refreshPlugins]);

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plugin.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-app-muted">
          <RefreshCcw className="w-4 h-4 animate-spin" />
          Loading plugins...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading plugins</p>
          <p className="text-sm text-app-muted mb-4">{error}</p>
          <button
            onClick={refreshPlugins}
            className="px-3 py-1 text-xs bg-app-accent text-app-accent-fg rounded hover:bg-app-accent/80 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-app-panel">
      {/* Header */}
      <div className="p-4 border-b border-app-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Extensions</h2>
          <button
            onClick={refreshPlugins}
            className="p-1.5 rounded hover:bg-app-bg transition-colors"
            title="Refresh plugins"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 py-2">
          <button
            onClick={() => setActiveTab("installed")}
            className={`px-3 py-2.5 text-sm rounded transition-colors ${
              activeTab === "installed"
                ? "bg-app-accent text-app-accent-fg"
                : "text-app-muted hover:text-app-text hover:bg-app-bg"
            }`}
          >
            Installed ({plugins.length})
          </button>
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`px-3 py-2.5 text-sm rounded transition-colors ${
              activeTab === "marketplace"
                ? "bg-app-accent text-app-accent-fg"
                : "text-app-muted hover:text-app-text hover:bg-app-bg"
            }`}
          >
            Browse
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-app-accent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "installed" ? (
          <InstalledPlugins 
            plugins={filteredPlugins}
            enabledPlugins={enabledPlugins}
            onToggle={togglePlugin}
            onUninstall={uninstallPlugin}
            onSelect={setSelectedPlugin}
            selectedPlugin={selectedPlugin}
            onOpenDetail={onOpenPluginDetail}
          />
        ) : (
          <PluginMarketplace onInstall={installPlugin} />
        )}
      </div>
    </div>
  );
}

function InstalledPlugins({ plugins, enabledPlugins, onToggle, onUninstall, onSelect, selectedPlugin, onOpenDetail }) {
  if (plugins.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
        <h3 className="text-lg font-medium mb-2">No plugins installed</h3>
        <p className="text-sm text-app-muted mb-4">
          Browse the marketplace to find and install plugins
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plugins.map((plugin) => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          isEnabled={enabledPlugins.has(plugin.id)}
          onToggle={() => onToggle(plugin.id)}
          onUninstall={() => onUninstall(plugin.id)}
          onSelect={() => onSelect(plugin)}
          onOpenDetail={() => onOpenDetail(plugin)}
          isSelected={selectedPlugin?.id === plugin.id}
        />
      ))}
    </div>
  );
}

function PluginCard({ plugin, isEnabled, onToggle, onUninstall, onSelect, onOpenDetail, isSelected }) {
  const handleConfirmUninstall = async () => {
    if (window.confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      await onUninstall();
    }
  };

  return (
    <div
      className={`border rounded-lg p-3 transition-colors cursor-pointer ${
        isSelected 
          ? "border-app-accent bg-app-accent/5" 
          : "border-app-border hover:border-app-border-hover hover:bg-app-bg"
      }`}
      onClick={(e) => {
        if (e.detail === 2) {
          // Double click opens detail tab
          onOpenDetail();
        } else {
          // Single click selects
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{plugin.name}</h3>
            <span className="text-xs text-app-muted bg-app-bg px-1.5 py-0.5 rounded">
              v{plugin.version}
            </span>
            {isEnabled && <Zap className="w-3 h-3 text-green-500" />}
          </div>
          <p className="text-xs text-app-muted line-clamp-2 mb-2">{plugin.description}</p>
          
          {plugin.author && (
            <div className="flex items-center gap-1 text-xs text-app-muted">
              <User className="w-3 h-3" />
              <span>{plugin.author}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {plugin.permissions && plugin.permissions.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-app-muted">
              <Shield className="w-3 h-3" />
              <span>{plugin.permissions.length} permissions</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`p-1 rounded transition-colors ${
              isEnabled 
                ? "text-green-500 hover:bg-green-500/10" 
                : "text-app-muted hover:bg-app-bg"
            }`}
            title={isEnabled ? "Disable plugin" : "Enable plugin"}
          >
            {isEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmUninstall();
            }}
            className="p-1 rounded text-app-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Uninstall plugin"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PluginMarketplace({ onInstall }) {
  // Mock marketplace data for now
  const marketplacePlugins = [
    {
      id: "word-counter",
      name: "Word Counter",
      description: "Real-time word and character counting with reading time estimates",
      author: "Lokus Team",
      version: "1.0.0",
      downloads: 1200,
      rating: 4.8
    },
    {
      id: "code-snippets",
      name: "Code Snippets",
      description: "Customizable code snippet library with text expansion",
      author: "Community",
      version: "2.1.0",
      downloads: 850,
      rating: 4.6
    },
    {
      id: "export-tools",
      name: "Export Tools",
      description: "Export documents to PDF, HTML, and other formats",
      author: "Lokus Team",
      version: "1.5.2",
      downloads: 2100,
      rating: 4.9
    }
  ];

  return (
    <div>
      <div className="text-center py-4 mb-4">
        <Download className="w-8 h-8 text-app-muted/50 mx-auto mb-2" />
        <h3 className="font-medium mb-1">Plugin Marketplace</h3>
        <p className="text-sm text-app-muted">
          Discover and install new extensions for Lokus
        </p>
      </div>

      <div className="space-y-3">
        {marketplacePlugins.map((plugin) => (
          <MarketplaceCard
            key={plugin.id}
            plugin={plugin}
            onInstall={() => onInstall(plugin.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MarketplaceCard({ plugin, onInstall }) {
  return (
    <div className="border border-app-border rounded-lg p-3 hover:border-app-border-hover hover:bg-app-bg transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm">{plugin.name}</h3>
            <span className="text-xs text-app-muted bg-app-bg px-1.5 py-0.5 rounded">
              v{plugin.version}
            </span>
          </div>
          <p className="text-xs text-app-muted mb-2">{plugin.description}</p>
          
          <div className="flex items-center gap-3 text-xs text-app-muted">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{plugin.author}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{plugin.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>★ {plugin.rating}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={onInstall}
          className="px-3 py-1.5 text-xs bg-app-accent text-app-accent-fg rounded hover:bg-app-accent/80 transition-colors flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          Install
        </button>
      </div>
    </div>
  );
}