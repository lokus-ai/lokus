/**
 * @fileoverview Storage API types
 */

/**
 * Storage API interface
 */
export interface StorageAPI {
  // TODO: Add storage API methods
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  clear(): Promise<void>
}
