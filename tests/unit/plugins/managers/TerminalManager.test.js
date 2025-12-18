/**
 * Terminal Manager Tests
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TerminalManager } from '../../../../src/plugins/managers/TerminalManager.js';

describe('TerminalManager', () => {
    let manager;

    beforeEach(() => {
        manager = new TerminalManager();
    });

    describe('createTerminal', () => {
        test('should create a new terminal', () => {
            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            const result = manager.createTerminal(terminal);

            expect(result).toBeDefined();
            expect(result.id).toBe('test-terminal-1');
            expect(result.name).toBe('Test Terminal');
            expect(result.output).toEqual([]);
        });

        test('should set terminal as active', () => {
            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);

            expect(manager.activeTerminalId).toBe('test-terminal-1');
        });

        test('should emit terminal-created event', () => {
            const listener = vi.fn();
            manager.on('terminal-created', listener);

            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                id: 'test-terminal-1',
                name: 'Test Terminal'
            }));
        });
    });

    describe('sendText', () => {
        test('should send text to terminal', () => {
            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);
            manager.sendText('test-terminal-1', 'echo hello');

            const terminalState = manager.getTerminal('test-terminal-1');
            expect(terminalState.output).toHaveLength(1);
            expect(terminalState.output[0].text).toBe('echo hello\n');
            expect(terminalState.output[0].type).toBe('input');
        });

        test('should emit terminal-data event', () => {
            const listener = vi.fn();
            manager.on('terminal-data', listener);

            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);
            manager.sendText('test-terminal-1', 'echo hello');

            expect(listener).toHaveBeenCalledWith({
                terminalId: 'test-terminal-1',
                text: 'echo hello\n'
            });
        });
    });

    describe('showTerminal', () => {
        test('should show terminal', () => {
            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);
            manager.showTerminal('test-terminal-1');

            const terminalState = manager.getTerminal('test-terminal-1');
            expect(terminalState.visible).toBe(true);
        });

        test('should emit terminal-shown event', () => {
            const listener = vi.fn();
            manager.on('terminal-shown', listener);

            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);
            manager.showTerminal('test-terminal-1', true);

            expect(listener).toHaveBeenCalledWith({
                terminalId: 'test-terminal-1',
                preserveFocus: true
            });
        });
    });

    describe('disposeTerminal', () => {
        test('should dispose terminal', () => {
            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);
            manager.disposeTerminal('test-terminal-1');

            expect(manager.getTerminal('test-terminal-1')).toBeUndefined();
        });

        test('should emit terminal-disposed event', () => {
            const listener = vi.fn();
            manager.on('terminal-disposed', listener);

            const terminal = {
                id: 'test-terminal-1',
                name: 'Test Terminal',
                pluginId: 'test-plugin'
            };

            manager.createTerminal(terminal);
            manager.disposeTerminal('test-terminal-1');

            expect(listener).toHaveBeenCalledWith({
                terminalId: 'test-terminal-1'
            });
        });
    });

    describe('getTerminals', () => {
        test('should return all terminals', () => {
            manager.createTerminal({
                id: 'test-terminal-1',
                name: 'Terminal 1',
                pluginId: 'test-plugin'
            });

            manager.createTerminal({
                id: 'test-terminal-2',
                name: 'Terminal 2',
                pluginId: 'test-plugin'
            });

            const terminals = manager.getTerminals();
            expect(terminals).toHaveLength(2);
        });
    });

    describe('cleanupPlugin', () => {
        test('should remove all terminals for a plugin', () => {
            manager.createTerminal({
                id: 'test-terminal-1',
                name: 'Terminal 1',
                pluginId: 'plugin-1'
            });

            manager.createTerminal({
                id: 'test-terminal-2',
                name: 'Terminal 2',
                pluginId: 'plugin-2'
            });

            manager.cleanupPlugin('plugin-1');

            const terminals = manager.getTerminals();
            expect(terminals).toHaveLength(1);
            expect(terminals[0].pluginId).toBe('plugin-2');
        });
    });
});
