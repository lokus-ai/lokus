/**
 * @fileoverview Event system types
 */

import type { Disposable } from './utilities.js'
import type { WorkspaceFolder, TextEditor, TextDocument, Selection } from './models.js'

/**
 * Event emitter interface
 */
export interface EventEmitter<T = unknown> {
  /** The event */
  readonly event: Event<T>

  /** Fire the event */
  fire(data: T): void

  /** Dispose the emitter */
  dispose(): void
}

/**
 * Event interface
 */
export interface Event<T> {
  /**
   * Subscribe to the event
   */
  (listener: (e: T) => unknown, thisArgs?: unknown, disposables?: Disposable[]): Disposable
}

/**
 * Event listener function
 */
export type EventListener<T> = (event: T) => void | Promise<void>

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  /** Once only */
  once?: boolean

  /** Priority */
  priority?: number

  /** Context */
  context?: unknown

  /** Async handling */
  async?: boolean
}

/**
 * Plugin event types
 */
export enum PluginEventType {
  /** Configuration changed */
  CONFIG_CHANGED = 'config:changed',

  /** Workspace opened */
  WORKSPACE_OPENED = 'workspace:opened',

  /** Workspace closed */
  WORKSPACE_CLOSED = 'workspace:closed',

  /** File opened */
  FILE_OPENED = 'file:opened',

  /** File saved */
  FILE_SAVED = 'file:saved',

  /** Editor changed */
  EDITOR_CHANGED = 'editor:changed',

  /** Selection changed */
  SELECTION_CHANGED = 'selection:changed',

  /** Theme changed */
  THEME_CHANGED = 'theme:changed',

  /** Language changed */
  LANGUAGE_CHANGED = 'language:changed'
}

/**
 * Standard event data types
 */
export interface ConfigChangedEvent {
  section: string
  newValue: unknown
  oldValue: unknown
  affectsConfiguration: (section: string) => boolean
}

export interface WorkspaceEvent {
  workspaceFolders: WorkspaceFolder[]
}

export interface FileEvent {
  uri: string
  type: FileChangeType
}

export interface EditorEvent {
  editor?: TextEditor
  document?: TextDocument
}

export interface SelectionEvent {
  editor: TextEditor
  selections: Selection[]
}

export interface ThemeEvent {
  themeId: string
  themeType: 'light' | 'dark' | 'high-contrast'
}

// Forward declarations for types used above
export enum FileChangeType {
  Changed = 1,
  Created = 2,
  Deleted = 3
}