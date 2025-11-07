/**
 * @fileoverview Tasks API types
 */

import type { Disposable } from '../utilities.js'

/**
 * Task API interface
 */
export interface TaskAPI {
  // TODO: Add task API methods
  registerTaskProvider(type: string, provider: TaskProvider): Disposable
  executeTask(task: Task): Promise<TaskExecution>
}

/**
 * Task provider interface
 */
export interface TaskProvider {
  provideTasks(): Promise<Task[]>
  resolveTask?(task: Task): Promise<Task | undefined>
}

/**
 * Task definition
 */
export interface Task {
  name: string
  type: string
  source: string
  execution?: TaskExecution
  definition: Record<string, unknown>
}

/**
 * Task execution
 */
export interface TaskExecution {
  task: Task
  terminate(): void
}
