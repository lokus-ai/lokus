import { useState } from "react";
import { usePlugins } from "../hooks/usePlugins.jsx";
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
  Globe
} from "lucide-react";

export default function PluginDetail({ plugin }) {
  const { enabledPlugins, togglePlugin, uninstallPlugin } = usePlugins();
  const [activeTab, setActiveTab] = useState("overview");
  
  const isEnabled = enabledPlugins.has(plugin.id);

  const handleToggle = () => {
    const newEnabledState = !isEnabled;
    togglePlugin(plugin.id, newEnabledState);
  };

  const handleUninstall = async () => {
    if (window.confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      await uninstallPlugin(plugin.id);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "readme", label: "Details", icon: FileText },
    { id: "changelog", label: "Changelog", icon: Calendar },
    { id: "permissions", label: "Permissions", icon: Shield }
  ];

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="p-6 border-b border-app-border bg-app-panel">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-app-accent to-app-accent/70 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-app-text">{plugin.name}</h1>
                <p className="text-app-muted">{plugin.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-app-muted">
              {plugin.author && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{plugin.author}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                <span>v{plugin.version}</span>
              </div>
              {plugin.downloads && (
                <div className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  <span>{plugin.downloads.toLocaleString()} downloads</span>
                </div>
              )}
              {plugin.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>{plugin.rating}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Status Banner */}
        {isEnabled && (
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
        <div className="flex gap-1 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${
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
        {activeTab === "permissions" && <PermissionsTab plugin={plugin} />}
      </div>
    </div>
  );
}

function OverviewTab({ plugin }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">About</h3>
        <p className="text-app-muted leading-relaxed">
          {plugin.description || "No description available for this plugin."}
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-app-muted">Version</label>
              <p className="text-app-text">{plugin.version}</p>
            </div>
            {plugin.author && (
              <div>
                <label className="text-sm font-medium text-app-muted">Author</label>
                <p className="text-app-text">{plugin.author}</p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {plugin.repository && (
              <div>
                <label className="text-sm font-medium text-app-muted">Repository</label>
                <a
                  href={plugin.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-app-accent hover:underline flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  View Source
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {plugin.homepage && (
              <div>
                <label className="text-sm font-medium text-app-muted">Homepage</label>
                <a
                  href={plugin.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-app-accent hover:underline flex items-center gap-1"
                >
                  Visit Website
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {plugin.keywords && plugin.keywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {plugin.keywords.map((keyword) => (
              <span
                key={keyword}
                className="px-2 py-1 bg-app-panel border border-app-border rounded text-xs text-app-muted"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadmeTab({ plugin }) {
  return (
    <div className="prose prose-sm max-w-none">
      <h3 className="text-lg font-semibold mb-4">Documentation</h3>
      <div className="p-4 bg-app-panel border border-app-border rounded-md">
        <p className="text-app-muted mb-4">
          This plugin provides the following features:
        </p>
        <ul className="space-y-2 text-app-muted">
          <li>• Enhanced editing capabilities</li>
          <li>• Customizable settings and preferences</li>
          <li>• Integration with Lokus editor</li>
          <li>• Performance optimized for large documents</li>
        </ul>
        <p className="text-app-muted mt-4">
          For more detailed documentation, please visit the plugin's repository or homepage.
        </p>
      </div>
    </div>
  );
}

function ChangelogTab({ plugin }) {
  const changes = [
    {
      version: plugin.version,
      date: "2024-01-15",
      changes: ["Initial release", "Core functionality implemented", "Basic settings added"]
    }
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Changelog</h3>
      <div className="space-y-4">
        {changes.map((release) => (
          <div key={release.version} className="border-l-2 border-app-accent pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-app-text">v{release.version}</span>
              <span className="text-sm text-app-muted">{release.date}</span>
            </div>
            <ul className="space-y-1">
              {release.changes.map((change, index) => (
                <li key={index} className="text-sm text-app-muted">
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionsTab({ plugin }) {
  const permissions = plugin.permissions || [];
  
  const getPermissionInfo = (permission) => {
    const permissionMap = {
      "read_files": { icon: FileText, name: "Read Files", description: "Access to read files in your workspace" },
      "write_files": { icon: FileText, name: "Write Files", description: "Ability to create and modify files" },
      "network": { icon: Globe, name: "Network Access", description: "Make network requests to external services" },
      "clipboard": { icon: Package, name: "Clipboard Access", description: "Read from and write to clipboard" },
      "ui_modify": { icon: Settings, name: "UI Modification", description: "Add buttons, panels, and modify interface" }
    };
    return permissionMap[permission] || { icon: Shield, name: permission, description: "Custom permission" };
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Permissions</h3>
      {permissions.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-app-muted/50 mx-auto mb-3" />
          <p className="text-app-muted">This plugin doesn't require any special permissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              This plugin requires the following permissions to function properly.
            </span>
          </div>
          
          {permissions.map((permission) => {
            const info = getPermissionInfo(permission);
            const Icon = info.icon;
            return (
              <div key={permission} className="flex items-start gap-3 p-3 border border-app-border rounded-md">
                <Icon className="w-5 h-5 text-app-muted mt-0.5" />
                <div>
                  <h4 className="font-medium text-app-text">{info.name}</h4>
                  <p className="text-sm text-app-muted">{info.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}