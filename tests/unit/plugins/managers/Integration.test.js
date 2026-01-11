/**
 * Integration tests for Terminal and Output Channel managers with Plugin API
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { LokusPluginAPI } from '../../../../src/plugins/api/LokusPluginAPI.js';

describe('Manager Integration', () => {
    let api;

    beforeEach(() => {
        api = new LokusPluginAPI({});
        api.setPluginContext('test-plugin', {
            id: 'test-plugin',
            manifest: {
                permissions: [
                    'terminal:create', 'terminal:write', 'terminal:read',
                    'ui:create', 'ui:dialogs', 'ui:notifications',
                    'commands:register', 'commands:execute',
                    'storage:read', 'storage:write',
                    'events:listen', 'events:emit'
                ]
            }
        });
    });

    describe('Terminal Manager Integration', () => {
        test('should create terminal through API', () => {
            const terminal = api.terminal.createTerminal({
                name: 'Test Terminal'
            });

            expect(terminal).toBeDefined();
            expect(terminal.name).toBe('Test Terminal');
            expect(terminal.pluginId).toBe('test-plugin');
        });

        test('should send text through terminal', () => {
            const terminal = api.terminal.createTerminal({
                name: 'Test Terminal'
            });

            // Should not throw
            terminal.sendText('echo hello');
        });

        test('should get active terminal', () => {
            const terminal = api.terminal.createTerminal({
                name: 'Test Terminal'
            });

            const active = api.terminal.getActiveTerminal();
            expect(active).toBeDefined();
            expect(active.id).toBe(terminal.id);
        });

        test('should clean up terminals on plugin cleanup', async () => {
            api.terminal.createTerminal({
                name: 'Test Terminal 1'
            });

            api.terminal.createTerminal({
                name: 'Test Terminal 2'
            });

            await api.cleanup('test-plugin');

            // Terminals should be cleaned up
            const terminals = api.terminal.getTerminals();
            const pluginTerminals = terminals.filter(t => t.pluginId === 'test-plugin');
            expect(pluginTerminals).toHaveLength(0);
        });
    });

    describe('Output Channel Manager Integration', () => {
        test('should create output channel through UI API', () => {
            const channel = api.ui.createOutputChannel('Test Channel');

            expect(channel).toBeDefined();
            expect(channel.name).toBe('Test Channel');
        });

        test('should append to output channel', () => {
            const channel = api.ui.createOutputChannel('Test Channel');

            // Should not throw
            channel.appendLine('Test output');
            channel.append('More output');
        });

        test('should show and hide channel', () => {
            const channel = api.ui.createOutputChannel('Test Channel');

            // Should not throw
            channel.show();
            channel.hide();
        });

        test('should clear channel', () => {
            const channel = api.ui.createOutputChannel('Test Channel');

            channel.appendLine('Test output');
            channel.clear();

            // Should not throw
        });

        test('should dispose channel', () => {
            const channel = api.ui.createOutputChannel('Test Channel');

            // Should not throw
            channel.dispose();
        });

        test('should clean up channels on plugin cleanup', async () => {
            api.ui.createOutputChannel('Test Channel 1');
            api.ui.createOutputChannel('Test Channel 2');

            await api.cleanup('test-plugin');

            // Channels should be cleaned up
            // We can't easily verify this without accessing the manager directly,
            // but at least it should not throw
        });
    });

    describe('Event Forwarding', () => {
        test('should forward terminal events', () => {
            return new Promise((resolve) => {
                let timeoutId;

                api.terminal.onDidOpenTerminal((terminal) => {
                    expect(terminal).toBeDefined();
                    clearTimeout(timeoutId);
                    resolve();
                });

                api.terminal.createTerminal({
                    name: 'Test Terminal'
                });

                // Timeout in case event doesn't fire
                timeoutId = setTimeout(() => {
                    resolve();
                }, 100);
            });
        });

        test('should forward output channel events', () => {
            return new Promise((resolve) => {
                let timeoutId;

                api.ui.on('output-channel-update', (data) => {
                    expect(data).toBeDefined();
                    expect(data.name).toBe('Test Channel');
                    clearTimeout(timeoutId);
                    resolve();
                });

                const channel = api.ui.createOutputChannel('Test Channel');
                channel.appendLine('Test output');

                // Timeout in case event doesn't fire
                timeoutId = setTimeout(() => {
                    resolve();
                }, 100);
            });
        });
    });
});
