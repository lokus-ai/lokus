/**
 * Terminal Manager - Manages virtual terminals for plugins
 * Since plugins run in the browser, we can't create real OS terminals,
 * but we can maintain virtual terminal state and output history.
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class TerminalManager extends EventEmitter {
    constructor() {
        super();
        this.terminals = new Map();
        this.activeTerminalId = null;
    }

    /**
     * Create a new terminal
     * @param {Object} terminal - Terminal object from TerminalAPI
     * @returns {Object} Terminal instance
     */
    createTerminal(terminal) {
        if (this.terminals.has(terminal.id)) {
            return this.terminals.get(terminal.id);
        }

        // Store terminal with output history
        const terminalState = {
            ...terminal,
            output: [],
            visible: false,
            createdAt: Date.now()
        };

        this.terminals.set(terminal.id, terminalState);
        this.activeTerminalId = terminal.id;

        this.emit('terminal-created', terminalState);
        this.emit('active-terminal-changed', terminalState);

        return terminalState;
    }

    /**
     * Send text to a terminal
     * @param {string} terminalId - Terminal ID
     * @param {string} text - Text to send
     * @param {boolean} addNewLine - Whether to add a newline
     */
    sendText(terminalId, text, addNewLine = true) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            console.warn(`Terminal ${terminalId} not found`);
            return;
        }

        const fullText = addNewLine ? text + '\n' : text;
        terminal.output.push({
            type: 'input',
            text: fullText,
            timestamp: Date.now()
        });

        this.emit('terminal-data', { terminalId, text: fullText });

        // In a real implementation, this would send to xterm.js or actual terminal
        console.log(`[Terminal ${terminal.name}] ${text}`);
    }

    /**
     * Show a terminal
     * @param {string} terminalId - Terminal ID
     * @param {boolean} preserveFocus - Whether to preserve focus
     */
    showTerminal(terminalId, preserveFocus = false) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            console.warn(`Terminal ${terminalId} not found`);
            return;
        }

        terminal.visible = true;
        this.activeTerminalId = terminalId;

        this.emit('terminal-shown', { terminalId, preserveFocus });
        this.emit('active-terminal-changed', terminal);
    }

    /**
     * Hide a terminal
     * @param {string} terminalId - Terminal ID
     */
    hideTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            console.warn(`Terminal ${terminalId} not found`);
            return;
        }

        terminal.visible = false;
        this.emit('terminal-hidden', { terminalId });

        // If this was the active terminal, clear active
        if (this.activeTerminalId === terminalId) {
            // Find next visible terminal
            const nextTerminal = Array.from(this.terminals.values()).find(t => t.visible);
            this.activeTerminalId = nextTerminal ? nextTerminal.id : null;
            this.emit('active-terminal-changed', nextTerminal || null);
        }
    }

    /**
     * Dispose a terminal
     * @param {string} terminalId - Terminal ID
     */
    disposeTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            return;
        }

        this.terminals.delete(terminalId);

        // Update active terminal
        if (this.activeTerminalId === terminalId) {
            const terminals = Array.from(this.terminals.values());
            this.activeTerminalId = terminals.length > 0 ? terminals[0].id : null;
            this.emit('active-terminal-changed', this.activeTerminalId ? this.terminals.get(this.activeTerminalId) : null);
        }

        this.emit('terminal-disposed', { terminalId });
    }

    /**
     * Get all terminals
     * @returns {Array} Array of all terminals
     */
    getTerminals() {
        return Array.from(this.terminals.values());
    }

    /**
     * Get the active terminal
     * @returns {Object|null} Active terminal or null
     */
    getActiveTerminal() {
        return this.activeTerminalId ? this.terminals.get(this.activeTerminalId) : null;
    }

    /**
     * Get a terminal by ID
     * @param {string} terminalId - Terminal ID
     * @returns {Object|undefined} Terminal object
     */
    getTerminal(terminalId) {
        return this.terminals.get(terminalId);
    }

    /**
     * Clear terminal output
     * @param {string} terminalId - Terminal ID
     */
    clearTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            return;
        }

        terminal.output = [];
        this.emit('terminal-cleared', { terminalId });
    }

    /**
     * Write output to a terminal (simulating command execution)
     * @param {string} terminalId - Terminal ID
     * @param {string} text - Output text
     * @param {string} type - Output type ('stdout' or 'stderr')
     */
    writeOutput(terminalId, text, type = 'stdout') {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) {
            return;
        }

        terminal.output.push({
            type,
            text,
            timestamp: Date.now()
        });

        this.emit('terminal-output', { terminalId, text, type });
    }

    /**
     * Clean up all terminals for a plugin
     * @param {string} pluginId - Plugin ID
     */
    cleanupPlugin(pluginId) {
        const terminalsToRemove = [];

        for (const [id, terminal] of this.terminals) {
            if (terminal.pluginId === pluginId) {
                terminalsToRemove.push(id);
            }
        }

        for (const id of terminalsToRemove) {
            this.disposeTerminal(id);
        }
    }
}

// Export singleton instance
export const terminalManager = new TerminalManager();
export default terminalManager;
