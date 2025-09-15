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

/**
 * Theme icon reference
 */
export interface ThemeIcon {
  /** Icon ID */
  id: string
  
  /** Icon color */
  color?: string
  
  /** Light theme icon */
  light?: string
  
  /** Dark theme icon */
  dark?: string
}

/**
 * Text editor interface
 */
export interface TextEditor {
  /** Document being edited */
  document: TextDocument
  
  /** Current selection */
  selection: Selection
  
  /** All selections */
  selections: Selection[]
  
  /** Visible ranges */
  visibleRanges: Range[]
  
  /** Editor options */
  options: TextEditorOptions
  
  /** View column */
  viewColumn?: ViewColumn
  
  /** Edit document */
  edit(callback: (editBuilder: TextEditorEdit) => void, options?: TextEditorEditOptions): Promise<boolean>
  
  /** Insert snippet */
  insertSnippet(snippet: SnippetString, location?: Position | Range | Position[] | Range[], options?: TextEditorInsertOptions): Promise<boolean>
  
  /** Set decorations */
  setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: Range[] | DecorationOptions[]): void
  
  /** Reveal range */
  revealRange(range: Range, revealType?: TextEditorRevealType): void
  
  /** Show */
  show(column?: ViewColumn): void
  
  /** Hide */
  hide(): void
}

/**
 * Text editor edit interface
 */
export interface TextEditorEdit {
  /** Replace text */
  replace(location: Position | Range | Selection, value: string): void
  
  /** Insert text */
  insert(location: Position, value: string): void
  
  /** Delete text */
  delete(location: Range | Selection): void
  
  /** Set end of line */
  setEndOfLine(endOfLine: EndOfLine): void
}

/**
 * Text document interface
 */
export interface TextDocument {
  /** Document URI */
  uri: string
  
  /** File name */
  fileName: string
  
  /** Language ID */
  languageId: string
  
  /** Document version */
  version: number
  
  /** Whether document is dirty */
  isDirty: boolean
  
  /** Whether document is closed */
  isClosed: boolean
  
  /** Document text */
  getText(range?: Range): string
  
  /** Get position at offset */
  positionAt(offset: number): Position
  
  /** Get offset at position */
  offsetAt(position: Position): number
  
  /** Line count */
  lineCount: number
  
  /** Get line */
  lineAt(line: number | Position): TextLine
  
  /** Save document */
  save(): Promise<boolean>
  
  /** Validate range */
  validateRange(range: Range): Range
  
  /** Validate position */
  validatePosition(position: Position): Position
  
  /** Get word range at position */
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined
}

/**
 * Additional interfaces (Position, Range, Selection, etc.) would be defined here
 * For brevity, I'm including just the essential ones for the command API
 */

export interface Position {
  line: number
  character: number
}

export interface Range {
  start: Position
  end: Position
}

export interface Selection extends Range {
  anchor: Position
  active: Position
}

export interface TextLine {
  lineNumber: number
  text: string
  range: Range
  rangeIncludingLineBreak: Range
  firstNonWhitespaceCharacterIndex: number
  isEmptyOrWhitespace: boolean
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2
}

export interface TextEditorOptions {
  tabSize?: number
  insertSpaces?: boolean
  cursorStyle?: TextEditorCursorStyle
  lineNumbers?: TextEditorLineNumbersStyle
}

export enum TextEditorCursorStyle {
  Line = 1,
  Block = 2,
  Underline = 3,
  LineThin = 4,
  BlockOutline = 5,
  UnderlineThin = 6
}

export enum TextEditorLineNumbersStyle {
  Off = 0,
  On = 1,
  Relative = 2
}

export interface TextEditorEditOptions {
  undoStopBefore?: boolean
  undoStopAfter?: boolean
}

export interface SnippetString {
  value: string
  appendText(string: string): SnippetString
  appendTabstop(number?: number): SnippetString
  appendPlaceholder(value: string | ((snippet: SnippetString) => any), number?: number): SnippetString
  appendChoice(values: string[], number?: number): SnippetString
  appendVariable(name: string, defaultValue: string | ((snippet: SnippetString) => any)): SnippetString
}

export interface TextEditorInsertOptions {
  undoStopBefore?: boolean
  undoStopAfter?: boolean
}

export interface TextEditorDecorationType {
  key: string
  dispose(): void
}

export interface DecorationOptions {
  range: Range
  hoverMessage?: string | MarkdownString | Array<string | MarkdownString>
  renderOptions?: DecorationInstanceRenderOptions
}

export interface DecorationInstanceRenderOptions {
  before?: ThemableDecorationAttachmentRenderOptions
  after?: ThemableDecorationAttachmentRenderOptions
}

export interface ThemableDecorationAttachmentRenderOptions {
  contentText?: string
  contentIconPath?: string
  border?: string
  borderColor?: string | ThemeColor
  fontStyle?: string
  fontWeight?: string
  textDecoration?: string
  color?: string | ThemeColor
  backgroundColor?: string | ThemeColor
  margin?: string
  width?: string
  height?: string
}

export interface ThemeColor {
  id: string
}

export interface MarkdownString {
  value: string
  isTrusted?: boolean
  supportThemeIcons?: boolean
  supportHtml?: boolean
  baseUri?: string
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3
}