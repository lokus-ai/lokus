/**
 * Debug API - Debugging and debug adapter management
 *
 * SECURITY: All methods are permission-gated
 * NOTE: debug:session is a HIGH-RISK permission
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';
import { permissionEnforcer } from '../security/PermissionEnforcer.js';

export class DebugAPI extends EventEmitter {
    constructor(debugManager) {
        super();
        this.debugManager = debugManager;
        this.debugAdapterProviders = new Map();
        this.activeSessions = new Map();

        // Permission context
        this.currentPluginId = null;
        this.grantedPermissions = new Set();
        this.workspacePath = null;
    }

    /**
     * Set permission context for this API instance
     * @param {string} pluginId - Plugin identifier
     * @param {Set<string>} permissions - Granted permissions
     * @param {string} workspacePath - Workspace root path for scoping
     */
    _setPermissionContext(pluginId, permissions, workspacePath) {
        this.currentPluginId = pluginId;
        this.grantedPermissions = permissions || new Set();
        this.workspacePath = workspacePath;
    }

    /**
     * Require a permission - throws if not granted
     * @param {string} apiMethod - API method name for logging
     * @param {string} permission - Required permission
     */
    _requirePermission(apiMethod, permission) {
        permissionEnforcer.requirePermission(
            this.currentPluginId,
            this.grantedPermissions,
            permission,
            apiMethod
        );
    }

    /**
     * Start debugging with a configuration
     */
    async startDebugging(config) {
        this._requirePermission('debug.startDebugging', 'debug:session');

        if (!config || !config.type) {
            throw new Error('Debug configuration must have a type');
        }

        if (!config.name) {
            throw new Error('Debug configuration must have a name');
        }

        if (!config.request || !['launch', 'attach'].includes(config.request)) {
            throw new Error('Debug configuration must have a request type of "launch" or "attach"');
        }

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const session = {
            id: sessionId,
            config,
            pluginId: this.currentPluginId,
            started: Date.now()
        };

        this.activeSessions.set(sessionId, session);
        this.emit('debug-session-started', { session });

        if (this.debugManager) {
            try {
                const result = await this.debugManager.startDebugging(config, session);
                return result !== false;
            } catch (error) {
                this.activeSessions.delete(sessionId);
                this.emit('debug-session-error', { session, error });
                throw error;
            }
        }

        return true;
    }

    /**
     * Stop the active debug session
     */
    async stopDebugging() {
        this._requirePermission('debug.stopDebugging', 'debug:session');

        const activeSession = this.getActiveDebugSession();
        if (!activeSession) {
            return false;
        }

        this.activeSessions.delete(activeSession.id);
        this.emit('debug-session-terminated', { session: activeSession });

        if (this.debugManager) {
            try {
                await this.debugManager.stopDebugging(activeSession.id);
            } catch (error) {
                this.emit('debug-session-error', { session: activeSession, error });
                throw error;
            }
        }

        return true;
    }

    /**
     * Register a debug adapter provider
     */
    registerDebugAdapterProvider(type, provider) {
        this._requirePermission('debug.registerDebugAdapterProvider', 'debug:register');

        if (this.debugAdapterProviders.has(type)) {
            throw new Error(`Debug adapter provider for type '${type}' already registered`);
        }

        const providerWrapper = {
            type,
            provider,
            pluginId: this.currentPluginId,
            provideDebugConfigurations: async () => {
                if (provider.provideDebugConfigurations) {
                    return await provider.provideDebugConfigurations();
                }
                return [];
            },
            resolveDebugConfiguration: async (config) => {
                if (provider.resolveDebugConfiguration) {
                    return await provider.resolveDebugConfiguration(config);
                }
                return config;
            }
        };

        this.debugAdapterProviders.set(type, providerWrapper);

        if (this.debugManager) {
            this.debugManager.registerDebugAdapterProvider(type, providerWrapper);
        }

        this.emit('debug-adapter-registered', { type, pluginId: this.currentPluginId });

        return new Disposable(() => {
            this.debugAdapterProviders.delete(type);
            if (this.debugManager) {
                this.debugManager.unregisterDebugAdapterProvider(type);
            }
            this.emit('debug-adapter-unregistered', { type });
        });
    }

    /**
     * Get the active debug session
     */
    getActiveDebugSession() {
        this._requirePermission('debug.getActiveDebugSession', 'debug:session');

        // Return the most recent session
        const sessions = Array.from(this.activeSessions.values());
        if (sessions.length === 0) {
            return undefined;
        }
        return sessions[sessions.length - 1];
    }

    /**
     * Listen for debug session start events
     */
    onDidStartDebugSession(listener) {
        this._requirePermission('debug.onDidStartDebugSession', 'events:listen');

        const handler = (event) => listener(event);
        this.on('debug-session-started', handler);
        return new Disposable(() => this.off('debug-session-started', handler));
    }

    /**
     * Listen for debug session termination events
     */
    onDidTerminateDebugSession(listener) {
        this._requirePermission('debug.onDidTerminateDebugSession', 'events:listen');

        const handler = (event) => listener(event);
        this.on('debug-session-terminated', handler);
        return new Disposable(() => this.off('debug-session-terminated', handler));
    }

    /**
     * Cleanup all debug adapters for a plugin
     */
    cleanupPlugin(pluginId) {
        // Cleanup adapter providers
        for (const [type, providerWrapper] of this.debugAdapterProviders) {
            if (providerWrapper.pluginId === pluginId) {
                this.debugAdapterProviders.delete(type);
                if (this.debugManager) {
                    this.debugManager.unregisterDebugAdapterProvider(type);
                }
                this.emit('debug-adapter-unregistered', { type });
            }
        }

        // Terminate active sessions for this plugin
        for (const [sessionId, session] of this.activeSessions) {
            if (session.pluginId === pluginId) {
                this.activeSessions.delete(sessionId);
                this.emit('debug-session-terminated', { session });
                if (this.debugManager) {
                    this.debugManager.stopDebugging(sessionId).catch(() => {});
                }
            }
        }
    }
}
