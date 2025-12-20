/**
 * Terminal API - Terminal management
 *
 * SECURITY: All methods are permission-gated
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';
import { permissionEnforcer } from '../security/PermissionEnforcer.js';

export class TerminalAPI extends EventEmitter {
    constructor(terminalManager) {
        super();
        this.terminalManager = terminalManager;
        this.terminals = new Map();

        // Permission context
        this.currentPluginId = null;
        this.grantedPermissions = new Set();
        this.workspacePath = null;

        // Forward manager events to API events
        if (this.terminalManager) {
            this.terminalManager.on('terminal-created', (terminal) => {
                this.emit('terminal-opened', terminal);
            });

            this.terminalManager.on('terminal-disposed', ({ terminalId }) => {
                this.emit('terminal-closed', { terminalId });
            });

            this.terminalManager.on('active-terminal-changed', (terminal) => {
                this.emit('active-terminal-changed', terminal);
            });
        }
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
     * Create a new terminal
     */
    createTerminal(options) {
        this._requirePermission('terminal.createTerminal', 'terminal:create');

        const id = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Handle overload: createTerminal(name, shellPath, shellArgs)
        if (typeof options === 'string') {
            options = { name: options };
        }

        const terminal = {
            id,
            name: options.name || 'Terminal',
            shellPath: options.shellPath,
            shellArgs: options.shellArgs,
            cwd: options.cwd,
            env: options.env,
            pluginId: this.currentPluginId,

            // Terminal methods
            sendText: (text, addNewLine = true) => {
                if (this.terminalManager) {
                    this.terminalManager.sendText(id, text, addNewLine);
                }
            },

            show: (preserveFocus) => {
                if (this.terminalManager) {
                    this.terminalManager.showTerminal(id, preserveFocus);
                }
            },

            hide: () => {
                if (this.terminalManager) {
                    this.terminalManager.hideTerminal(id);
                }
            },

            dispose: () => {
                this.terminals.delete(id);
                if (this.terminalManager) {
                    this.terminalManager.disposeTerminal(id);
                }
            }
        };

        this.terminals.set(id, terminal);

        if (this.terminalManager) {
            this.terminalManager.createTerminal(terminal);
        }

        return terminal;
    }

    /**
     * Send text to a terminal
     */
    sendText(terminalId, text, addNewLine = true) {
        this._requirePermission('terminal.sendText', 'terminal:write');

        if (this.terminalManager) {
            this.terminalManager.sendText(terminalId, text, addNewLine);
        }
    }

    /**
     * Get active terminal
     */
    getActiveTerminal() {
        this._requirePermission('terminal.getActiveTerminal', 'terminal:read');

        if (this.terminalManager && this.terminalManager.getActiveTerminal) {
            return this.terminalManager.getActiveTerminal();
        }
        return undefined;
    }

    /**
     * Get active terminal (getter alias)
     */
    get activeTerminal() {
        return this.getActiveTerminal();
    }

    /**
     * Get all terminals
     */
    getTerminals() {
        this._requirePermission('terminal.getTerminals', 'terminal:read');

        if (this.terminalManager && this.terminalManager.getTerminals) {
            return this.terminalManager.getTerminals();
        }
        return [];
    }

    /**
     * Listen for terminal open events
     */
    onDidOpenTerminal(listener) {
        this._requirePermission('terminal.onDidOpenTerminal', 'events:listen');

        const handler = (terminal) => listener(terminal);
        this.on('terminal-opened', handler);
        return new Disposable(() => this.off('terminal-opened', handler));
    }

    /**
     * Listen for terminal close events
     */
    onDidCloseTerminal(listener) {
        this._requirePermission('terminal.onDidCloseTerminal', 'events:listen');

        const handler = (data) => listener(data);
        this.on('terminal-closed', handler);
        return new Disposable(() => this.off('terminal-closed', handler));
    }

    /**
     * Listen for active terminal change events
     */
    onDidChangeActiveTerminal(listener) {
        this._requirePermission('terminal.onDidChangeActiveTerminal', 'events:listen');

        const handler = (terminal) => listener(terminal);
        this.on('active-terminal-changed', handler);
        return new Disposable(() => this.off('active-terminal-changed', handler));
    }

    /**
     * Clean up all terminals for a plugin
     */
    cleanupPlugin(pluginId) {
        if (this.terminalManager && this.terminalManager.cleanupPlugin) {
            this.terminalManager.cleanupPlugin(pluginId);
        }

        // Also clean up local references
        for (const [id, terminal] of this.terminals) {
            if (terminal.pluginId === pluginId) {
                this.terminals.delete(id);
            }
        }
    }
}
