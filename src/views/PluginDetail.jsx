import { useState, useEffect } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
import { RegistryAPI } from "../plugins/registry/RegistryAPI";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  Settings,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Shield,
  User,
  Download,
  Star,
  Calendar,
  Package,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText,
  Globe,
  MessageSquare,
  Loader2,
  Clock,
  Tag
} from "lucide-react";

const registry = new RegistryAPI();

export default function PluginDetail({ plugin: initialPlugin }) {
  const { plugins, enabledPlugins, togglePlugin, uninstallPlugin, installPlugin, installingPlugins } = usePlugins();
  const [activeTab, setActiveTab] = useState("overview");
  const [pluginData, setPluginData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if plugin is installed - compare against id, slug, and name
  const marketplaceId = initialPlugin.id || initialPlugin.slug;
  const marketplaceSlug = initialPlugin.slug || initialPlugin.id;
  const marketplaceName = initialPlugin.name || initialPlugin.display_name;

  const isInstalled = plugins.some(p =>
    p.id === marketplaceId ||
    p.id === marketplaceSlug ||
    p.id === marketplaceName ||
    p.name === marketplaceName ||
    p.slug === marketplaceSlug
  );
  const isEnabled = enabledPlugins.has(marketplaceId) || enabledPlugins.has(marketplaceSlug) || enabledPlugins.has(marketplaceName);
  const isInstalling = installingPlugins?.has(marketplaceId) || installingPlugins?.has(marketplaceSlug);

  // For installed plugins, find the local data which includes readme
  const installedPluginData = plugins.find(p =>
    p.id === marketplaceId ||
    p.id === marketplaceSlug ||
    p.name === marketplaceName ||
    p.manifest?.name === marketplaceName
  );

  // Fetch plugin data - prefer installed local data, fallback to API for marketplace
  useEffect(() => {
    const fetchPluginData = async () => {
      setLoading(true);
      setError(null);

      // If plugin is installed, use local data (has readme, changelog, etc.)
      if (installedPluginData) {
        setPluginData({
          ...initialPlugin,
          ...installedPluginData,
          // Merge manifest data
          name: installedPluginData.manifest?.name || installedPluginData.name || initialPlugin.name,
          description: installedPluginData.manifest?.description || installedPluginData.description || initialPlugin.description,
          version: installedPluginData.manifest?.version || installedPluginData.version || initialPlugin.version,
          author: installedPluginData.manifest?.author || installedPluginData.author || initialPlugin.author,
        });
        setLoading(false);
        return;
      }

      // Not installed - fetch from marketplace API
      try {
        const pluginId = initialPlugin.slug || initialPlugin.id;
        const response = await registry.getPlugin(pluginId);
        if (response.data) {
          setPluginData(response.data);
        } else {
          setPluginData(initialPlugin);
        }
      } catch (err) {
        console.error('Failed to fetch plugin details:', err);
        setPluginData(initialPlugin);
      } finally {
        setLoading(false);
      }
    };

    fetchPluginData();
  }, [initialPlugin.id, initialPlugin.slug, installedPluginData]);

  const plugin = pluginData || initialPlugin;
  const iconUrl = plugin.icon_url || plugin.icon;
  const name = plugin.name || plugin.display_name;
  const version = plugin.latest_version || plugin.version;
  const author = plugin.publishers?.display_name || plugin.author || plugin.publisher_id;

  const handleToggle = () => {
    togglePlugin(plugin.id || plugin.slug, !isEnabled);
  };

  const handleUninstall = async () => {
    if (window.confirm(`Are you sure you want to uninstall "${name}"?`)) {
      await uninstallPlugin(plugin.id || plugin.slug);
    }
  };

  const handleInstall = async () => {
    await installPlugin(plugin.slug || plugin.id, {
      version: plugin.latest_version || plugin.version,
      fromMarketplace: true
    });
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "readme", label: "Details", icon: FileText },
    { id: "changelog", label: "Changelog", icon: Calendar },
    { id: "ratings", label: "Ratings & Reviews", icon: Star },
    { id: "permissions", label: "Permissions", icon: Shield }
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-app-accent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="p-6 border-b border-app-border bg-app-panel">
        <div className="flex items-start justify-between mb-4">
          <div className="flex gap-4">
            {/* Plugin Icon */}
            <div className="flex-shrink-0">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={name}
                  className="w-16 h-16 rounded-xl object-cover bg-app-bg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-16 h-16 rounded-xl bg-gradient-to-br from-app-accent to-app-accent/70 flex items-center justify-center ${iconUrl ? 'hidden' : ''}`}
              >
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-app-text mb-1">{name}</h1>
              <p className="text-app-muted mb-3">{plugin.description}</p>

              <div className="flex items-center gap-4 text-sm text-app-muted flex-wrap">
                {author && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{author}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span>v{version}</span>
                </div>
                {plugin.downloads !== undefined && (
                  <div className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    <span>{(plugin.downloads || 0).toLocaleString()} downloads</span>
                  </div>
                )}
                {plugin.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{plugin.rating.toFixed(1)}</span>
                  </div>
                )}
                {plugin.updated_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Updated {new Date(plugin.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isInstalled ? (
              <>
                <button
                  onClick={handleToggle}
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors font-medium ${
                    isEnabled
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-app-accent hover:bg-app-accent/80 text-app-accent-fg"
                  }`}
                >
                  {isEnabled ? (
                    <>
                      <Zap className="w-4 h-4" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" />
                      Enable
                    </>
                  )}
                </button>

                <button
                  onClick={handleUninstall}
                  className="px-4 py-2 rounded-md border border-app-border text-app-muted hover:text-red-500 hover:border-red-500 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Uninstall
                </button>
              </>
            ) : (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="px-6 py-2 rounded-md bg-app-accent hover:bg-app-accent/80 text-app-accent-fg transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
          </div>
        </div>

        {/* Status Banner */}
        {isInstalled && isEnabled && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300">
              This extension is enabled and running.
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-app-border bg-app-panel">
        <div className="flex gap-1 px-6 py-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-app-accent text-app-accent-fg"
                    : "text-app-muted hover:text-app-text hover:bg-app-bg"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && <OverviewTab plugin={plugin} />}
        {activeTab === "readme" && <ReadmeTab plugin={plugin} />}
        {activeTab === "changelog" && <ChangelogTab plugin={plugin} />}
        {activeTab === "ratings" && <RatingsTab plugin={plugin} />}
        {activeTab === "permissions" && <PermissionsTab plugin={plugin} />}
      </div>
    </div>
  );
}

function OverviewTab({ plugin }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold mb-3">About</h3>
        <p className="text-app-muted leading-relaxed">
          {plugin.description || "No description available for this plugin."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Information</h3>
          <div className="space-y-3 bg-app-panel p-4 rounded-lg border border-app-border">
            <div className="flex justify-between">
              <span className="text-app-muted">Version</span>
              <span className="text-app-text font-medium">{plugin.latest_version || plugin.version}</span>
            </div>
            {(plugin.author || plugin.publishers?.display_name) && (
              <div className="flex justify-between">
                <span className="text-app-muted">Publisher</span>
                <span className="text-app-text">{plugin.publishers?.display_name || plugin.author}</span>
              </div>
            )}
            {plugin.license && (
              <div className="flex justify-between">
                <span className="text-app-muted">License</span>
                <span className="text-app-text">{plugin.license}</span>
              </div>
            )}
            {plugin.downloads !== undefined && (
              <div className="flex justify-between">
                <span className="text-app-muted">Downloads</span>
                <span className="text-app-text">{(plugin.downloads || 0).toLocaleString()}</span>
              </div>
            )}
            {plugin.updated_at && (
              <div className="flex justify-between">
                <span className="text-app-muted">Last Updated</span>
                <span className="text-app-text">{new Date(plugin.updated_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Links</h3>
          <div className="space-y-2 bg-app-panel p-4 rounded-lg border border-app-border">
            {plugin.repository_url && (
              <a
                href={plugin.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-app-accent hover:underline"
              >
                <Globe className="w-4 h-4" />
                Repository
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {plugin.homepage_url && (
              <a
                href={plugin.homepage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-app-accent hover:underline"
              >
                <Globe className="w-4 h-4" />
                Homepage
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {!plugin.repository_url && !plugin.homepage_url && (
              <p className="text-app-muted text-sm">No links available</p>
            )}
          </div>
        </div>
      </div>

      {plugin.tags && plugin.tags.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {plugin.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-app-panel border border-app-border rounded-full text-sm text-app-muted flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadmeTab({ plugin }) {
  const readme = plugin.readme || plugin.readme_content;

  if (!readme) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
        <h3 className="font-medium mb-1">No Documentation</h3>
        <p className="text-sm text-app-muted">This plugin doesn't have documentation available.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl prose prose-sm dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0 text-app-text">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3 border-b border-app-border pb-2 text-app-text">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-app-text">{children}</h3>,
          p: ({ children }) => <p className="my-3 leading-relaxed text-app-muted">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside my-3 space-y-1 text-app-muted">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-3 space-y-1 text-app-muted">{children}</ol>,
          li: ({ children }) => <li className="ml-2">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-app-accent hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return <code className="bg-app-bg px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
            }
            return <code className={`${className} block bg-app-bg p-4 rounded-lg overflow-x-auto text-sm`}>{children}</code>;
          },
          pre: ({ children }) => <pre className="bg-app-bg rounded-lg my-4 overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-app-accent pl-4 my-4 italic text-app-muted">{children}</blockquote>
          ),
          img: ({ src, alt }) => {
            if (!src || (!src.startsWith('http://') && !src.startsWith('https://'))) {
              return null;
            }
            return <img src={src} alt={alt || ''} className="max-w-full h-auto rounded my-4" />;
          },
        }}
      >
        {readme}
      </ReactMarkdown>
    </div>
  );
}

function ChangelogTab({ plugin }) {
  const changelog = plugin.changelog || plugin.changelog_content;
  const versions = plugin.versions || [];

  if (!changelog && versions.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
        <h3 className="font-medium mb-1">No Changelog</h3>
        <p className="text-sm text-app-muted">Version history is not available for this plugin.</p>
      </div>
    );
  }

  // If we have structured versions data, show that
  if (versions.length > 0) {
    return (
      <div className="max-w-4xl space-y-4">
        <h3 className="text-lg font-semibold mb-4">Version History</h3>
        {versions.map((v) => (
          <div key={v.version} className="border-l-2 border-app-accent pl-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-app-text">v{v.version}</span>
              {v.created_at && (
                <span className="text-sm text-app-muted">
                  {new Date(v.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {v.changelog && (
              <div className="prose prose-sm dark:prose-invert text-app-muted">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {v.changelog}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // If we have markdown changelog, render it
  return (
    <div className="max-w-4xl prose prose-sm dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {changelog}
      </ReactMarkdown>
    </div>
  );
}

function RatingsTab({ plugin }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const pluginId = plugin.slug || plugin.id;
        const response = await fetch(`https://lokusmd.com/api/v1/registry/plugin/${pluginId}/ratings`);
        if (response.ok) {
          const data = await response.json();
          setRatings(data.ratings || []);
        }
      } catch (err) {
        console.error('Failed to fetch ratings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [plugin.id, plugin.slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-app-accent" />
      </div>
    );
  }

  if (ratings.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
        <h3 className="font-medium mb-1">No Reviews Yet</h3>
        <p className="text-sm text-app-muted">Be the first to review this plugin on the website.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="text-4xl font-bold text-app-text">
          {plugin.rating?.toFixed(1) || "N/A"}
        </div>
        <div>
          <div className="flex items-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(plugin.rating || 0)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-app-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-app-muted">{ratings.length} reviews</p>
        </div>
      </div>

      <div className="space-y-4">
        {ratings.map((review) => (
          <div key={review.id} className="p-4 bg-app-panel border border-app-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= review.rating
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-app-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-app-muted">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
            {review.review && (
              <p className="text-app-muted text-sm">{review.review}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Permission metadata with descriptions and risk levels
 */
const PERMISSION_INFO = {
  // Filesystem
  'filesystem:read': {
    name: 'Read Files',
    description: 'Access files and folders in your workspace',
    riskLevel: 'medium',
    category: 'filesystem'
  },
  'filesystem:write': {
    name: 'Write Files',
    description: 'Create, modify, and delete files in your workspace',
    riskLevel: 'high',
    category: 'filesystem'
  },
  // Editor
  'editor:read': {
    name: 'Read Editor Content',
    description: 'Access document content and selection',
    riskLevel: 'medium',
    category: 'editor'
  },
  'editor:write': {
    name: 'Modify Editor',
    description: 'Insert, modify, or delete document content',
    riskLevel: 'medium',
    category: 'editor'
  },
  // UI
  'ui:notifications': {
    name: 'Show Notifications',
    description: 'Display toast notifications',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:dialogs': {
    name: 'Show Dialogs',
    description: 'Display dialog boxes and prompts',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:create': {
    name: 'Create UI Elements',
    description: 'Create panels, status bar items, and other UI components',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:menus': {
    name: 'Register Menus',
    description: 'Add items to context menus',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:toolbars': {
    name: 'Register Toolbars',
    description: 'Add items to toolbars',
    riskLevel: 'low',
    category: 'ui'
  },
  // Workspace
  'workspace:read': {
    name: 'Read Workspace',
    description: 'Access workspace path and configuration',
    riskLevel: 'low',
    category: 'workspace'
  },
  'workspace:write': {
    name: 'Modify Workspace',
    description: 'Modify workspace files and settings',
    riskLevel: 'high',
    category: 'workspace'
  },
  // Storage
  'storage:read': {
    name: 'Read Storage',
    description: 'Read plugin-specific stored data',
    riskLevel: 'low',
    category: 'storage'
  },
  'storage:write': {
    name: 'Write Storage',
    description: 'Store plugin-specific data',
    riskLevel: 'low',
    category: 'storage'
  },
  // Commands
  'commands:register': {
    name: 'Register Commands',
    description: 'Register new commands in the command palette',
    riskLevel: 'low',
    category: 'commands'
  },
  'commands:execute': {
    name: 'Execute Commands',
    description: 'Execute registered commands',
    riskLevel: 'medium',
    category: 'commands'
  },
  'commands:list': {
    name: 'List Commands',
    description: 'View all registered commands',
    riskLevel: 'low',
    category: 'commands'
  },
  // Network (HIGH RISK)
  'network:http': {
    name: 'Network Access',
    description: 'Make HTTP/HTTPS requests to external servers',
    riskLevel: 'high',
    category: 'network'
  },
  'network': {
    name: 'Network Access',
    description: 'Make HTTP/HTTPS requests to external servers',
    riskLevel: 'high',
    category: 'network'
  },
  // Clipboard (HIGH RISK for read)
  'clipboard:read': {
    name: 'Read Clipboard',
    description: 'Access clipboard contents (may contain sensitive data)',
    riskLevel: 'high',
    category: 'clipboard'
  },
  'clipboard:write': {
    name: 'Write Clipboard',
    description: 'Modify clipboard contents',
    riskLevel: 'medium',
    category: 'clipboard'
  },
  // Terminal (HIGH RISK)
  'terminal:create': {
    name: 'Create Terminal',
    description: 'Create and manage terminal instances',
    riskLevel: 'high',
    category: 'terminal'
  },
  'terminal:write': {
    name: 'Write to Terminal',
    description: 'Send commands to terminal',
    riskLevel: 'high',
    category: 'terminal'
  },
  // Events
  'events:listen': {
    name: 'Listen to Events',
    description: 'Subscribe to system events',
    riskLevel: 'low',
    category: 'events'
  },
  'events:emit': {
    name: 'Emit Events',
    description: 'Emit custom events',
    riskLevel: 'medium',
    category: 'events'
  }
};

function getRiskBadge(riskLevel) {
  switch (riskLevel) {
    case 'high':
      return {
        className: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: AlertTriangle
      };
    case 'medium':
      return {
        className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        icon: AlertTriangle
      };
    default: // low
      return {
        className: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: CheckCircle
      };
  }
}

function PermissionsTab({ plugin }) {
  const permissions = plugin.permissions || [];

  // Check for high-risk permissions
  const hasHighRisk = permissions.some(p => {
    const info = PERMISSION_INFO[p];
    return info?.riskLevel === 'high';
  });

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const info = PERMISSION_INFO[perm] || {
      name: perm,
      description: 'Custom permission',
      riskLevel: 'medium',
      category: 'other'
    };
    const category = info.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ permission: perm, ...info });
    return acc;
  }, {});

  // Sort to show high-risk categories first
  const sortedCategories = Object.entries(groupedPermissions).sort(([, a], [, b]) => {
    const aHasHigh = a.some(p => p.riskLevel === 'high');
    const bHasHigh = b.some(p => p.riskLevel === 'high');
    if (aHasHigh && !bHasHigh) return -1;
    if (!aHasHigh && bHasHigh) return 1;
    return 0;
  });

  return (
    <div className="max-w-4xl">
      <h3 className="text-lg font-semibold mb-4">Permissions</h3>

      {permissions.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
          <p className="text-app-muted">This plugin doesn't require any special permissions.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* High-risk warning */}
          {hasHighRisk && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-400">High-Risk Permissions</p>
                <p className="text-sm text-app-muted mt-1">
                  This plugin requests permissions that could access sensitive data or modify your files.
                  Only install plugins from trusted sources.
                </p>
              </div>
            </div>
          )}

          {/* Permissions grouped by category */}
          {sortedCategories.map(([category, perms]) => (
            <div key={category}>
              <h4 className="text-xs font-medium text-app-muted uppercase mb-3 px-1">
                {category}
              </h4>
              <div className="space-y-2">
                {perms.map(({ permission, name, description, riskLevel }) => {
                  const badge = getRiskBadge(riskLevel);
                  const BadgeIcon = badge.icon;
                  return (
                    <div
                      key={permission}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-app-border bg-app-panel ${
                        riskLevel === 'high' ? 'border-red-500/20 bg-red-500/5' : ''
                      }`}
                    >
                      <Shield className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        riskLevel === 'high' ? 'text-red-400' :
                        riskLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-app-text">{name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${badge.className}`}>
                            {riskLevel}
                          </span>
                        </div>
                        <p className="text-xs text-app-muted">{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
