/**
 * @fileoverview Commands API types
 */

import type { Disposable } from '../utilities.js'
import type { APIRequestOptions } from './index.js'

/**
 * Commands API interface
 */
export interface CommandAPI {
  /**
   * Register a command
   */
  register(command: CommandDefinition): Disposable

  /**
   * Execute a command
   */
  execute<T = unknown>(commandId: string, ...args: unknown[]): Promise<T>

  /**
   * Get all available commands
   */
  getAll(): Promise<CommandInfo[]>

  /**
   * Get commands by category
   */
  getByCategory(category: string): Promise<CommandInfo[]>

  /**
   * Check if command exists
   */
  exists(commandId: string): Promise<boolean>

  /**
   * Register command with palette
   */
  registerWithPalette(command: CommandDefinition & CommandPaletteOptions): Disposable

  /**
   * Register text editor command
   */
  registerTextEditorCommand(command: TextEditorCommandDefinition): Disposable
}

/**
 * Command definition
 */
export interface CommandDefinition {
  /** Unique command identifier */
  id: string

  /** Command title */
  title: string

  /** Command handler function */
  handler: CommandHandler

  /** Command category */
  category?: string

  /** Command description */
  description?: string

  /** Command icon */
  icon?: string | ThemeIcon

  /** Short title for compact display */
  shortTitle?: string

  /** Tooltip text */
  tooltip?: string

  /** When clause for conditional availability */
  when?: string

  /** Enablement clause */
  enablement?: string

  /** Arguments schema */
  arguments?: ArgumentSchema[]

  /** Return type schema */
  returns?: TypeSchema

  /** Whether command is internal */
  internal?: boolean

  /** Command metadata */
  metadata?: Record<string, unknown>
}

/**
 * Text editor command definition
 */
export interface TextEditorCommandDefinition extends Omit<CommandDefinition, 'handler'> {
  /** Text editor command handler */
  handler: TextEditorCommandHandler
}

/**
 * Command handler function
 */
export type CommandHandler = (...args: unknown[]) => unknown | Promise<unknown>

/**
 * Text editor command handler function
 */
export type TextEditorCommandHandler = (
  textEditor: TextEditor,
  edit: TextEditorEdit,
  ...args: unknown[]
) => unknown | Promise<unknown>

/**
 * Command palette options
 */
export interface CommandPaletteOptions {
  /** Whether to show in command palette */
  showInPalette?: boolean

  /** Command palette group */
  paletteGroup?: string

  /** Command palette order */
  paletteOrder?: number

  /** Command palette icon */
  paletteIcon?: string | ThemeIcon

  /** Command palette when clause */
  paletteWhen?: string
}

/**
 * Command information
 */
export interface CommandInfo {
  /** Command ID */
  id: string

  /** Command title */
  title: string

  /** Command category */
  category?: string

  /** Command description */
  description?: string

  /** Command icon */
  icon?: string | ThemeIcon

  /** Plugin that registered the command */
  pluginId: string

  /** Whether command is available */
  available: boolean

  /** Command arguments */
  arguments?: ArgumentSchema[]

  /** Return type */
  returns?: TypeSchema

  /** Usage statistics */
  usage?: CommandUsageStats
}

/**
 * Command usage statistics
 */
export interface CommandUsageStats {
  /** Total executions */
  totalExecutions: number

  /** Recent executions (last 30 days) */
  recentExecutions: number

  /** Last execution time */
  lastExecuted?: Date

  /** Average execution time */
  averageExecutionTime: number

  /** Success rate */
  successRate: number
}

/**
 * Argument schema
 */
export interface ArgumentSchema {
  /** Argument name */
  name: string

  /** Argument type */
  type: TypeSchema

  /** Argument description */
  description?: string

  /** Whether argument is optional */
  optional?: boolean

  /** Default value */
  default?: unknown

  /** Validation rules */
  validation?: ValidationRule[]
}

/**
 * Type schema
 */
export interface TypeSchema {
  /** Primary type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined' | 'any'

  /** Union types */
  union?: TypeSchema[]

  /** Array item type */
  items?: TypeSchema

  /** Object properties */
  properties?: Record<string, TypeSchema>

  /** Additional properties allowed */
  additionalProperties?: boolean

  /** Enum values */
  enum?: unknown[]

  /** Pattern for strings */
  pattern?: string

  /** Minimum value/length */
  minimum?: number

  /** Maximum value/length */
  maximum?: number

  /** Required properties */
  required?: string[]

  /** Type description */
  description?: string
}

/**
 * Validation rule
 */
export interface ValidationRule {
  /** Rule type */
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom'

  /** Rule value */
  value?: unknown

  /** Error message */
  message: string

  /** Custom validator */
  validator?: (value: unknown) => boolean | string
}

import type {
  Position,
  Range,
  Selection,
  TextDocument,
  TextEditor,
  TextEditorEdit,
  ViewColumn,
  EndOfLine,
  TextEditorOptions,
  TextEditorCursorStyle,
  TextEditorLineNumbersStyle,
  TextEditorEditOptions,
  SnippetString,
  TextEditorInsertOptions,
  TextEditorDecorationType,
  DecorationOptions,
  DecorationInstanceRenderOptions,
  ThemableDecorationAttachmentRenderOptions,
  ThemeColor,
  MarkdownString,
  TextEditorRevealType,
  ThemeIcon
} from '../models.js'
