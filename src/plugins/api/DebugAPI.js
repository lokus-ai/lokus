/**
 * Debug API - Debugging and debug adapter management
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';

export class DebugAPI extends EventEmitter {
    constructor(debugManager) {
        super();
        this.debugManager = debugManager;
        this.debugAdapterProviders = new Map();
        this.activeSessions = new Map();
    }

    /**
     * Start debugging with a configuration
     */
    async startDebugging(config) {
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
        return this.on('debug-session-started', listener);
    }

    /**
     * Listen for debug session termination events
     */
    onDidTerminateDebugSession(listener) {
        return this.on('debug-session-terminated', listener);
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
