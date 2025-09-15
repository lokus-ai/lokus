import { useState } from "react";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  X,
  FileText,
  Globe,
  Terminal,
  Bell,
  Database,
  Camera,
  Mic,
  MapPin,
  Clipboard,
  HardDrive,
  Wifi,
  Settings
} from "lucide-react";

// Permission icons mapping
const PERMISSION_ICONS = {
  "file-system": FileText,
  "network": Globe,
  "shell-commands": Terminal,
  "notifications": Bell,
  "user-data": Database,
  "camera": Camera,
  "microphone": Mic,
  "location": MapPin,
  "clipboard": Clipboard,
  "storage": HardDrive,
  "bluetooth": Wifi,
  "system-settings": Settings,
  "editor-extensions": FileText,
  "themes": Settings,
  "analytics": Database
};

// Permission risk levels and descriptions
const PERMISSION_INFO = {
  "file-system": {
    name: "File System Access",
    description: "Read and write files in your workspace",
    risk: "medium",
    details: "This plugin can read, modify, and create files in your current workspace. It cannot access files outside your workspace."
  },
  "network": {
    name: "Network Access", 
    description: "Connect to external services and APIs",
    risk: "high",
    details: "This plugin can make network requests to external servers. Be cautious as it could potentially send your data to third-party services."
  },
  "shell-commands": {
    name: "Shell Command Execution",
    description: "Execute system commands",
    risk: "high",
    details: "This plugin can run system commands on your computer. This is a powerful permission that should only be granted to trusted plugins."
  },
  "notifications": {
    name: "System Notifications",
    description: "Show desktop notifications",
    risk: "low",
    details: "This plugin can display notifications in your system's notification area."
  },
  "user-data": {
    name: "User Data Access",
    description: "Access your user profile and settings",
    risk: "medium",
    details: "This plugin can read and modify your user preferences and application settings."
  },
  "camera": {
    name: "Camera Access",
    description: "Access your device's camera",
    risk: "high",
    details: "This plugin can take photos and record videos using your device's camera."
  },
  "microphone": {
    name: "Microphone Access",
    description: "Access your device's microphone", 
    risk: "high",
    details: "This plugin can record audio using your device's microphone."
  },
  "location": {
    name: "Location Access",
    description: "Access your geographic location",
    risk: "medium",
    details: "This plugin can determine your approximate geographic location."
  },
  "clipboard": {
    name: "Clipboard Access",
    description: "Read and write to the clipboard",
    risk: "low",
    details: "This plugin can read what you've copied and place new content in your clipboard."
  },
  "storage": {
    name: "Local Storage",
    description: "Store data locally on your device",
    risk: "low",
    details: "This plugin can save data to your device for offline use and settings."
  },
  "bluetooth": {
    name: "Bluetooth Access",
    description: "Connect to Bluetooth devices",
    risk: "medium",
    details: "This plugin can discover and connect to nearby Bluetooth devices."
  },
  "system-settings": {
    name: "System Settings",
    description: "Modify system-level settings",
    risk: "high",
    details: "This plugin can change system settings and configurations."
  },
  "editor-extensions": {
    name: "Editor Extensions",
    description: "Extend the text editor functionality",
    risk: "low",
    details: "This plugin can add new features and tools to the text editor."
  },
  "themes": {
    name: "Theme Customization",
    description: "Modify the application appearance",
    risk: "low",
    details: "This plugin can change colors, fonts, and visual styling of the application."
  },
  "analytics": {
    name: "Usage Analytics",
    description: "Collect usage statistics",
    risk: "medium",
    details: "This plugin can collect anonymous usage data to improve the user experience."
  }
};

export default function PermissionDialog({
  plugin,
  onConfirm,
  onCancel,
  showDetails = true
}) {
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const [expandedPermissions, setExpandedPermissions] = useState(new Set());

  if (!plugin || !plugin.permissions || plugin.permissions.length === 0) {
    return null;
  }

  const getPermissionInfo = (permission) => {
    return PERMISSION_INFO[permission] || {
      name: permission.charAt(0).toUpperCase() + permission.slice(1).replace(/-/g, ' '),
      description: "Custom permission required by this plugin",
      risk: "medium",
      details: "This is a custom permission specific to this plugin."
    };
  };

  const getPermissionIcon = (permission) => {
    return PERMISSION_ICONS[permission] || Shield;
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-500/10 border-green-500/30';
      case 'medium': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
      case 'high': return 'text-red-600 bg-red-500/10 border-red-500/30';
      default: return 'text-app-muted bg-app-bg border-app-border';
    }
  };

  const togglePermissionDetails = (permission) => {
    setExpandedPermissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permission)) {
        newSet.delete(permission);
      } else {
        newSet.add(permission);
      }
      return newSet;
    });
  };

  const hasHighRiskPermissions = plugin.permissions.some(
    permission => getPermissionInfo(permission).risk === 'high'
  );

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-app-panel border border-app-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-app-border">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-app-accent" />
            <div>
              <h3 className="text-lg font-semibold text-app-text">Permission Request</h3>
              <p className="text-sm text-app-muted">{plugin.name} requires access to:</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-app-muted hover:text-app-text transition-colors"
            title="Cancel installation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Security Warning for high-risk permissions */}
          {hasHighRiskPermissions && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-red-600 font-medium mb-1">High-Risk Permissions Detected</p>
                <p className="text-red-600/80">
                  This plugin requests powerful permissions that could affect your system security. 
                  Only grant these permissions to plugins you trust.
                </p>
              </div>
            </div>
          )}

          {/* Permissions List */}
          <div className="space-y-3 mb-6">
            {plugin.permissions.map(permission => {
              const permInfo = getPermissionInfo(permission);
              const Icon = getPermissionIcon(permission);
              const isExpanded = expandedPermissions.has(permission);
              const riskColors = getRiskColor(permInfo.risk);

              return (
                <div 
                  key={permission}
                  className="border border-app-border rounded-lg overflow-hidden"
                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-app-bg transition-colors"
                    onClick={() => showDetails && togglePermissionDetails(permission)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="w-5 h-5 text-app-accent mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-app-text">{permInfo.name}</h4>
                            <span className={`px-2 py-0.5 text-xs rounded border ${riskColors}`}>
                              {permInfo.risk} risk
                            </span>
                          </div>
                          <p className="text-sm text-app-muted">{permInfo.description}</p>
                        </div>
                      </div>
                      
                      {showDetails && (
                        <button className="p-1 text-app-muted hover:text-app-text transition-colors">
                          <svg 
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {showDetails && isExpanded && (
                    <div className="px-4 pb-4 border-t border-app-border bg-app-bg/50">
                      <div className="pt-3 text-sm text-app-muted">
                        {permInfo.details}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Risk Acknowledgment for high-risk permissions */}
          {hasHighRiskPermissions && (
            <div className="mb-6">
              <label className="flex items-start gap-3 p-4 border border-app-border rounded-lg cursor-pointer hover:bg-app-bg transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledgedRisks}
                  onChange={(e) => setAcknowledgedRisks(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent focus:ring-2"
                />
                <div className="text-sm">
                  <p className="text-app-text font-medium mb-1">I understand the risks</p>
                  <p className="text-app-muted">
                    I acknowledge that this plugin has access to sensitive system resources and 
                    I trust the plugin developer with these permissions.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Plugin Info */}
          <div className="p-4 bg-app-bg border border-app-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-app-text">Plugin Information</span>
            </div>
            <div className="text-sm text-app-muted space-y-1">
              <p><strong>Publisher:</strong> {plugin.author}</p>
              <p><strong>Version:</strong> {plugin.version}</p>
              {plugin.verified && (
                <p className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  Verified publisher
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-app-border p-6">
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Deny Permissions
            </button>
            <button
              onClick={handleConfirm}
              disabled={hasHighRiskPermissions && !acknowledgedRisks}
              className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded-lg hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Grant Permissions & Install
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}