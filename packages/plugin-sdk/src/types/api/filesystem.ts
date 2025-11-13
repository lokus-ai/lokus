/**
 * @fileoverview File System API types
 */

import type { Disposable } from '../utilities.js'

/**
 * File System API interface
 */
export interface FileSystemAPI {
  // TODO: Add file system API methods
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, content: Uint8Array): Promise<void>
  readdir(path: string): Promise<string[]>
  stat(path: string): Promise<FileStat>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  delete(path: string, options?: { recursive?: boolean }): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  copy(source: string, destination: string): Promise<void>
}

/**
 * File stat information
 */
export interface FileStat {
  type: FileType
  size: number
  ctime: number
  mtime: number
  permissions?: FilePermission
}

/**
 * File type
 */
export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}

/**
 * File permission flags
 */
export enum FilePermission {
  Readonly = 1
}
