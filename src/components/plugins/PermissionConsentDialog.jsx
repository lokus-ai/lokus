import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Shield, AlertTriangle, CheckCircle, Info, Lock, Folder, Globe, Clipboard, Terminal, Eye, Edit3, Zap, Database } from 'lucide-react';

/**
 * Permission metadata with descriptions and risk levels
 */
const PERMISSION_INFO = {
  // Filesystem
  'filesystem:read': {
    name: 'Read Files',
    description: 'Access files and folders in your workspace',
    riskLevel: 'medium',
    icon: Folder,
    category: 'filesystem'
  },
  'filesystem:write': {
    name: 'Write Files',
    description: 'Create, modify, and delete files in your workspace',
    riskLevel: 'high',
    icon: Edit3,
    category: 'filesystem'
  },
  // Editor
  'editor:read': {
    name: 'Read Editor Content',
    description: 'Access document content and selection',
    riskLevel: 'medium',
    icon: Eye,
    category: 'editor'
  },
  'editor:write': {
    name: 'Modify Editor',
    description: 'Insert, modify, or delete document content',
    riskLevel: 'medium',
    icon: Edit3,
    category: 'editor'
  },
  // UI
  'ui:notifications': {
    name: 'Show Notifications',
    description: 'Display toast notifications',
    riskLevel: 'low',
    icon: Info,
    category: 'ui'
  },
  'ui:dialogs': {
    name: 'Show Dialogs',
    description: 'Display dialog boxes and prompts',
    riskLevel: 'low',
    icon: Info,
    category: 'ui'
  },
  'ui:create': {
    name: 'Create UI Elements',
    description: 'Create panels, status bar items, and other UI components',
    riskLevel: 'low',
    icon: Zap,
    category: 'ui'
  },
  'ui:menus': {
    name: 'Register Menus',
    description: 'Add items to context menus',
    riskLevel: 'low',
    icon: Zap,
    category: 'ui'
  },
  'ui:toolbars': {
    name: 'Register Toolbars',
    description: 'Add items to toolbars',
    riskLevel: 'low',
    icon: Zap,
    category: 'ui'
  },
  // Workspace
  'workspace:read': {
    name: 'Read Workspace',
    description: 'Access workspace path and configuration',
    riskLevel: 'low',
    icon: Folder,
    category: 'workspace'
  },
  'workspace:write': {
    name: 'Modify Workspace',
    description: 'Modify workspace files and settings',
    riskLevel: 'high',
    icon: Edit3,
    category: 'workspace'
  },
  // Storage
  'storage:read': {
    name: 'Read Storage',
    description: 'Read plugin-specific stored data',
    riskLevel: 'low',
    icon: Database,
    category: 'storage'
  },
  'storage:write': {
    name: 'Write Storage',
    description: 'Store plugin-specific data',
    riskLevel: 'low',
    icon: Database,
    category: 'storage'
  },
  // Commands
  'commands:register': {
    name: 'Register Commands',
    description: 'Register new commands in the command palette',
    riskLevel: 'low',
    icon: Zap,
    category: 'commands'
  },
  'commands:execute': {
    name: 'Execute Commands',
    description: 'Execute registered commands',
    riskLevel: 'medium',
    icon: Zap,
    category: 'commands'
  },
  'commands:list': {
    name: 'List Commands',
    description: 'View all registered commands',
    riskLevel: 'low',
    icon: Eye,
    category: 'commands'
  },
  // Network (HIGH RISK)
  'network:http': {
    name: 'Network Access',
    description: 'Make HTTP/HTTPS requests to external servers',
    riskLevel: 'high',
    icon: Globe,
    category: 'network'
  },
  'network': {
    name: 'Network Access',
    description: 'Make HTTP/HTTPS requests to external servers',
    riskLevel: 'high',
    icon: Globe,
    category: 'network'
  },
  // Clipboard (HIGH RISK for read)
  'clipboard:read': {
    name: 'Read Clipboard',
    description: 'Access clipboard contents (may contain sensitive data)',
    riskLevel: 'high',
    icon: Clipboard,
    category: 'clipboard'
  },
  'clipboard:write': {
    name: 'Write Clipboard',
    description: 'Modify clipboard contents',
    riskLevel: 'medium',
    icon: Clipboard,
    category: 'clipboard'
  },
  // Terminal (HIGH RISK)
  'terminal:create': {
    name: 'Create Terminal',
    description: 'Create and manage terminal instances',
    riskLevel: 'high',
    icon: Terminal,
    category: 'terminal'
  },
  'terminal:write': {
    name: 'Write to Terminal',
    description: 'Send commands to terminal',
    riskLevel: 'high',
    icon: Terminal,
    category: 'terminal'
  },
  // Events
  'events:listen': {
    name: 'Listen to Events',
    description: 'Subscribe to system events',
    riskLevel: 'low',
    icon: Eye,
    category: 'events'
  },
  'events:emit': {
    name: 'Emit Events',
    description: 'Emit custom events',
    riskLevel: 'medium',
    icon: Zap,
    category: 'events'
  }
};

/**
 * Get color classes for risk level
 */
function getRiskLevelStyles(riskLevel) {
  switch (riskLevel) {
    case 'high':
      return {
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: 'text-red-400',
        row: 'border-red-500/20 bg-red-500/5'
      };
    case 'medium':
      return {
        badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        icon: 'text-yellow-400',
        row: ''
      };
    default: // low
      return {
        badge: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: 'text-green-400',
        row: ''
      };
  }
}

/**
 * Permission Consent Dialog Component
 * Shows plugin permissions and requires user approval before installation
 */
export function PermissionConsentDialog({
  open,
  onOpenChange,
  plugin,
  permissions = [],
  onApprove,
  onCancel
}) {
  const [understood, setUnderstood] = useState(false);

  // Check if there are high-risk permissions
  const hasHighRiskPermissions = permissions.some(p => {
    const info = PERMISSION_INFO[p];
    return info?.riskLevel === 'high';
  });

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const info = PERMISSION_INFO[perm] || {
      name: perm,
      description: 'Unknown permission',
      riskLevel: 'medium',
      icon: Shield,
      category: 'other'
    };
    const category = info.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ permission: perm, ...info });
    return acc;
  }, {});

  // Sort high-risk permissions first
  const sortedCategories = Object.entries(groupedPermissions).sort(([, a], [, b]) => {
    const aHasHigh = a.some(p => p.riskLevel === 'high');
    const bHasHigh = b.some(p => p.riskLevel === 'high');
    if (aHasHigh && !bHasHigh) return -1;
    if (!aHasHigh && bHasHigh) return 1;
    return 0;
  });

  const handleApprove = () => {
    if (understood || !hasHighRiskPermissions) {
      onApprove();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-app-accent" />
            Permission Request
          </DialogTitle>
          <DialogDescription>
            <strong>{plugin?.name || 'This plugin'}</strong> requires the following permissions to function:
          </DialogDescription>
        </DialogHeader>

        {/* Permissions list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {sortedCategories.map(([category, perms]) => (
            <div key={category}>
              <h4 className="text-xs font-medium text-app-muted uppercase mb-2 px-1">
                {category}
              </h4>
              <div className="space-y-2">
                {perms.map(({ permission, name, description, riskLevel, icon: Icon }) => {
                  const styles = getRiskLevelStyles(riskLevel);
                  return (
                    <div
                      key={permission}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-app-border ${styles.row}`}
                    >
                      <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm">{name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${styles.badge}`}>
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

        {/* High-risk warning */}
        {hasHighRiskPermissions && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">High-Risk Permissions</p>
              <p className="text-xs text-app-muted mt-1">
                This plugin requests permissions that could access sensitive data or modify your files.
                Only install plugins from trusted sources.
              </p>
            </div>
          </div>
        )}

        {/* Consent checkbox for high-risk */}
        {hasHighRiskPermissions && (
          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="w-4 h-4 rounded border-app-border bg-app-bg text-app-accent focus:ring-app-accent"
            />
            <span className="text-sm">I understand the risks and trust this plugin</span>
          </label>
        )}

        <DialogFooter>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-app-border hover:bg-app-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={hasHighRiskPermissions && !understood}
            className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
              hasHighRiskPermissions && !understood
                ? 'bg-app-muted/20 text-app-muted cursor-not-allowed'
                : 'bg-app-accent text-app-accent-fg hover:bg-app-accent/90'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Approve & Install
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PermissionConsentDialog;
