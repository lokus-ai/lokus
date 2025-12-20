import { useEffect, useState, useCallback } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { RegistryAPI } from "../plugins/registry/RegistryAPI";
import { PermissionConsentDialog } from "../components/plugins/PermissionConsentDialog";
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
  Zap,
  Star,
  TrendingUp,
  Loader2,
  AlertCircle
} from "lucide-react";

const registry = new RegistryAPI();

export default function PluginSettings({ onOpenPluginDetail }) {
  const {
    plugins,
    loading,
    error,
    enabledPlugins,
    togglePlugin,
    installPlugin,
    uninstallPlugin,
    refreshPlugins,
    installingPlugins
  } = usePlugins();

  // Create a set of installed plugin IDs for quick lookup (include both id and slug)
  const installedPluginIds = new Set(plugins.flatMap(p => [p.id, p.slug, p.name].filter(Boolean)));
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [activeTab, setActiveTab] = useState("installed");

  // Permission consent dialog state
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [pendingInstall, setPendingInstall] = useState(null);

  useEffect(() => {
    refreshPlugins();
  }, [refreshPlugins]);

  /**
   * Handle plugin installation with permission consent
   * This intercepts the install flow to show permissions first
   */
  const handleInstallWithConsent = useCallback(async (pluginId, options) => {
    try {
      // Fetch plugin details to get permissions
      const pluginData = await registry.getPlugin(pluginId);

      // Check if plugin has permissions that require consent
      const permissions = pluginData?.permissions || pluginData?.manifest?.permissions || [];

      if (permissions.length > 0) {
        // Store pending install and show consent dialog
        setPendingInstall({
          pluginId,
          options,
          plugin: pluginData,
          permissions
        });
        setConsentDialogOpen(true);
      } else {
        // No permissions, install directly
        await installPlugin(pluginId, options);
      }
    } catch (error) {
      console.error('Failed to fetch plugin permissions:', error);
      // If we can't fetch permissions, proceed with install anyway
      // The user can still review in plugin details
      await installPlugin(pluginId, options);
    }
  }, [installPlugin]);

  /**
   * Handle consent approval
   */
  const handleConsentApprove = useCallback(async () => {
    if (pendingInstall) {
      setConsentDialogOpen(false);
      await installPlugin(pendingInstall.pluginId, pendingInstall.options);
      setPendingInstall(null);
    }
  }, [pendingInstall, installPlugin]);

  /**
   * Handle consent cancel
   */
  const handleConsentCancel = useCallback(() => {
    setConsentDialogOpen(false);
    setPendingInstall(null);
  }, []);

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
          <PluginMarketplace
            onInstall={handleInstallWithConsent}
            installedPluginIds={installedPluginIds}
            installingPlugins={installingPlugins || new Set()}
            onOpenDetail={onOpenPluginDetail}
            searchQuery={searchTerm}
          />
        )}
      </div>

      {/* Permission Consent Dialog */}
      <PermissionConsentDialog
        open={consentDialogOpen}
        onOpenChange={setConsentDialogOpen}
        plugin={pendingInstall?.plugin}
        permissions={pendingInstall?.permissions || []}
        onApprove={handleConsentApprove}
        onCancel={handleConsentCancel}
      />
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
      {plugins.map((plugin) => {
        const isEnabled = enabledPlugins.has(plugin.id);
        return (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          isEnabled={isEnabled}
          onToggle={() => onToggle(plugin.id, !isEnabled)}
          onUninstall={() => onUninstall(plugin.id)}
          onSelect={() => onSelect(plugin)}
          onOpenDetail={() => onOpenDetail(plugin)}
          isSelected={selectedPlugin?.id === plugin.id}
        />
        );
      })}
    </div>
  );
}

function PluginCard({ plugin, isEnabled, onToggle, onUninstall, onSelect, onOpenDetail, isSelected }) {
  const handleConfirmUninstall = async () => {
    if (window.confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      try {
        await onUninstall();
      } catch (error) {
        console.error('Failed to uninstall:', error);
        alert(`Failed to uninstall: ${error.message}`);
      }
    }
  };

  const iconUrl = plugin.icon_url || plugin.icon;

  return (
    <div
      className={`border rounded-lg p-4 transition-colors cursor-pointer ${
        isSelected
          ? "border-app-accent bg-app-accent/5"
          : "border-app-border hover:border-app-border-hover hover:bg-app-bg/50"
      }`}
      onClick={(e) => {
        if (e.detail === 2) {
          onOpenDetail();
        } else {
          onSelect();
        }
      }}
    >
      <div className="flex gap-4">
        {/* Plugin Icon */}
        <div className="flex-shrink-0">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={plugin.name}
              className="w-12 h-12 rounded-lg object-cover bg-app-bg"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center ${iconUrl ? 'hidden' : ''}`}
          >
            <Package className="w-6 h-6 text-app-accent" />
          </div>
        </div>

        {/* Plugin Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm truncate">{plugin.name}</h3>
                <span className="text-xs text-app-muted bg-app-bg px-1.5 py-0.5 rounded flex-shrink-0">
                  v{plugin.version}
                </span>
                {isEnabled && (
                  <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                    <Zap className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-app-muted line-clamp-2 mb-2">{plugin.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className={`px-2.5 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
                  isEnabled
                    ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                    : "bg-app-bg text-app-muted hover:text-app-text hover:bg-app-border"
                }`}
                title={isEnabled ? "Disable plugin" : "Enable plugin"}
              >
                {isEnabled ? (
                  <>
                    <ToggleRight className="w-3.5 h-3.5" />
                    Enabled
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-3.5 h-3.5" />
                    Disabled
                  </>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmUninstall();
                }}
                className="p-1.5 rounded text-app-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Uninstall plugin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-app-muted">
            {plugin.author && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{plugin.author}</span>
              </div>
            )}
            {plugin.permissions && plugin.permissions.length > 0 && (
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>{plugin.permissions.length} permissions</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PluginMarketplace({ onInstall, installedPluginIds, installingPlugins, onOpenDetail, searchQuery = "" }) {
  const [marketplacePlugins, setMarketplacePlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await registry.searchPlugins(searchQuery);
      // API returns { data: [...], status: 'success' }
      const plugins = response?.data || response || [];
      setMarketplacePlugins(Array.isArray(plugins) ? plugins : []);
    } catch (err) {
      console.error('Failed to fetch marketplace plugins:', err);
      setError('Failed to connect to marketplace. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(fetchPlugins, 300);
    return () => clearTimeout(debounce);
  }, [fetchPlugins]);

  const isInstalled = (plugin) => {
    // Check by id, slug, or name
    const id = typeof plugin === 'string' ? plugin : plugin?.id;
    const slug = typeof plugin === 'string' ? plugin : plugin?.slug;
    const name = typeof plugin === 'string' ? null : (plugin?.name || plugin?.display_name);

    return installedPluginIds?.has(id) ||
           installedPluginIds?.has(slug) ||
           (name && installedPluginIds?.has(name)) ||
           false;
  };

  const isInstalling = (pluginId) => {
    return installingPlugins?.has(pluginId) || false;
  };

  return (
    <div className="space-y-4">
      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchPlugins}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-app-accent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && marketplacePlugins.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
          <h3 className="font-medium mb-1">No plugins found</h3>
          <p className="text-sm text-app-muted">
            {searchQuery ? "Try a different search term" : "No plugins available in the marketplace yet"}
          </p>
        </div>
      )}

      {/* Plugin grid */}
      {!loading && !error && marketplacePlugins.length > 0 && (
        <div className="space-y-3">
          {marketplacePlugins.map((plugin) => (
            <MarketplaceCard
              key={plugin.id || plugin.slug}
              plugin={plugin}
              onInstall={() => onInstall(plugin.slug || plugin.id, {
                version: plugin.latest_version || plugin.version,
                fromMarketplace: true
              })}
              isInstalled={isInstalled(plugin)}
              isInstalling={isInstalling(plugin.id || plugin.slug)}
              onOpenDetail={() => onOpenDetail(plugin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceCard({ plugin, onInstall, isInstalled, isInstalling, onOpenDetail }) {
  // Handle different API response formats
  const name = plugin.name || plugin.display_name;
  const version = plugin.latest_version || plugin.version;
  const description = plugin.description || plugin.short_description;
  const author = plugin.publishers?.display_name || plugin.author || plugin.publisher_id;
  const downloads = plugin.downloads || 0;
  const iconUrl = plugin.icon_url || plugin.icon;

  return (
    <div
      className="border border-app-border rounded-lg p-4 hover:border-app-border-hover hover:bg-app-bg/50 transition-colors cursor-pointer"
      onClick={(e) => {
        if (e.detail === 2 && onOpenDetail) {
          onOpenDetail();
        }
      }}
    >
      <div className="flex gap-4">
        {/* Plugin Icon */}
        <div className="flex-shrink-0">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={name}
              className="w-12 h-12 rounded-lg object-cover bg-app-bg"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-lg bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center ${iconUrl ? 'hidden' : ''}`}
          >
            <Package className="w-6 h-6 text-app-accent" />
          </div>
        </div>

        {/* Plugin Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm truncate">{name}</h3>
                <span className="text-xs text-app-muted bg-app-bg px-1.5 py-0.5 rounded flex-shrink-0">
                  v{version}
                </span>
              </div>
              <p className="text-xs text-app-muted line-clamp-2 mb-2">{description}</p>
            </div>

            {/* Install Button */}
            <div className="flex-shrink-0">
              {isInstalled ? (
                <span className="px-3 py-1.5 text-xs bg-green-500/10 text-green-500 rounded flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Installed
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstall();
                  }}
                  disabled={isInstalling}
                  className="px-3 py-1.5 text-xs bg-app-accent text-app-accent-fg rounded hover:bg-app-accent/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      Install
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-app-muted">
            {author && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{author}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{downloads.toLocaleString()}</span>
            </div>
            {plugin.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span>{plugin.rating.toFixed(1)}</span>
              </div>
            )}
            {plugin.trending && (
              <div className="flex items-center gap-1 text-green-500">
                <TrendingUp className="w-3 h-3" />
                <span>Trending</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}