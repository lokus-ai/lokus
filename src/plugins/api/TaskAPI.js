/**
 * Task API - Task management and task providers
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';

export class TaskAPI extends EventEmitter {
    constructor(taskManager) {
        super();
        this.taskManager = taskManager;
        this.taskProviders = new Map();
        this.runningTasks = new Map();
    }

    /**
     * Register a task provider
     */
    registerTaskProvider(type, provider) {
        if (this.taskProviders.has(type)) {
            throw new Error(`Task provider for type '${type}' already registered`);
        }

        const providerWrapper = {
            type,
            provider,
            pluginId: this.currentPluginId,
            provideTasks: async () => {
                if (provider.provideTasks) {
                    return await provider.provideTasks();
                }
                return [];
            },
            resolveTask: async (task) => {
                if (provider.resolveTask) {
                    return await provider.resolveTask(task);
                }
                return task;
            }
        };

        this.taskProviders.set(type, providerWrapper);

        if (this.taskManager) {
            this.taskManager.registerTaskProvider(type, providerWrapper);
        }

        this.emit('task-provider-registered', { type, pluginId: this.currentPluginId });

        return new Disposable(() => {
            this.taskProviders.delete(type);
            if (this.taskManager) {
                this.taskManager.unregisterTaskProvider(type);
            }
            this.emit('task-provider-unregistered', { type });
        });
    }

    /**
     * Execute a task
     */
    async executeTask(task) {
        if (!task || !task.name) {
            throw new Error('Task must have a name');
        }

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const execution = {
            task,
            executionId,
            terminate: () => {
                this.runningTasks.delete(executionId);
                if (this.taskManager) {
                    this.taskManager.terminateTask(executionId);
                }
                this.emit('task-ended', { task, executionId });
            }
        };

        this.runningTasks.set(executionId, execution);
        this.emit('task-started', { task, executionId });

        if (this.taskManager) {
            try {
                await this.taskManager.executeTask(task, execution);
            } catch (error) {
                this.runningTasks.delete(executionId);
                this.emit('task-error', { task, executionId, error });
                throw error;
            }
        }

        return execution;
    }

    /**
     * Get all tasks from all providers
     */
    async getTasks() {
        const allTasks = [];

        for (const [type, providerWrapper] of this.taskProviders) {
            try {
                const tasks = await providerWrapper.provideTasks();
                allTasks.push(...tasks);
            } catch (error) {
                this.emit('task-provider-error', { type, error });
            }
        }

        return allTasks;
    }

    /**
     * Listen for task start events
     */
    onDidStartTask(listener) {
        return this.on('task-started', listener);
    }

    /**
     * Listen for task end events
     */
    onDidEndTask(listener) {
        return this.on('task-ended', listener);
    }

    /**
     * Cleanup all task providers for a plugin
     */
    cleanupPlugin(pluginId) {
        for (const [type, providerWrapper] of this.taskProviders) {
            if (providerWrapper.pluginId === pluginId) {
                this.taskProviders.delete(type);
                if (this.taskManager) {
                    this.taskManager.unregisterTaskProvider(type);
                }
                this.emit('task-provider-unregistered', { type });
            }
        }
    }
}
