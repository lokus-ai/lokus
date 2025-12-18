/**
 * Output Channel Manager Tests
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { OutputChannelManager } from '../../../../src/plugins/managers/OutputChannelManager.js';

describe('OutputChannelManager', () => {
    let manager;

    beforeEach(() => {
        manager = new OutputChannelManager();
    });

    describe('createChannel', () => {
        test('should create a new output channel', () => {
            const channel = manager.createChannel('Test Channel', 'test-plugin');

            expect(channel).toBeDefined();
            expect(channel.name).toBe('Test Channel');
        });

        test('should emit channel-created event', () => {
            const listener = vi.fn();
            manager.on('channel-created', listener);

            manager.createChannel('Test Channel', 'test-plugin');

            expect(listener).toHaveBeenCalledWith({
                name: 'Test Channel',
                pluginId: 'test-plugin'
            });
        });

        test('should return existing channel if already exists', () => {
            const channel1 = manager.createChannel('Test Channel', 'test-plugin');
            const channel2 = manager.createChannel('Test Channel', 'test-plugin');

            expect(channel1.name).toBe(channel2.name);
        });
    });

    describe('append', () => {
        test('should append text to channel', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.append('Test Channel', 'Hello');

            const output = manager.getChannelOutput('Test Channel');
            expect(output).toBe('Hello');
        });

        test('should emit channel-updated event', () => {
            const listener = vi.fn();
            manager.on('channel-updated', listener);

            manager.createChannel('Test Channel', 'test-plugin');
            manager.append('Test Channel', 'Hello');

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Channel',
                text: 'Hello'
            }));
        });
    });

    describe('appendLine', () => {
        test('should append line to channel', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.appendLine('Test Channel', 'Line 1');
            manager.appendLine('Test Channel', 'Line 2');

            const output = manager.getChannelOutput('Test Channel');
            expect(output).toBe('Line 1\nLine 2\n');
        });
    });

    describe('clear', () => {
        test('should clear channel content', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.appendLine('Test Channel', 'Line 1');
            manager.clear('Test Channel');

            const output = manager.getChannelOutput('Test Channel');
            expect(output).toBe('');
        });

        test('should emit channel-cleared event', () => {
            const listener = vi.fn();
            manager.on('channel-cleared', listener);

            manager.createChannel('Test Channel', 'test-plugin');
            manager.clear('Test Channel');

            expect(listener).toHaveBeenCalledWith({
                name: 'Test Channel'
            });
        });
    });

    describe('show', () => {
        test('should show channel', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.show('Test Channel');

            const channel = manager.getChannel('Test Channel');
            expect(channel.visible).toBe(true);
        });

        test('should set as active channel', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.show('Test Channel');

            expect(manager.activeChannelName).toBe('Test Channel');
        });

        test('should emit channel-shown event', () => {
            const listener = vi.fn();
            manager.on('channel-shown', listener);

            manager.createChannel('Test Channel', 'test-plugin');
            manager.show('Test Channel', true);

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Channel',
                preserveFocus: true
            }));
        });
    });

    describe('hide', () => {
        test('should hide channel', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.show('Test Channel');
            manager.hide('Test Channel');

            const channel = manager.getChannel('Test Channel');
            expect(channel.visible).toBe(false);
        });

        test('should emit channel-hidden event', () => {
            const listener = vi.fn();
            manager.on('channel-hidden', listener);

            manager.createChannel('Test Channel', 'test-plugin');
            manager.hide('Test Channel');

            expect(listener).toHaveBeenCalledWith({
                name: 'Test Channel'
            });
        });
    });

    describe('dispose', () => {
        test('should dispose channel', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.dispose('Test Channel');

            expect(manager.getChannel('Test Channel')).toBeUndefined();
        });

        test('should emit channel-disposed event', () => {
            const listener = vi.fn();
            manager.on('channel-disposed', listener);

            manager.createChannel('Test Channel', 'test-plugin');
            manager.dispose('Test Channel');

            expect(listener).toHaveBeenCalledWith({
                name: 'Test Channel'
            });
        });
    });

    describe('getChannels', () => {
        test('should return all channels', () => {
            manager.createChannel('Channel 1', 'test-plugin');
            manager.createChannel('Channel 2', 'test-plugin');

            const channels = manager.getChannels();
            expect(channels).toHaveLength(2);
        });
    });

    describe('getChannelOutput', () => {
        test('should return channel output as string', () => {
            manager.createChannel('Test Channel', 'test-plugin');
            manager.append('Test Channel', 'Hello ');
            manager.append('Test Channel', 'World');

            const output = manager.getChannelOutput('Test Channel');
            expect(output).toBe('Hello World');
        });
    });

    describe('cleanupPlugin', () => {
        test('should remove all channels for a plugin', () => {
            manager.createChannel('Channel 1', 'plugin-1');
            manager.createChannel('Channel 2', 'plugin-2');

            manager.cleanupPlugin('plugin-1');

            const channels = manager.getChannels();
            expect(channels).toHaveLength(1);
            expect(channels[0].pluginId).toBe('plugin-2');
        });
    });

    describe('channel API methods', () => {
        test('should provide working API methods', () => {
            const channel = manager.createChannel('Test Channel', 'test-plugin');

            channel.appendLine('Line 1');
            channel.append('Line 2');

            const output = manager.getChannelOutput('Test Channel');
            expect(output).toContain('Line 1');
            expect(output).toContain('Line 2');
        });

        test('should allow show/hide through API', () => {
            const channel = manager.createChannel('Test Channel', 'test-plugin');

            channel.show();
            expect(manager.getChannel('Test Channel').visible).toBe(true);

            channel.hide();
            expect(manager.getChannel('Test Channel').visible).toBe(false);
        });

        test('should allow clear through API', () => {
            const channel = manager.createChannel('Test Channel', 'test-plugin');

            channel.appendLine('Line 1');
            channel.clear();

            const output = manager.getChannelOutput('Test Channel');
            expect(output).toBe('');
        });
    });
});
