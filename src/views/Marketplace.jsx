import { useState, useEffect } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import SearchBar from "../components/marketplace/SearchBar.jsx";
import CategoryFilter from "../components/marketplace/CategoryFilter.jsx";
import PluginCard from "../components/marketplace/PluginCard.jsx";
import FeaturedSection from "../components/marketplace/FeaturedSection.jsx";
import SortControls from "../components/marketplace/SortControls.jsx";
import PluginDetails from "../components/marketplace/PluginDetails.jsx";
import PluginManager from "../components/marketplace/PluginManager.jsx";
import InstallButton from "../components/marketplace/installation/InstallButton.jsx";
import ProgressTracker from "../components/marketplace/installation/ProgressTracker.jsx";
import DependencyDialog from "../components/marketplace/installation/DependencyDialog.jsx";
import PermissionDialog from "../components/marketplace/installation/PermissionDialog.jsx";
import UpdateNotification from "../components/marketplace/installation/UpdateNotification.jsx";
import { filterPlugins, sortPlugins } from "../utils/pluginUtils.js";
import { 
  Package, 
  RefreshCcw, 
  Grid3X3,
  List,
  Settings,
  Download,
  TrendingUp,
  Star,
  Clock
} from "lucide-react";

export default function Marketplace() {
  const { 
    plugins, 
    enabledPlugins, 
    installPlugin, 
    uninstallPlugin,
    installingPlugins, 
    loading,
    refreshPluginRegistry 
  } = usePlugins();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [activeView, setActiveView] = useState("discover"); // 'discover', 'installed', 'updates'
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Installation state
  const [showDependencyDialog, setShowDependencyDialog] = useState(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(null);
  const [installationProgress, setInstallationProgress] = useState({});

  // Mock marketplace data - in real implementation, this would come from API
  const [marketplacePlugins, setMarketplacePlugins] = useState([]);

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const loadMarketplaceData = async () => {
    try {
      // Simulate API call to get marketplace plugins
      const mockPlugins = [
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
          tags: ["tables", "data", "formatting", "productivity"],
          price: "free",
          verified: true
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
          tags: ["theme", "dark", "professional", "customizable"],
          price: "free",
          verified: true
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
          tags: ["notion", "sync", "database", "integration"],
          price: "free",
          verified: false
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
          tags: ["math", "latex", "equations", "science"],
          price: "free",
          verified: true
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
          tags: ["pomodoro", "timer", "productivity", "focus"],
          price: "free",
          verified: true
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
          tags: ["code", "execution", "development", "languages"],
          price: "free",
          verified: true
        }
      ];
      
      setMarketplacePlugins(mockPlugins);
    } catch (error) {
      console.error("Failed to load marketplace data:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPluginRegistry();
      await loadMarketplaceData();
    } catch (error) {
      console.error("Failed to refresh marketplace:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleInstallPlugin = async (plugin) => {
    // Check dependencies first
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      setShowDependencyDialog(plugin);
      return;
    }
    
    // Check permissions
    if (plugin.permissions && plugin.permissions.length > 0) {
      setShowPermissionDialog(plugin);
      return;
    }
    
    // Proceed with installation
    await performInstallation(plugin);
  };

  const performInstallation = async (plugin) => {
    try {
      setInstallationProgress(prev => ({
        ...prev,
        [plugin.id]: { status: 'downloading', progress: 0 }
      }));
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setInstallationProgress(prev => {
          const current = prev[plugin.id];
          if (current && current.progress < 90) {
            return {
              ...prev,
              [plugin.id]: { ...current, progress: current.progress + 10 }
            };
          }
          return prev;
        });
      }, 200);

      await installPlugin(plugin.id, plugin);
      
      clearInterval(progressInterval);
      setInstallationProgress(prev => ({
        ...prev,
        [plugin.id]: { status: 'completed', progress: 100 }
      }));
      
      // Clear progress after a delay
      setTimeout(() => {
        setInstallationProgress(prev => {
          const { [plugin.id]: removed, ...rest } = prev;
          return rest;
        });
      }, 2000);
      
    } catch (error) {
      console.error(`Failed to install plugin: ${plugin.id}`, error);
      setInstallationProgress(prev => ({
        ...prev,
        [plugin.id]: { status: 'error', progress: 0, error: error.message }
      }));
    }
  };

  // Filter and sort plugins based on current view
  const getDisplayPlugins = () => {
    let pluginsToShow = [];
    
    switch (activeView) {
      case "installed":
        pluginsToShow = Array.from(enabledPlugins.values());
        break;
      case "updates":
        pluginsToShow = Array.from(enabledPlugins.values()).filter(plugin => {
          // Mock update check - in real implementation, compare versions
          return Math.random() > 0.7; // Simulate some plugins having updates
        });
        break;
      default: // "discover"
        pluginsToShow = marketplacePlugins;
    }
    
    const filtered = filterPlugins(pluginsToShow, searchQuery, {
      category: selectedCategory === "all" ? undefined : selectedCategory
    });
    
    return sortPlugins(filtered, sortBy);
  };

  const displayPlugins = getDisplayPlugins();
  const featuredPlugins = marketplacePlugins.filter(p => p.featured);

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      {/* Header */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-app-border bg-app-panel/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-app-accent" />
            <h1 className="text-lg font-semibold">Plugin Marketplace</h1>
          </div>
          
          <div className="flex items-center gap-1 bg-app-bg rounded-lg p-1">
            <button
              onClick={() => setActiveView("discover")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === "discover" 
                  ? "bg-app-accent text-app-accent-fg" 
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveView("installed")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === "installed" 
                  ? "bg-app-accent text-app-accent-fg" 
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              Installed ({enabledPlugins.size})
            </button>
            <button
              onClick={() => setActiveView("updates")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === "updates" 
                  ? "bg-app-accent text-app-accent-fg" 
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              Updates
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-app-bg rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" 
                  ? "bg-app-accent text-app-accent-fg" 
                  : "text-app-muted hover:text-app-text"
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list" 
                  ? "bg-app-accent text-app-accent-fg" 
                  : "text-app-muted hover:text-app-text"
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-app-muted hover:text-app-text transition-colors disabled:opacity-50"
            title="Refresh marketplace"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button className="p-2 text-app-muted hover:text-app-text transition-colors" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-app-border bg-app-panel/30 flex flex-col">
          <div className="p-4 space-y-4">
            <SearchBar 
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search plugins..."
            />
            
            <CategoryFilter
              selected={selectedCategory}
              onChange={setSelectedCategory}
            />
            
            <SortControls
              value={sortBy}
              onChange={setSortBy}
              view={activeView}
            />
          </div>

          {activeView === "installed" && (
            <div className="flex-1 min-h-0 px-4 pb-4">
              <PluginManager />
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-0 flex flex-col">
          {activeView === "discover" && featuredPlugins.length > 0 && !searchQuery && (
            <div className="border-b border-app-border">
              <FeaturedSection plugins={featuredPlugins} onPluginSelect={setSelectedPlugin} />
            </div>
          )}
          
          <div className="flex-1 min-h-0 grid grid-cols-5">
            {/* Plugin List */}
            <div className="col-span-3 border-r border-app-border overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-app-muted" />
                  <p className="text-app-muted">Loading plugins...</p>
                </div>
              ) : displayPlugins.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 text-app-muted/50" />
                  <h3 className="text-lg font-medium mb-2">
                    {activeView === "installed" ? "No plugins installed" : 
                     activeView === "updates" ? "All plugins up to date" : 
                     "No plugins found"}
                  </h3>
                  <p className="text-app-muted">
                    {activeView === "installed" ? "Visit the discover tab to find and install plugins" :
                     activeView === "updates" ? "Your plugins are all running the latest versions" :
                     searchQuery ? "Try adjusting your search or filters" : "Check back later for new plugins"}
                  </p>
                </div>
              ) : (
                <div className={`p-4 ${viewMode === "grid" ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "space-y-3"}`}>
                  {displayPlugins.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      viewMode={viewMode}
                      isSelected={selectedPlugin?.id === plugin.id}
                      isInstalled={enabledPlugins.has(plugin.id)}
                      isInstalling={installingPlugins.has(plugin.id)}
                      installationProgress={installationProgress[plugin.id]}
                      onSelect={setSelectedPlugin}
                      onInstall={handleInstallPlugin}
                      onUninstall={uninstallPlugin}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Plugin Details Panel */}
            <div className="col-span-2">
              {selectedPlugin ? (
                <div className="h-full p-6 overflow-y-auto">
                  <PluginDetails 
                    plugin={selectedPlugin}
                    isInstalled={enabledPlugins.has(selectedPlugin.id)}
                    isInstalling={installingPlugins.has(selectedPlugin.id)}
                    installationProgress={installationProgress[selectedPlugin.id]}
                    onInstall={handleInstallPlugin}
                    onUninstall={uninstallPlugin}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Package className="w-16 h-16 mx-auto mb-4 text-app-muted/50" />
                    <h3 className="text-lg font-medium mb-2">
                      {activeView === "discover" ? "Discover Plugins" : 
                       activeView === "installed" ? "Manage Plugins" : 
                       "Plugin Updates"}
                    </h3>
                    <p className="text-app-muted max-w-sm">
                      {activeView === "discover" ? "Select a plugin to learn more and install it" :
                       activeView === "installed" ? "Select a plugin to manage its settings" :
                       "Select a plugin to view update details"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Installation Dialogs */}
      {showDependencyDialog && (
        <DependencyDialog
          plugin={showDependencyDialog}
          onConfirm={() => {
            setShowDependencyDialog(null);
            if (showDependencyDialog.permissions?.length > 0) {
              setShowPermissionDialog(showDependencyDialog);
            } else {
              performInstallation(showDependencyDialog);
            }
          }}
          onCancel={() => setShowDependencyDialog(null)}
        />
      )}

      {showPermissionDialog && (
        <PermissionDialog
          plugin={showPermissionDialog}
          onConfirm={() => {
            setShowPermissionDialog(null);
            performInstallation(showPermissionDialog);
          }}
          onCancel={() => setShowPermissionDialog(null)}
        />
      )}

      {/* Update Notifications */}
      <UpdateNotification />

      {/* Progress Tracker */}
      {Object.keys(installationProgress).length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {Object.entries(installationProgress).map(([pluginId, progress]) => (
            <ProgressTracker
              key={pluginId}
              pluginId={pluginId}
              progress={progress}
              onDismiss={() => {
                setInstallationProgress(prev => {
                  const { [pluginId]: removed, ...rest } = prev;
                  return rest;
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}