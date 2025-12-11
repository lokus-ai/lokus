import { useState, useEffect } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { filterPlugins, sortPlugins } from "../utils/pluginUtils.js";

// Real plugin runtime using PluginLoader
// const pluginRuntime = pluginLoader;
import {
  Search,
  Filter,
  Star,
  Clock,
  User,
  Shield,
  ExternalLink,
  X,
  CheckCircle,
  AlertTriangle,
  Zap,
  TrendingUp,
  Heart,
  Package,
  Globe,
  Settings,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Plus
} from "lucide-react";

// Mock marketplace data - same as before but integrated
const MARKETPLACE_PLUGINS = [
  {
    id: "advanced-tables",
    name: "Advanced Tables",
    version: "1.4.2",
    description: "Enhanced table editing with sorting, filtering, and advanced formatting options",
    longDescription: "Transform your table editing experience with Advanced Tables. This plugin adds powerful features like column sorting, row filtering, cell formatting, and table templates. Perfect for data analysis and documentation.",
    author: "TablePro Team",
    category: "editor",
    rating: 4.9,
    downloads: 25400,
    trending: true,
    featured: true,
    lastUpdated: "2024-01-18",
    permissions: ["editor-extensions", "file-system"],
    dependencies: [],
    homepage: "https://github.com/tablepro/lokus-advanced-tables",
    tags: ["tables", "data", "formatting", "productivity"],
    isMarketplace: true
  },
  {
    id: "dark-pro-theme",
    name: "Dark Pro Theme",
    version: "2.1.0",
    description: "Professional dark theme with multiple color variants and customizable accents",
    longDescription: "A carefully crafted dark theme designed for long coding sessions. Includes 8 color variants, customizable accent colors, and optimized syntax highlighting for better readability.",
    author: "ThemeCraft",
    category: "themes",
    rating: 4.7,
    downloads: 18900,
    trending: false,
    featured: true,
    lastUpdated: "2024-01-15",
    permissions: ["themes", "settings"],
    dependencies: [],
    homepage: "https://themecraft.com/dark-pro",
    tags: ["theme", "dark", "professional", "customizable"],
    isMarketplace: true
  },
  {
    id: "notion-sync",
    name: "Notion Integration",
    version: "0.9.5",
    description: "Seamlessly sync your notes with Notion databases and pages",
    longDescription: "Connect Lokus with your Notion workspace. Sync notes, create database entries, and maintain consistency across platforms. Features real-time sync, conflict resolution, and selective synchronization.",
    author: "NotionBridge",
    category: "integrations",
    rating: 4.3,
    downloads: 12300,
    trending: true,
    featured: false,
    lastUpdated: "2024-01-20",
    permissions: ["network", "file-system", "user-data"],
    dependencies: ["notion-api"],
    homepage: "https://notionbridge.com/lokus",
    tags: ["notion", "sync", "database", "integration"],
    isMarketplace: true
  },
  {
    id: "math-enhanced",
    name: "Enhanced Math Support",
    version: "1.6.1",
    description: "Advanced mathematical notation with live preview and equation editor",
    longDescription: "Take mathematical writing to the next level with enhanced LaTeX support, live equation preview, symbol palette, and mathematical diagram integration. Includes chemistry notation support.",
    author: "MathTools Inc",
    category: "editor",
    rating: 4.8,
    downloads: 8750,
    trending: false,
    featured: false,
    lastUpdated: "2024-01-14",
    permissions: ["editor-extensions"],
    dependencies: ["katex-enhanced"],
    homepage: "https://mathtools.dev/lokus",
    tags: ["math", "latex", "equations", "science"],
    isMarketplace: true
  },
  {
    id: "pomodoro-timer",
    name: "Pomodoro Timer",
    version: "1.2.8",
    description: "Built-in Pomodoro timer with focus tracking and productivity analytics",
    longDescription: "Boost your productivity with an integrated Pomodoro timer. Features customizable intervals, break reminders, focus statistics, and integration with your writing sessions.",
    author: "ProductivityPro",
    category: "productivity",
    rating: 4.5,
    downloads: 15600,
    trending: false,
    featured: false,
    lastUpdated: "2024-01-17",
    permissions: ["notifications", "settings", "analytics"],
    dependencies: [],
    homepage: "https://productivitypro.com/pomodoro-lokus",
    tags: ["pomodoro", "timer", "productivity", "focus"],
    isMarketplace: true
  },
  {
    id: "code-runner",
    name: "Code Runner",
    version: "2.3.4",
    description: "Execute code blocks directly in your notes with syntax highlighting",
    longDescription: "Run code snippets directly in your documents. Supports 15+ programming languages, inline results, error handling, and code sharing. Perfect for technical documentation and learning.",
    author: "CodeFlow",
    category: "utilities",
    rating: 4.6,
    downloads: 22100,
    trending: true,
    featured: true,
    lastUpdated: "2024-01-19",
    permissions: ["shell-commands", "file-system", "network"],
    dependencies: ["runtime-engines"],
    homepage: "https://codeflow.dev/lokus-runner",
    tags: ["code", "execution", "development", "languages"],
    isMarketplace: true
  }
];

// PluginItem component moved outside to fix hot reload issues
const PluginItem = ({ plugin, onToggle, onUninstall, onInstall, onSelect, installingPlugins }) => {
  const isInstalling = installingPlugins.has(plugin.id);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 hover:bg-app-panel/50 cursor-pointer rounded group"
      onClick={() => onSelect(plugin)}
    >
      <div className="w-8 h-8 rounded bg-app-accent/10 flex items-center justify-center flex-shrink-0">
        <Package className="w-4 h-4 text-app-accent" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-app-text truncate">{plugin.name}</span>
          {plugin.trending && <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />}
          {plugin.featured && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
        </div>
        <p className="text-xs text-app-muted truncate">{plugin.description}</p>
        <div className="flex items-center gap-2 text-xs text-app-muted mt-1">
          <span>{plugin.author || plugin.publisher}</span>
          {plugin.isInstalled && (
            <span className={`flex items-center gap-1 ${plugin.enabled === true ? 'text-green-600' : 'text-app-muted'}`}>
              {plugin.enabled === true ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {plugin.enabled === true ? 'Enabled' : 'Disabled'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {plugin.isInstalled ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();

                // FIX: Robust handling of undefined/null enabled state
                const currentEnabled = plugin.enabled === true;
                const newEnabledState = !currentEnabled;


                // Defensive check to ensure we're passing a boolean
                if (typeof newEnabledState !== 'boolean') {
                  return;
                }

                onToggle(plugin.id, newEnabledState);
              }}
              className="p-1 text-app-muted hover:text-app-text"
              title={plugin.enabled === true ? "Disable" : "Enable"}
            >
              {plugin.enabled === true ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(plugin);
              }}
              className="p-1 text-app-muted hover:text-app-text"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUninstall(plugin);
              }}
              className="p-1 text-app-muted hover:text-app-text"
              title="Uninstall"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInstall(plugin);
            }}
            disabled={isInstalling}
            className="px-2 py-1 text-xs bg-app-accent text-white rounded hover:bg-app-accent/80 disabled:opacity-50"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
};

export default function Extensions({ onSelectExtension }) {
  const { plugins: installedPlugins, enabledPlugins, installPlugin, togglePlugin, uninstallPlugin, installingPlugins } = usePlugins();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, enabled, disabled, marketplace
  const [expandedSections, setExpandedSections] = useState({
    installed: true
  });
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [pluginRuntimeReady, setPluginRuntimeReady] = useState(false);

  // Initialize plugin runtime when component mounts
  // PluginStateAdapter handles this now
  useEffect(() => {
    setPluginRuntimeReady(true);
  }, []);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Only show installed plugins
  const allPlugins = installedPlugins.map(plugin => {
    return { ...plugin, isInstalled: true };
  });

  // Filter plugins based on search and filter
  const filteredPlugins = allPlugins.filter(plugin => {
    const matchesSearch = !searchQuery ||
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.author?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = selectedFilter === "all" ||
      (selectedFilter === "enabled" && plugin.enabled) ||
      (selectedFilter === "disabled" && plugin.isInstalled && !plugin.enabled);

    return matchesSearch && matchesFilter;
  });

  const installedFiltered = filteredPlugins;

  const handlePluginClick = (plugin) => {
    setSelectedPlugin(plugin);
    onSelectExtension?.(plugin);
  };

  const handleInstallPlugin = async (plugin) => {
    try {
      await installPlugin(plugin.id, plugin);
    } catch (error) {
    }
  };

  const handleTogglePlugin = async (pluginId, newEnabledState) => {
    try {
      // FIX: Function signature now matches the expected interface

      if (typeof newEnabledState !== 'boolean') {
        throw new Error(`Invalid toggle state for ${pluginId}: ${newEnabledState}`);
      }

      await togglePlugin(pluginId, newEnabledState);

      // PluginStateAdapter handles runtime updates now
    } catch (error) {
    }
  };

  const handleUninstallPlugin = async (plugin) => {
    try {

      // PluginStateAdapter handles runtime updates now

      await uninstallPlugin(plugin.id);

    } catch (error) {
    }
  };


  const SectionHeader = ({ title, count, sectionKey, icon: Icon }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-app-text hover:bg-app-panel/30 rounded"
    >
      {expandedSections[sectionKey] ?
        <ChevronDown className="w-4 h-4" /> :
        <ChevronRight className="w-4 h-4" />
      }
      <Icon className="w-4 h-4" />
      <span>{title}</span>
      <span className="ml-auto text-xs text-app-muted bg-app-muted/10 px-2 py-0.5 rounded-full">
        {count}
      </span>
    </button>
  );

  return (
    <div className="h-full flex">
      {/* Main Extensions List */}
      <div className={`${selectedPlugin ? 'flex-1' : 'w-full'} flex flex-col`}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-app-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-app-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search extensions..."
              className="w-full pl-7 pr-3 py-1.5 text-sm bg-app-bg border border-app-border rounded outline-none focus:ring-1 focus:ring-app-accent/40"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mt-2">
            {[
              { id: "all", label: "All" },
              { id: "enabled", label: "Enabled" },
              { id: "disabled", label: "Disabled" }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${selectedFilter === filter.id
                  ? 'bg-app-accent text-app-accent-fg'
                  : 'text-app-muted hover:text-app-text hover:bg-app-panel/50'
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Extensions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-1 p-2">
            {/* Installed Extensions */}
            {(selectedFilter === "all" || selectedFilter === "enabled" || selectedFilter === "disabled") && installedFiltered.length > 0 && (
              <div>
                <SectionHeader
                  title="Installed"
                  count={installedFiltered.length}
                  sectionKey="installed"
                  icon={CheckCircle}
                />
                {expandedSections.installed && (
                  <div className="space-y-1">
                    {installedFiltered.map(plugin => (
                      <PluginItem
                        key={plugin.id}
                        plugin={plugin}
                        onToggle={handleTogglePlugin}
                        onUninstall={handleUninstallPlugin}
                        onInstall={handleInstallPlugin}
                        onSelect={handlePluginClick}
                        installingPlugins={installingPlugins}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}


            {filteredPlugins.length === 0 && (
              <div className="text-center py-8">
                <Package className="w-8 h-8 mx-auto mb-2 text-app-muted/50" />
                <p className="text-sm text-app-muted">No extensions found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plugin Detail Panel */}
      {selectedPlugin && (
        <div className="w-80 border-l border-app-border bg-app-panel/50 flex flex-col">
          {/* Detail Header */}
          <div className="p-4 border-b border-app-border">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-app-text">{selectedPlugin.name}</h2>
                <p className="text-sm text-app-muted">v{selectedPlugin.version}</p>
              </div>
              <button
                onClick={() => setSelectedPlugin(null)}
                className="p-1 text-app-muted hover:text-app-text"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${selectedPlugin.enabled === true
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                {selectedPlugin.enabled === true ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {selectedPlugin.enabled === true ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {

                  // FIX: Robust handling of undefined/null enabled state
                  const currentEnabled = selectedPlugin.enabled === true;
                  const newEnabledState = !currentEnabled;


                  // Defensive check to ensure we're passing a boolean
                  if (typeof newEnabledState !== 'boolean') {
                    return;
                  }

                  handleTogglePlugin(selectedPlugin.id, newEnabledState);
                }}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${selectedPlugin.enabled === true
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                  }`}
              >
                {selectedPlugin.enabled === true ? 'Disable' : 'Enable'}
              </button>
              {selectedPlugin.isInstalled && (
                <button
                  onClick={() => handleUninstallPlugin(selectedPlugin)}
                  className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded text-sm font-medium transition-colors"
                >
                  Uninstall
                </button>
              )}
            </div>
          </div>

          {/* Detail Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-app-text mb-2">Description</h3>
              <p className="text-sm text-app-muted">{selectedPlugin.description}</p>
            </div>

            {/* Author */}
            {selectedPlugin.author && (
              <div>
                <h3 className="text-sm font-medium text-app-text mb-2">Author</h3>
                <p className="text-sm text-app-muted">{selectedPlugin.author}</p>
              </div>
            )}

            {/* Permissions */}
            {selectedPlugin.permissions && selectedPlugin.permissions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-app-text mb-2">Permissions</h3>
                <div className="space-y-1">
                  {selectedPlugin.permissions.map((permission, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-app-muted">
                      <Shield className="w-3 h-3" />
                      {permission}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {selectedPlugin.dependencies && Object.keys(selectedPlugin.dependencies).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-app-text mb-2">Dependencies</h3>
                <div className="space-y-1">
                  {Object.entries(selectedPlugin.dependencies).map(([dep, version]) => (
                    <div key={dep} className="text-sm text-app-muted">
                      {dep}: {version}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Install Info */}
            {selectedPlugin.isInstalled && (
              <div>
                <h3 className="text-sm font-medium text-app-text mb-2">Installation</h3>
                <div className="space-y-1 text-sm text-app-muted">
                  {selectedPlugin.lastUpdated && (
                    <div>Last Updated: {new Date(selectedPlugin.lastUpdated).toLocaleDateString()}</div>
                  )}
                  {selectedPlugin.size && (
                    <div>Size: {(selectedPlugin.size / 1024).toFixed(1)} KB</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}