/**
 * @fileoverview Configuration API types
 */

export interface ConfigurationAPI {
  get<T>(key: string, defaultValue?: T): T | undefined
  set(key: string, value: unknown, target?: ConfigurationTarget): Promise<void>
  update(key: string, value: unknown, target?: ConfigurationTarget): Promise<void>
  inspect<T>(key: string): ConfigurationInspect<T> | undefined
  getAll(): Record<string, unknown>
  has(key: string): boolean
  onDidChange(listener: (event: ConfigurationChangeEvent) => void): Disposable
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3
}

export interface ConfigurationInspect<T> {
  key: string
  defaultValue?: T
  globalValue?: T
  workspaceValue?: T
  workspaceFolderValue?: T
  defaultLanguageValue?: T
  globalLanguageValue?: T
  workspaceLanguageValue?: T
  workspaceFolderLanguageValue?: T
  languageIds?: string[]
}

export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string, scope?: ConfigurationScope): boolean
}

export interface ConfigurationScope {
  uri?: string
  languageId?: string
}

import type { Disposable } from './utilities.js'