import { useEffect, useState } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { filterPlugins, sortPlugins } from "../utils/pluginUtils.js";
import { PluginPermissions, PluginActions } from "../components/PluginManager.jsx";
import { 
  Search, 
  Filter, 
  Download, 
  Star, 
  Clock, 
  User, 
  Shield, 
  ExternalLink, 
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  Zap,
  TrendingUp,
  Heart,
  Package,
  Globe,
  ArrowLeft
} from "lucide-react";

const CATEGORIES = [
  { id: "all", name: "All Categories", icon: Package },
  { id: "editor", name: "Editor Extensions", icon: Zap },
  { id: "themes", name: "Themes", icon: Heart },
  { id: "productivity", name: "Productivity", icon: TrendingUp },
  { id: "integrations", name: "Integrations", icon: Globe },
  { id: "utilities", name: "Utilities", icon: Package }
];

const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
  { value: "name", label: "Name A-Z" }
];

export default function PluginMarketplace() {
  const { installPlugin, installingPlugins, enabledPlugins } = usePlugins();
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("trending");
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [showInstallDialog, setShowInstallDialog] = useState(null);

  // Mock marketplace data - replace with actual API calls
  useEffect(() => {
    setTimeout(() => {
      setPlugins([
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
          screenshots: ["/screenshots/advanced-tables-1.png", "/screenshots/advanced-tables-2.png"],
          homepage: "https://github.com/tablepro/lokus-advanced-tables",
          tags: ["tables", "data", "formatting", "productivity"]
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
          screenshots: ["/screenshots/dark-pro-1.png", "/screenshots/dark-pro-2.png"],
          homepage: "https://themecraft.com/dark-pro",
          tags: ["theme", "dark", "professional", "customizable"]
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
          screenshots: ["/screenshots/notion-sync-1.png"],
          homepage: "https://notionbridge.com/lokus",
          tags: ["notion", "sync", "database", "integration"]
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
          screenshots: ["/screenshots/math-enhanced-1.png", "/screenshots/math-enhanced-2.png"],
          homepage: "https://mathtools.dev/lokus",
          tags: ["math", "latex", "equations", "science"]
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
          screenshots: ["/screenshots/pomodoro-1.png"],
          homepage: "https://productivitypro.com/pomodoro-lokus",
          tags: ["pomodoro", "timer", "productivity", "focus"]
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
          screenshots: ["/screenshots/code-runner-1.png", "/screenshots/code-runner-2.png"],
          homepage: "https://codeflow.dev/lokus-runner",
          tags: ["code", "execution", "development", "languages"]
        }
      ]);
      
      setLoading(false);
    }, 1200);
  }, []);

  const filteredAndSortedPlugins = sortPlugins(
    filterPlugins(plugins, searchQuery, { 
      category: selectedCategory === "all" ? undefined : selectedCategory 
    }),
    sortBy === "popular" ? "downloads" : sortBy === "newest" ? "updated" : sortBy,
    "desc"
  );

  const handleInstallPlugin = async (plugin) => {
    try {
      await installPlugin(plugin.id, plugin);
      setShowInstallDialog(null);
    } catch (error) {
      console.error(`Failed to install plugin: ${plugin.id}`, error);
    }
  };

  const PluginCard = ({ plugin }) => {
    const isInstalled = enabledPlugins.has(plugin.id);
    const isInstalling = installingPlugins.has(plugin.id);

    return (
      <div 
        className={`border border-app-border rounded-lg p-4 bg-app-panel/50 cursor-pointer transition-all hover:bg-app-panel/70 ${
          selectedPlugin?.id === plugin.id ? 'ring-2 ring-app-accent border-app-accent' : ''
        }`}
        onClick={() => setSelectedPlugin(plugin)}
      >
        {plugin.featured && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-app-accent/20 text-app-accent text-xs rounded-md mb-2">
            <Star className="w-3 h-3 fill-current" />
            Featured
          </div>
        )}
        
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-app-text truncate">{plugin.name}</h3>
              {plugin.trending && (
                <TrendingUp className="w-4 h-4 text-green-500" title="Trending" />
              )}
            </div>
            <p className="text-sm text-app-muted line-clamp-2 mb-2">{plugin.description}</p>
            
            <div className="flex items-center gap-3 text-xs text-app-muted">
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
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {plugin.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-1 bg-app-bg text-xs text-app-muted rounded">
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-app-muted">v{plugin.version}</span>
            {isInstalled ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs rounded">
                <CheckCircle className="w-3 h-3" />
                Installed
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInstallDialog(plugin);
                }}
                disabled={isInstalling}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isInstalling
                    ? 'bg-app-muted/20 text-app-muted cursor-not-allowed'
                    : 'bg-app-accent text-app-accent-fg hover:bg-app-accent/90'
                }`}
              >
                {isInstalling ? (
                  <RefreshCcw className="w-3 h-3 animate-spin" />
                ) : (
                  "Install"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const PluginDetails = ({ plugin }) => {
    const isInstalled = enabledPlugins.has(plugin.id);
    const isInstalling = installingPlugins.has(plugin.id);

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{plugin.name}</h2>
              {plugin.featured && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-app-accent/20 text-app-accent text-xs rounded-md">
                  <Star className="w-3 h-3 fill-current" />
                  Featured
                </div>
              )}
              {plugin.trending && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-600 text-xs rounded-md">
                  <TrendingUp className="w-3 h-3" />
                  Trending
                </div>
              )}
            </div>
            
            <p className="text-app-muted mb-4">{plugin.description}</p>
            
            <div className="flex items-center gap-6 text-sm text-app-muted mb-4">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {plugin.author}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                {plugin.rating} rating
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-4 h-4" />
                {plugin.downloads.toLocaleString()} downloads
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Updated {new Date(plugin.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {plugin.homepage && (
              <button
                onClick={() => window.open(plugin.homepage, '_blank')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-app-border rounded-md hover:bg-app-bg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Homepage
              </button>
            )}
            
            {isInstalled ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-600 rounded-md">
                <CheckCircle className="w-4 h-4" />
                Installed
              </div>
            ) : (
              <PluginActions 
                plugin={plugin}
                showInstall={!isInstalled}
                showToggle={false}
                onInstall={() => setShowInstallDialog(plugin)}
              />
            )}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">About</h3>
          <p className="text-sm text-app-muted leading-relaxed">{plugin.longDescription}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {plugin.tags.map(tag => (
            <span key={tag} className="px-3 py-1 bg-app-bg text-sm text-app-muted rounded border border-app-border">
              {tag}
            </span>
          ))}
        </div>

        {plugin.permissions.length > 0 && (
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissions Required
            </h3>
            <PluginPermissions permissions={plugin.permissions} />
          </div>
        )}

        {plugin.dependencies.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Dependencies</h3>
            <div className="space-y-1">
              {plugin.dependencies.map(dep => (
                <div key={dep} className="text-sm text-app-muted px-3 py-2 bg-app-bg rounded border border-app-border">
                  {dep}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      <header className="h-12 px-4 flex items-center border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-1 text-app-muted hover:text-app-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="font-medium">Plugin Marketplace</div>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-12">
        {/* Sidebar */}
        <div className="col-span-2 border-r border-app-border bg-app-panel/50 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-3">Categories</h3>
              <div className="space-y-1">
                {CATEGORIES.map(category => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-app-accent text-app-accent-fg'
                          : 'text-app-muted hover:text-app-text hover:bg-app-bg'
                      }`}
                    >
                      <Icon className="w-4 h-4 inline mr-2" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-3">Sort By</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-app-bg border border-app-border rounded outline-none focus:ring-2 focus:ring-app-accent/40"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-span-10 flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b border-app-border">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plugins..."
                className="w-full pl-10 pr-4 h-10 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-5">
            {/* Plugin List */}
            <div className="col-span-3 border-r border-app-border overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-app-muted" />
                  <p className="text-app-muted">Loading marketplace...</p>
                </div>
              ) : filteredAndSortedPlugins.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-app-muted" />
                  <p className="text-app-muted">No plugins found</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {filteredAndSortedPlugins.map(plugin => (
                    <PluginCard key={plugin.id} plugin={plugin} />
                  ))}
                </div>
              )}
            </div>

            {/* Plugin Details */}
            <div className="col-span-2">
              {selectedPlugin ? (
                <div className="h-full p-6 overflow-y-auto">
                  <PluginDetails plugin={selectedPlugin} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Package className="w-16 h-16 mx-auto mb-4 text-app-muted/50" />
                    <h3 className="text-lg font-medium mb-2">Discover Plugins</h3>
                    <p className="text-app-muted">Select a plugin to learn more and install it</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Install Confirmation Dialog */}
      {showInstallDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-app-panel border border-app-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Install Plugin</h3>
            
            <div className="mb-4">
              <div className="font-medium">{showInstallDialog.name} v{showInstallDialog.version}</div>
              <div className="text-sm text-app-muted mt-1">by {showInstallDialog.author}</div>
            </div>

            {showInstallDialog.permissions.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  This plugin requires the following permissions:
                </h4>
                <PluginPermissions permissions={showInstallDialog.permissions} compact />
              </div>
            )}
            
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowInstallDialog(null)}
                className="px-4 py-2 text-sm border border-app-border rounded-md hover:bg-app-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleInstallPlugin(showInstallDialog)}
                className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors"
              >
                Install Plugin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}