/**
 * Unit tests for TerminalAPI
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TerminalAPI } from '../../../src/plugins/api/TerminalAPI.js';

describe('TerminalAPI', () => {
    let terminalAPI;
    let mockTerminalManager;

    beforeEach(() => {
        mockTerminalManager = {
            createTerminal: vi.fn(),
            sendText: vi.fn(),
            showTerminal: vi.fn(),
            hideTerminal: vi.fn(),
            disposeTerminal: vi.fn(),
            getActiveTerminal: vi.fn(),
            on: vi.fn() // Add mock for event listener registration
        };
        terminalAPI = new TerminalAPI(mockTerminalManager);
        // Grant terminal permissions for testing
        const allPermissions = new Set([
            'terminal:create',
            'terminal:write',
            'terminal:read',
            'events:listen',
            'events:emit'
        ]);
        terminalAPI._setPermissionContext('test-plugin', allPermissions);
    });

    describe('createTerminal()', () => {
        test('should create a terminal with options', () => {
            const terminal = terminalAPI.createTerminal({
                name: 'Test Terminal',
                shellPath: '/bin/bash',
                cwd: '/home/user'
            });

            expect(terminal).toBeDefined();
            expect(terminal.name).toBe('Test Terminal');
            expect(terminal.shellPath).toBe('/bin/bash');
            expect(terminal.cwd).toBe('/home/user');
            expect(terminal.pluginId).toBe('test-plugin');
            expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
        });

        test('should create terminal with string name (overload)', () => {
            const terminal = terminalAPI.createTerminal('My Terminal');

            expect(terminal.name).toBe('My Terminal');
            expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
        });

        test('should provide terminal methods', () => {
            const terminal = terminalAPI.createTerminal({ name: 'Test' });

            expect(terminal.sendText).toBeInstanceOf(Function);
            expect(terminal.show).toBeInstanceOf(Function);
            expect(terminal.hide).toBeInstanceOf(Function);
            expect(terminal.dispose).toBeInstanceOf(Function);
        });

        test('terminal.sendText() should call manager', () => {
            const terminal = terminalAPI.createTerminal({ name: 'Test' });
            terminal.sendText('echo hello', false);

            expect(mockTerminalManager.sendText).toHaveBeenCalledWith(
                terminal.id,
                'echo hello',
                false
            );
        });

        test('terminal.show() should call manager', () => {
            const terminal = terminalAPI.createTerminal({ name: 'Test' });
            terminal.show(true);

            expect(mockTerminalManager.showTerminal).toHaveBeenCalledWith(
                terminal.id,
                true
            );
        });

        test('terminal.hide() should call manager', () => {
            const terminal = terminalAPI.createTerminal({ name: 'Test' });
            terminal.hide();

            expect(mockTerminalManager.hideTerminal).toHaveBeenCalledWith(terminal.id);
        });

        test('terminal.dispose() should remove terminal', () => {
            const terminal = terminalAPI.createTerminal({ name: 'Test' });
            const terminalId = terminal.id;

            terminal.dispose();

            expect(terminalAPI.terminals.has(terminalId)).toBe(false);
            expect(mockTerminalManager.disposeTerminal).toHaveBeenCalledWith(terminalId);
        });
    });

    describe('sendText()', () => {
        test('should send text to terminal', () => {
            terminalAPI.sendText('terminal-1', 'ls -la', true);

            expect(mockTerminalManager.sendText).toHaveBeenCalledWith(
                'terminal-1',
                'ls -la',
                true
            );
        });

        test('should default addNewLine to true', () => {
            terminalAPI.sendText('terminal-1', 'pwd');

            expect(mockTerminalManager.sendText).toHaveBeenCalledWith(
                'terminal-1',
                'pwd',
                true
            );
        });
    });

    describe('getActiveTerminal()', () => {
        test('should return active terminal from manager', () => {
            const mockActiveTerminal = { id: 'active-1', name: 'Active' };
            mockTerminalManager.getActiveTerminal.mockReturnValue(mockActiveTerminal);

            const result = terminalAPI.getActiveTerminal();

            expect(result).toBe(mockActiveTerminal);
            expect(mockTerminalManager.getActiveTerminal).toHaveBeenCalled();
        });

        test('should return undefined if no manager', () => {
            terminalAPI.terminalManager = null;

            const result = terminalAPI.getActiveTerminal();

            expect(result).toBeUndefined();
        });

        test('should return undefined if manager has no method', () => {
            terminalAPI.terminalManager = {};

            const result = terminalAPI.getActiveTerminal();

            expect(result).toBeUndefined();
        });
    });

    describe('activeTerminal getter', () => {
        test('should alias getActiveTerminal()', () => {
            const mockActiveTerminal = { id: 'active-1', name: 'Active' };
            mockTerminalManager.getActiveTerminal.mockReturnValue(mockActiveTerminal);

            const result = terminalAPI.activeTerminal;

            expect(result).toBe(mockActiveTerminal);
        });
    });

    describe('onDidOpenTerminal()', () => {
        test('should register event listener', () => {
            const listener = vi.fn();
            const unsubscribe = terminalAPI.onDidOpenTerminal(listener);

            terminalAPI.emit('terminal-opened', { terminal: { id: 't1' } });

            expect(listener).toHaveBeenCalledWith({ terminal: { id: 't1' } });
            expect(unsubscribe).toBeInstanceOf(Function);
        });
    });

    describe('onDidCloseTerminal()', () => {
        test('should register event listener', () => {
            const listener = vi.fn();
            terminalAPI.onDidCloseTerminal(listener);

            terminalAPI.emit('terminal-closed', { terminal: { id: 't1' } });

            expect(listener).toHaveBeenCalledWith({ terminal: { id: 't1' } });
        });
    });

    describe('onDidChangeActiveTerminal()', () => {
        test('should register event listener', () => {
            const listener = vi.fn();
            terminalAPI.onDidChangeActiveTerminal(listener);

            terminalAPI.emit('active-terminal-changed', { terminal: { id: 't1' } });

            expect(listener).toHaveBeenCalledWith({ terminal: { id: 't1' } });
        });
    });

    describe('integration', () => {
        test('should handle full terminal lifecycle', () => {
            const terminal = terminalAPI.createTerminal({ name: 'Test' });

            terminal.sendText('echo test');
            expect(mockTerminalManager.sendText).toHaveBeenCalled();

            terminal.show();
            expect(mockTerminalManager.showTerminal).toHaveBeenCalled();

            terminal.dispose();
            expect(mockTerminalManager.disposeTerminal).toHaveBeenCalled();
            expect(terminalAPI.terminals.has(terminal.id)).toBe(false);
        });
    });
});
