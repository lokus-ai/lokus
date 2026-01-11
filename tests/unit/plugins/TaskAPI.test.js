/**
 * Unit tests for TaskAPI
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TaskAPI } from '../../../src/plugins/api/TaskAPI.js';

describe('TaskAPI', () => {
    let taskAPI;
    let mockTaskManager;

    beforeEach(() => {
        mockTaskManager = {
            registerTaskProvider: vi.fn(),
            unregisterTaskProvider: vi.fn(),
            executeTask: vi.fn(),
            terminateTask: vi.fn()
        };
        taskAPI = new TaskAPI(mockTaskManager);
        // Grant task permissions for testing
        const allPermissions = new Set([
            'tasks:register',
            'tasks:execute'
        ]);
        taskAPI._setPermissionContext('test-plugin', allPermissions);
    });

    describe('registerTaskProvider()', () => {
        test('should register a task provider', () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            const disposable = taskAPI.registerTaskProvider('npm', provider);

            expect(taskAPI.taskProviders.has('npm')).toBe(true);
            expect(mockTaskManager.registerTaskProvider).toHaveBeenCalled();
            expect(disposable).toHaveProperty('dispose');
        });

        test('should throw if provider type already exists', () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            taskAPI.registerTaskProvider('npm', provider);

            expect(() => {
                taskAPI.registerTaskProvider('npm', provider);
            }).toThrow("Task provider for type 'npm' already registered");
        });

        test('should store plugin context with provider', () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            taskAPI.registerTaskProvider('npm', provider);
            const registered = taskAPI.taskProviders.get('npm');

            expect(registered.pluginId).toBe('test-plugin');
            expect(registered.type).toBe('npm');
        });

        test('disposable should unregister provider', () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            const disposable = taskAPI.registerTaskProvider('npm', provider);
            expect(taskAPI.taskProviders.has('npm')).toBe(true);

            disposable.dispose();
            expect(taskAPI.taskProviders.has('npm')).toBe(false);
            expect(mockTaskManager.unregisterTaskProvider).toHaveBeenCalledWith('npm');
        });

        test('should emit task-provider-registered event', () => {
            const listener = vi.fn();
            taskAPI.on('task-provider-registered', listener);

            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            taskAPI.registerTaskProvider('npm', provider);

            expect(listener).toHaveBeenCalledWith({
                type: 'npm',
                pluginId: 'test-plugin'
            });
        });
    });

    describe('executeTask()', () => {
        test('should execute a task', async () => {
            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: { script: 'build' }
            };

            const execution = await taskAPI.executeTask(task);

            expect(execution).toBeDefined();
            expect(execution.task).toBe(task);
            expect(execution.executionId).toBeDefined();
            expect(execution.terminate).toBeInstanceOf(Function);
            expect(mockTaskManager.executeTask).toHaveBeenCalled();
        });

        test('should throw if task has no name', async () => {
            const task = {
                type: 'npm',
                definition: {}
            };

            await expect(taskAPI.executeTask(task)).rejects.toThrow('Task must have a name');
        });

        test('should emit task-started event', async () => {
            const listener = vi.fn();
            taskAPI.on('task-started', listener);

            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: {}
            };

            await taskAPI.executeTask(task);

            expect(listener).toHaveBeenCalled();
            const eventData = listener.mock.calls[0][0];
            expect(eventData.task).toBe(task);
            expect(eventData.executionId).toBeDefined();
        });

        test('should handle task execution errors', async () => {
            const errorListener = vi.fn();
            taskAPI.on('task-error', errorListener);

            const error = new Error('Task failed');
            mockTaskManager.executeTask.mockRejectedValue(error);

            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: {}
            };

            await expect(taskAPI.executeTask(task)).rejects.toThrow('Task failed');
            expect(errorListener).toHaveBeenCalled();
        });

        test('execution.terminate() should terminate task', async () => {
            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: {}
            };

            const execution = await taskAPI.executeTask(task);
            const executionId = execution.executionId;

            execution.terminate();

            expect(taskAPI.runningTasks.has(executionId)).toBe(false);
            expect(mockTaskManager.terminateTask).toHaveBeenCalledWith(executionId);
        });

        test('should emit task-ended event on terminate', async () => {
            const listener = vi.fn();
            taskAPI.on('task-ended', listener);

            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: {}
            };

            const execution = await taskAPI.executeTask(task);
            execution.terminate();

            expect(listener).toHaveBeenCalled();
            const eventData = listener.mock.calls[0][0];
            expect(eventData.task).toBe(task);
            expect(eventData.executionId).toBe(execution.executionId);
        });
    });

    describe('getTasks()', () => {
        test('should get tasks from all providers', async () => {
            const provider1 = {
                provideTasks: vi.fn().mockResolvedValue([
                    { name: 'task1', type: 'npm', source: 'p1', definition: {} }
                ])
            };

            const provider2 = {
                provideTasks: vi.fn().mockResolvedValue([
                    { name: 'task2', type: 'shell', source: 'p2', definition: {} }
                ])
            };

            taskAPI.registerTaskProvider('npm', provider1);
            taskAPI.registerTaskProvider('shell', provider2);

            const tasks = await taskAPI.getTasks();

            expect(tasks).toHaveLength(2);
            expect(tasks[0].name).toBe('task1');
            expect(tasks[1].name).toBe('task2');
            expect(provider1.provideTasks).toHaveBeenCalled();
            expect(provider2.provideTasks).toHaveBeenCalled();
        });

        test('should handle provider errors gracefully', async () => {
            const errorListener = vi.fn();
            taskAPI.on('task-provider-error', errorListener);

            const provider1 = {
                provideTasks: vi.fn().mockRejectedValue(new Error('Provider failed'))
            };

            const provider2 = {
                provideTasks: vi.fn().mockResolvedValue([
                    { name: 'task2', type: 'shell', source: 'p2', definition: {} }
                ])
            };

            taskAPI.registerTaskProvider('npm', provider1);
            taskAPI.registerTaskProvider('shell', provider2);

            const tasks = await taskAPI.getTasks();

            expect(tasks).toHaveLength(1);
            expect(tasks[0].name).toBe('task2');
            expect(errorListener).toHaveBeenCalled();
        });
    });

    describe('onDidStartTask()', () => {
        test('should register event listener', async () => {
            const listener = vi.fn();
            taskAPI.onDidStartTask(listener);

            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: {}
            };

            await taskAPI.executeTask(task);

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('onDidEndTask()', () => {
        test('should register event listener', async () => {
            const listener = vi.fn();
            taskAPI.onDidEndTask(listener);

            const task = {
                name: 'build',
                type: 'npm',
                source: 'test-plugin',
                definition: {}
            };

            const execution = await taskAPI.executeTask(task);
            execution.terminate();

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('cleanupPlugin()', () => {
        test('should cleanup all providers for a plugin', () => {
            const provider1 = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            const provider2 = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            taskAPI.registerTaskProvider('npm', provider1);

            // Switch to different plugin
            taskAPI.currentPluginId = 'other-plugin';
            taskAPI.registerTaskProvider('shell', provider2);

            expect(taskAPI.taskProviders.size).toBe(2);

            taskAPI.cleanupPlugin('test-plugin');

            expect(taskAPI.taskProviders.size).toBe(1);
            expect(taskAPI.taskProviders.has('npm')).toBe(false);
            expect(taskAPI.taskProviders.has('shell')).toBe(true);
        });

        test('should emit task-provider-unregistered event', () => {
            const listener = vi.fn();
            taskAPI.on('task-provider-unregistered', listener);

            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            taskAPI.registerTaskProvider('npm', provider);
            taskAPI.cleanupPlugin('test-plugin');

            expect(listener).toHaveBeenCalledWith({ type: 'npm' });
        });
    });

    describe('provider wrapper', () => {
        test('should call provider.provideTasks()', async () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([
                    { name: 'task1', type: 'npm', source: 'test', definition: {} }
                ])
            };

            taskAPI.registerTaskProvider('npm', provider);
            const wrapper = taskAPI.taskProviders.get('npm');

            const tasks = await wrapper.provideTasks();

            expect(provider.provideTasks).toHaveBeenCalled();
            expect(tasks).toHaveLength(1);
        });

        test('should call provider.resolveTask() if available', async () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([]),
                resolveTask: vi.fn().mockResolvedValue({
                    name: 'resolved',
                    type: 'npm',
                    source: 'test',
                    definition: { resolved: true }
                })
            };

            taskAPI.registerTaskProvider('npm', provider);
            const wrapper = taskAPI.taskProviders.get('npm');

            const task = { name: 'task', type: 'npm', source: 'test', definition: {} };
            const resolved = await wrapper.resolveTask(task);

            expect(provider.resolveTask).toHaveBeenCalledWith(task);
            expect(resolved.definition.resolved).toBe(true);
        });

        test('should return task unchanged if no resolveTask', async () => {
            const provider = {
                provideTasks: vi.fn().mockResolvedValue([])
            };

            taskAPI.registerTaskProvider('npm', provider);
            const wrapper = taskAPI.taskProviders.get('npm');

            const task = { name: 'task', type: 'npm', source: 'test', definition: {} };
            const resolved = await wrapper.resolveTask(task);

            expect(resolved).toBe(task);
        });
    });
});
