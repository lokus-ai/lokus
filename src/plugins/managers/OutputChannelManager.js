/**
 * Output Channel Manager - Manages output channels for plugins
 * Output channels are named text output streams for displaying plugin logs/output
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class OutputChannelManager extends EventEmitter {
    constructor() {
        super();
        this.channels = new Map();
        this.activeChannelName = null;
    }

    /**
     * Create a new output channel
     * @param {string} name - Channel name
     * @param {string} pluginId - Plugin ID that owns this channel
     * @returns {Object} Channel API object
     */
    createChannel(name, pluginId) {
        if (this.channels.has(name)) {
            return this.getChannelAPI(name);
        }

        const channel = {
            name,
            pluginId,
            output: [],
            visible: false,
            createdAt: Date.now()
        };

        this.channels.set(name, channel);
        this.emit('channel-created', { name, pluginId });

        return this.getChannelAPI(name);
    }

    /**
     * Get the API object for a channel
     * @param {string} name - Channel name
     * @returns {Object} Channel API
     */
    getChannelAPI(name) {
        return {
            name,
            append: (text) => this.append(name, text),
            appendLine: (text) => this.appendLine(name, text),
            replace: (text) => this.replace(name, text),
            clear: () => this.clear(name),
            show: (preserveFocus) => this.show(name, preserveFocus),
            hide: () => this.hide(name),
            dispose: () => this.dispose(name)
        };
    }

    /**
     * Append text to a channel
     * @param {string} channelName - Channel name
     * @param {string} text - Text to append
     */
    append(channelName, text) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`Output channel '${channelName}' not found`);
            return;
        }

        // If there's existing output, append to the last line
        if (channel.output.length > 0) {
            const lastEntry = channel.output[channel.output.length - 1];
            lastEntry.text += text;
            lastEntry.timestamp = Date.now();
        } else {
            channel.output.push({
                text,
                timestamp: Date.now()
            });
        }

        this.emit('channel-updated', {
            name: channelName,
            text,
            output: this.getChannelOutput(channelName)
        });
    }

    /**
     * Append a line to a channel
     * @param {string} channelName - Channel name
     * @param {string} text - Text to append
     */
    appendLine(channelName, text) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`Output channel '${channelName}' not found`);
            return;
        }

        channel.output.push({
            text: text + '\n',
            timestamp: Date.now()
        });

        this.emit('channel-updated', {
            name: channelName,
            text: text + '\n',
            output: this.getChannelOutput(channelName)
        });
    }

    /**
     * Replace all content in a channel
     * @param {string} channelName - Channel name
     * @param {string} text - New content
     */
    replace(channelName, text) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`Output channel '${channelName}' not found`);
            return;
        }

        channel.output = [{
            text,
            timestamp: Date.now()
        }];

        this.emit('channel-updated', {
            name: channelName,
            text,
            output: this.getChannelOutput(channelName)
        });
    }

    /**
     * Clear a channel's content
     * @param {string} channelName - Channel name
     */
    clear(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`Output channel '${channelName}' not found`);
            return;
        }

        channel.output = [];
        this.emit('channel-cleared', { name: channelName });
        this.emit('channel-updated', {
            name: channelName,
            text: '',
            output: []
        });
    }

    /**
     * Show a channel
     * @param {string} channelName - Channel name
     * @param {boolean} preserveFocus - Whether to preserve focus
     */
    show(channelName, preserveFocus = false) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`Output channel '${channelName}' not found`);
            return;
        }

        channel.visible = true;
        this.activeChannelName = channelName;

        this.emit('channel-shown', {
            name: channelName,
            preserveFocus,
            output: this.getChannelOutput(channelName)
        });
    }

    /**
     * Hide a channel
     * @param {string} channelName - Channel name
     */
    hide(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`Output channel '${channelName}' not found`);
            return;
        }

        channel.visible = false;
        this.emit('channel-hidden', { name: channelName });

        // If this was the active channel, clear active
        if (this.activeChannelName === channelName) {
            // Find next visible channel
            const nextChannel = Array.from(this.channels.values()).find(c => c.visible);
            this.activeChannelName = nextChannel ? nextChannel.name : null;
        }
    }

    /**
     * Dispose a channel
     * @param {string} channelName - Channel name
     */
    dispose(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            return;
        }

        this.channels.delete(channelName);

        // Update active channel
        if (this.activeChannelName === channelName) {
            const channels = Array.from(this.channels.values());
            this.activeChannelName = channels.length > 0 ? channels[0].name : null;
        }

        this.emit('channel-disposed', { name: channelName });
    }

    /**
     * Get all channels
     * @returns {Array} Array of all channels
     */
    getChannels() {
        return Array.from(this.channels.values());
    }

    /**
     * Get the active channel
     * @returns {Object|null} Active channel or null
     */
    getActiveChannel() {
        return this.activeChannelName ? this.channels.get(this.activeChannelName) : null;
    }

    /**
     * Get a channel by name
     * @param {string} name - Channel name
     * @returns {Object|undefined} Channel object
     */
    getChannel(name) {
        return this.channels.get(name);
    }

    /**
     * Get channel output as a string
     * @param {string} channelName - Channel name
     * @returns {string} Channel output
     */
    getChannelOutput(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            return '';
        }

        return channel.output.map(entry => entry.text).join('');
    }

    /**
     * Get channel output as array of entries
     * @param {string} channelName - Channel name
     * @returns {Array} Channel output entries
     */
    getChannelEntries(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            return [];
        }

        return [...channel.output];
    }

    /**
     * Clean up all channels for a plugin
     * @param {string} pluginId - Plugin ID
     */
    cleanupPlugin(pluginId) {
        const channelsToRemove = [];

        for (const [name, channel] of this.channels) {
            if (channel.pluginId === pluginId) {
                channelsToRemove.push(name);
            }
        }

        for (const name of channelsToRemove) {
            this.dispose(name);
        }
    }
}

// Export singleton instance
export const outputChannelManager = new OutputChannelManager();
export default outputChannelManager;
