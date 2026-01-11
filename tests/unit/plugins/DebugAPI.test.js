/**
 * Unit tests for DebugAPI
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { DebugAPI } from '../../../src/plugins/api/DebugAPI.js';

describe('DebugAPI', () => {
    let debugAPI;
    let mockDebugManager;

    beforeEach(() => {
        mockDebugManager = {
            startDebugging: vi.fn().mockResolvedValue(true),
            stopDebugging: vi.fn().mockResolvedValue(true),
            registerDebugAdapterProvider: vi.fn(),
            unregisterDebugAdapterProvider: vi.fn()
        };
        debugAPI = new DebugAPI(mockDebugManager);
        // Grant debug permissions for testing
        const allPermissions = new Set([
            'debug:session',
            'debug:register',
            'events:listen',
            'events:emit'
        ]);
        debugAPI._setPermissionContext('test-plugin', allPermissions);
    });

    describe('startDebugging()', () => {
        test('should start debugging with valid config', async () => {
            const config = {
                type: 'node',
                name: 'Launch Program',
                request: 'launch',
                program: '${workspaceFolder}/index.js'
            };

            const result = await debugAPI.startDebugging(config);

            expect(result).toBe(true);
            expect(mockDebugManager.startDebugging).toHaveBeenCalled();
            expect(debugAPI.activeSessions.size).toBe(1);
        });

        test('should throw if config has no type', async () => {
            const config = {
                name: 'Launch',
                request: 'launch'
            };

            await expect(debugAPI.startDebugging(config)).rejects.toThrow(
                'Debug configuration must have a type'
            );
        });

        test('should throw if config has no name', async () => {
            const config = {
                type: 'node',
                request: 'launch'
            };

            await expect(debugAPI.startDebugging(config)).rejects.toThrow(
                'Debug configuration must have a name'
            );
        });

        test('should throw if request is not launch or attach', async () => {
            const config = {
                type: 'node',
                name: 'Launch',
                request: 'invalid'
            };

            await expect(debugAPI.startDebugging(config)).rejects.toThrow(
                'Debug configuration must have a request type of "launch" or "attach"'
            );
        });

        test('should support launch request', async () => {
            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            const result = await debugAPI.startDebugging(config);

            expect(result).toBe(true);
        });

        test('should support attach request', async () => {
            const config = {
                type: 'node',
                name: 'Attach',
                request: 'attach',
                port: 9229
            };

            const result = await debugAPI.startDebugging(config);

            expect(result).toBe(true);
        });

        test('should emit debug-session-started event', async () => {
            const listener = vi.fn();
            debugAPI.on('debug-session-started', listener);

            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);

            expect(listener).toHaveBeenCalled();
            const eventData = listener.mock.calls[0][0];
            expect(eventData.session).toBeDefined();
            expect(eventData.session.config).toBe(config);
        });

        test('should cleanup session on error', async () => {
            const error = new Error('Debug failed');
            mockDebugManager.startDebugging.mockRejectedValue(error);
            const errorListener = vi.fn();
            debugAPI.on('debug-session-error', errorListener);

            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await expect(debugAPI.startDebugging(config)).rejects.toThrow('Debug failed');
            expect(debugAPI.activeSessions.size).toBe(0);
            expect(errorListener).toHaveBeenCalled();
        });

        test('should store plugin context with session', async () => {
            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);

            const sessions = Array.from(debugAPI.activeSessions.values());
            expect(sessions[0].pluginId).toBe('test-plugin');
        });
    });

    describe('stopDebugging()', () => {
        test('should stop active debug session', async () => {
            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);
            expect(debugAPI.activeSessions.size).toBe(1);

            const result = await debugAPI.stopDebugging();

            expect(result).toBe(true);
            expect(debugAPI.activeSessions.size).toBe(0);
            expect(mockDebugManager.stopDebugging).toHaveBeenCalled();
        });

        test('should return false if no active session', async () => {
            const result = await debugAPI.stopDebugging();

            expect(result).toBe(false);
        });

        test('should emit debug-session-terminated event', async () => {
            const listener = vi.fn();
            debugAPI.on('debug-session-terminated', listener);

            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);
            await debugAPI.stopDebugging();

            expect(listener).toHaveBeenCalled();
            const eventData = listener.mock.calls[0][0];
            expect(eventData.session).toBeDefined();
        });

        test('should handle stop errors', async () => {
            const error = new Error('Stop failed');
            mockDebugManager.stopDebugging.mockRejectedValue(error);
            const errorListener = vi.fn();
            debugAPI.on('debug-session-error', errorListener);

            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);
            await expect(debugAPI.stopDebugging()).rejects.toThrow('Stop failed');
            expect(errorListener).toHaveBeenCalled();
        });
    });

    describe('registerDebugAdapterProvider()', () => {
        test('should register debug adapter provider', () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            const disposable = debugAPI.registerDebugAdapterProvider('node', provider);

            expect(debugAPI.debugAdapterProviders.has('node')).toBe(true);
            expect(mockDebugManager.registerDebugAdapterProvider).toHaveBeenCalled();
            expect(disposable).toHaveProperty('dispose');
        });

        test('should throw if provider type already exists', () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            debugAPI.registerDebugAdapterProvider('node', provider);

            expect(() => {
                debugAPI.registerDebugAdapterProvider('node', provider);
            }).toThrow("Debug adapter provider for type 'node' already registered");
        });

        test('should store plugin context with provider', () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            debugAPI.registerDebugAdapterProvider('node', provider);
            const registered = debugAPI.debugAdapterProviders.get('node');

            expect(registered.pluginId).toBe('test-plugin');
            expect(registered.type).toBe('node');
        });

        test('disposable should unregister provider', () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            const disposable = debugAPI.registerDebugAdapterProvider('node', provider);
            expect(debugAPI.debugAdapterProviders.has('node')).toBe(true);

            disposable.dispose();
            expect(debugAPI.debugAdapterProviders.has('node')).toBe(false);
            expect(mockDebugManager.unregisterDebugAdapterProvider).toHaveBeenCalledWith('node');
        });

        test('should emit debug-adapter-registered event', () => {
            const listener = vi.fn();
            debugAPI.on('debug-adapter-registered', listener);

            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            debugAPI.registerDebugAdapterProvider('node', provider);

            expect(listener).toHaveBeenCalledWith({
                type: 'node',
                pluginId: 'test-plugin'
            });
        });
    });

    describe('getActiveDebugSession()', () => {
        test('should return most recent session', async () => {
            const config1 = {
                type: 'node',
                name: 'Session 1',
                request: 'launch'
            };

            const config2 = {
                type: 'node',
                name: 'Session 2',
                request: 'launch'
            };

            await debugAPI.startDebugging(config1);
            await debugAPI.startDebugging(config2);

            const active = debugAPI.getActiveDebugSession();

            expect(active).toBeDefined();
            expect(active.config.name).toBe('Session 2');
        });

        test('should return undefined if no sessions', () => {
            const active = debugAPI.getActiveDebugSession();

            expect(active).toBeUndefined();
        });
    });

    describe('onDidStartDebugSession()', () => {
        test('should register event listener', async () => {
            const listener = vi.fn();
            debugAPI.onDidStartDebugSession(listener);

            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('onDidTerminateDebugSession()', () => {
        test('should register event listener', async () => {
            const listener = vi.fn();
            debugAPI.onDidTerminateDebugSession(listener);

            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);
            await debugAPI.stopDebugging();

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('cleanupPlugin()', () => {
        test('should cleanup all providers for a plugin', () => {
            const provider1 = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            const provider2 = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            debugAPI.registerDebugAdapterProvider('node', provider1);

            // Switch to different plugin
            debugAPI.currentPluginId = 'other-plugin';
            debugAPI.registerDebugAdapterProvider('python', provider2);

            expect(debugAPI.debugAdapterProviders.size).toBe(2);

            debugAPI.cleanupPlugin('test-plugin');

            expect(debugAPI.debugAdapterProviders.size).toBe(1);
            expect(debugAPI.debugAdapterProviders.has('node')).toBe(false);
            expect(debugAPI.debugAdapterProviders.has('python')).toBe(true);
        });

        test('should terminate active sessions for plugin', async () => {
            const config = {
                type: 'node',
                name: 'Launch',
                request: 'launch'
            };

            await debugAPI.startDebugging(config);
            expect(debugAPI.activeSessions.size).toBe(1);

            debugAPI.cleanupPlugin('test-plugin');

            expect(debugAPI.activeSessions.size).toBe(0);
        });

        test('should emit events on cleanup', () => {
            const adapterListener = vi.fn();
            const sessionListener = vi.fn();
            debugAPI.on('debug-adapter-unregistered', adapterListener);
            debugAPI.on('debug-session-terminated', sessionListener);

            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            debugAPI.registerDebugAdapterProvider('node', provider);
            debugAPI.cleanupPlugin('test-plugin');

            expect(adapterListener).toHaveBeenCalledWith({ type: 'node' });
        });
    });

    describe('provider wrapper', () => {
        test('should call provider.provideDebugConfigurations()', async () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([
                    { type: 'node', name: 'Config 1', request: 'launch' }
                ])
            };

            debugAPI.registerDebugAdapterProvider('node', provider);
            const wrapper = debugAPI.debugAdapterProviders.get('node');

            const configs = await wrapper.provideDebugConfigurations();

            expect(provider.provideDebugConfigurations).toHaveBeenCalled();
            expect(configs).toHaveLength(1);
        });

        test('should call provider.resolveDebugConfiguration() if available', async () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([]),
                resolveDebugConfiguration: vi.fn().mockResolvedValue({
                    type: 'node',
                    name: 'Resolved',
                    request: 'launch',
                    resolved: true
                })
            };

            debugAPI.registerDebugAdapterProvider('node', provider);
            const wrapper = debugAPI.debugAdapterProviders.get('node');

            const config = { type: 'node', name: 'Test', request: 'launch' };
            const resolved = await wrapper.resolveDebugConfiguration(config);

            expect(provider.resolveDebugConfiguration).toHaveBeenCalledWith(config);
            expect(resolved.resolved).toBe(true);
        });

        test('should return config unchanged if no resolveDebugConfiguration', async () => {
            const provider = {
                provideDebugConfigurations: vi.fn().mockResolvedValue([])
            };

            debugAPI.registerDebugAdapterProvider('node', provider);
            const wrapper = debugAPI.debugAdapterProviders.get('node');

            const config = { type: 'node', name: 'Test', request: 'launch' };
            const resolved = await wrapper.resolveDebugConfiguration(config);

            expect(resolved).toBe(config);
        });
    });
});
