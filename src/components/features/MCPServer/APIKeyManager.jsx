import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, Calendar, Shield } from 'lucide-react';

export default function APIKeyManager() {
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [copiedKeys, setCopiedKeys] = useState(new Set());

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      // Simulate loading API keys - in real implementation, call Tauri command
      // const keys = await invoke('get_api_keys');
      const mockKeys = [
        {
          id: '1',
          name: 'Development Client',
          key: 'mcp_dev_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
          permissions: ['read', 'write'],
          createdAt: new Date('2024-01-15').toISOString(),
          lastUsed: new Date('2024-01-20').toISOString(),
          usageCount: 142,
          isActive: true
        },
        {
          id: '2',
          name: 'Production Bot',
          key: 'mcp_prod_zyx987wvu654tsr321qpo098nml765kji432hgf109edc876ba',
          permissions: ['read'],
          createdAt: new Date('2024-01-10').toISOString(),
          lastUsed: new Date('2024-01-22').toISOString(),
          usageCount: 2847,
          isActive: true
        },
        {
          id: '3',
          name: 'Test Environment',
          key: 'mcp_test_111222333444555666777888999000aaabbbbccccddddeee',
          permissions: ['read', 'write', 'admin'],
          createdAt: new Date('2024-01-05').toISOString(),
          lastUsed: null,
          usageCount: 0,
          isActive: false
        }
      ];
      setApiKeys(mockKeys);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const generateAPIKey = async (name, permissions) => {
    try {
      // Generate a new API key - in real implementation, call Tauri command
      // const newKey = await invoke('generate_api_key', { name, permissions });
      
      const newKey = {
        id: Date.now().toString(),
        name,
        key: `mcp_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        permissions,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
        isActive: true
      };
      
      setApiKeys(prev => [...prev, newKey]);
      setShowCreateModal(false);
      
      // Auto-show the new key
      setVisibleKeys(prev => new Set([...prev, newKey.id]));
      
      return newKey;
    } catch (error) {
      console.error('Failed to generate API key:', error);
      throw error;
    }
  };

  const revokeAPIKey = async (keyId) => {
    try {
      // Revoke API key - in real implementation, call Tauri command
      // await invoke('revoke_api_key', { keyId });
      
      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      setVisibleKeys(prev => {
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  const copyToClipboard = async (text, keyId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeys(prev => new Set([...prev, keyId]));
      setTimeout(() => {
        setCopiedKeys(prev => {
          const next = new Set(prev);
          next.delete(keyId);
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const toggleKeyStatus = async (keyId) => {
    try {
      // Toggle key status - in real implementation, call Tauri command
      // await invoke('toggle_api_key_status', { keyId });
      
      setApiKeys(prev => prev.map(key => 
        key.id === keyId ? { ...key, isActive: !key.isActive } : key
      ));
    } catch (error) {
      console.error('Failed to toggle key status:', error);
    }
  };

  const formatKey = (key, isVisible) => {
    if (!isVisible) {
      return key.substring(0, 8) + '•'.repeat(48) + key.substring(key.length - 4);
    }
    return key;
  };

  const getPermissionColor = (permission) => {
    switch (permission) {
      case 'read': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'write': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <section className="bg-app-panel/40 border border-app-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-app-text">API Key Management</h2>
          <p className="text-sm text-app-muted">Generate and manage API keys for MCP client authentication</p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Generate Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-8 text-app-muted">
            <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No API keys generated yet</p>
            <p className="text-sm">Create your first API key to allow external clients to connect</p>
          </div>
        ) : (
          apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="bg-app-bg border border-app-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-app-text">{apiKey.name}</h3>
                    <div className="flex gap-1">
                      {apiKey.permissions.map((permission) => (
                        <span
                          key={permission}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPermissionColor(permission)}`}
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                      apiKey.isActive 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${apiKey.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {apiKey.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  
                  <div className="text-sm text-app-muted grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      Last used: {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                    </div>
                    <div>
                      Usage count: {apiKey.usageCount.toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleKeyStatus(apiKey.id)}
                    className={`p-2 rounded-md transition-colors ${
                      apiKey.isActive
                        ? 'text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
                        : 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20'
                    }`}
                    title={apiKey.isActive ? 'Deactivate key' : 'Activate key'}
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => revokeAPIKey(apiKey.id)}
                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-app-panel/50 rounded-md p-3 font-mono text-sm">
                <span className="flex-1 select-all">
                  {formatKey(apiKey.key, visibleKeys.has(apiKey.id))}
                </span>
                
                <button
                  onClick={() => toggleKeyVisibility(apiKey.id)}
                  className="p-1 text-app-muted hover:text-app-text transition-colors"
                  title={visibleKeys.has(apiKey.id) ? 'Hide key' : 'Show key'}
                >
                  {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                  className="p-1 text-app-muted hover:text-app-text transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedKeys.has(apiKey.id) ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <CreateAPIKeyModal
          onClose={() => setShowCreateModal(false)}
          onGenerate={generateAPIKey}
        />
      )}
    </section>
  );
}

function CreateAPIKeyModal({ onClose, onGenerate }) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(['read']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Key name is required');
      return;
    }
    
    if (permissions.length === 0) {
      setError('At least one permission is required');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError('');
      await onGenerate(name.trim(), permissions);
    } catch (error) {
      setError(error.message || 'Failed to generate API key');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePermission = (permission) => {
    setPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission);
      } else {
        return [...prev, permission];
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-bg border border-app-border rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-medium text-app-text mb-4">Generate API Key</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">
              Key Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Development Client"
              className="w-full h-10 px-3 rounded-md bg-app-panel border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {[
                { id: 'read', label: 'Read', description: 'Access resources and data' },
                { id: 'write', label: 'Write', description: 'Create and modify resources' },
                { id: 'admin', label: 'Admin', description: 'Full administrative access' }
              ].map((perm) => (
                <label key={perm.id} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="mt-0.5 w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent/40"
                  />
                  <div>
                    <div className="text-sm text-app-text">{perm.label}</div>
                    <div className="text-xs text-app-muted">{perm.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2">
              {error}
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-app-border rounded-md text-app-text hover:bg-app-panel transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="flex-1 px-4 py-2 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}