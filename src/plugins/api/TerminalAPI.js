/**
 * Terminal API - Terminal management
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class TerminalAPI extends EventEmitter {
    constructor(terminalManager) {
        super();
        this.terminalManager = terminalManager;
        this.terminals = new Map();

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
     * Create a new terminal
     */
    createTerminal(options) {
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
        if (this.terminalManager) {
            this.terminalManager.sendText(terminalId, text, addNewLine);
        }
    }

    /**
     * Get active terminal
     */
    getActiveTerminal() {
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
        if (this.terminalManager && this.terminalManager.getTerminals) {
            return this.terminalManager.getTerminals();
        }
        return [];
    }

    /**
     * Listen for terminal open events
     */
    onDidOpenTerminal(listener) {
        return this.on('terminal-opened', listener);
    }

    /**
     * Listen for terminal close events
     */
    onDidCloseTerminal(listener) {
        return this.on('terminal-closed', listener);
    }

    /**
     * Listen for active terminal change events
     */
    onDidChangeActiveTerminal(listener) {
        return this.on('active-terminal-changed', listener);
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
