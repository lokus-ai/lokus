/**
 * Terminal API - Terminal management
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class TerminalAPI extends EventEmitter {
    constructor(terminalManager) {
        super();
        this.terminalManager = terminalManager;
        this.terminals = new Map();
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
     * Get active terminal
     */
    get activeTerminal() {
        // TODO: Implement getting active terminal from manager
        return undefined;
    }
}
