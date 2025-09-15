/**
 * @fileoverview Disposable store utility for resource management
 */

import type { Disposable } from '../types/index.js'

/**
 * Disposable store for managing multiple disposables
 */
export class DisposableStore implements Disposable {
  private disposables = new Set<Disposable>()
  private isDisposed = false

  /**
   * Add a disposable to the store
   */
  add(disposable: Disposable): void {
    if (this.isDisposed) {
      disposable.dispose()
      return
    }
    
    this.disposables.add(disposable)
  }

  /**
   * Remove a disposable from the store
   */
  remove(disposable: Disposable): void {
    this.disposables.delete(disposable)
  }

  /**
   * Get the number of disposables
   */
  get size(): number {
    return this.disposables.size
  }

  /**
   * Check if the store is empty
   */
  get isEmpty(): boolean {
    return this.disposables.size === 0
  }

  /**
   * Check if the store is disposed
   */
  get disposed(): boolean {
    return this.isDisposed
  }

  /**
   * Clear all disposables without disposing them
   */
  clear(): void {
    this.disposables.clear()
  }

  /**
   * Dispose all disposables
   */
  dispose(): void {
    if (this.isDisposed) {
      return
    }

    this.isDisposed = true
    
    for (const disposable of this.disposables) {
      try {
        disposable.dispose()
      } catch (error) {
        console.warn('Error disposing resource:', error)
      }
    }
    
    this.disposables.clear()
  }
}