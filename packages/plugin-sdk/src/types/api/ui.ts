/**
 * @fileoverview UI API types
 */

import type { Disposable } from '../utilities.js'
import type { ThemeIcon } from './commands.js'
import type { Command } from '../manifest.js'

/**
 * UI API interface
 */
export interface UIAPI {
  /**
   * Show notification to user
   */
  showNotification(message: string, type?: NotificationType, actions?: NotificationAction[]): Promise<string | undefined>
  
  /**
   * Show information message
   */
  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>
  
  /**
   * Show warning message
   */
  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>
  
  /**
   * Show error message
   */
  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>
  
  /**
   * Show dialog to user
   */
  showDialog(dialog: DialogOptions): Promise<DialogResult>
  
  /**
   * Show quick pick
   */
  showQuickPick<T extends QuickPickItem>(items: T[] | Promise<T[]>, options?: QuickPickOptions): Promise<T | undefined>
  
  /**
   * Show input box
   */
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>
  
  /**
   * Show open dialog
   */
  showOpenDialog(options?: OpenDialogOptions): Promise<string[] | undefined>
  
  /**
   * Show save dialog
   */
  showSaveDialog(options?: SaveDialogOptions): Promise<string | undefined>
  
  /**
   * Register custom panel
   */
  registerPanel(panel: PanelDefinition): Disposable
  
  /**
   * Register webview panel
   */
  registerWebviewPanel(panel: WebviewPanelDefinition): WebviewPanel
  
  /**
   * Register menu item
   */
  registerMenu(menu: MenuDefinition): Disposable
  
  /**
   * Register toolbar
   */
  registerToolbar(toolbar: ToolbarDefinition): Disposable
  
  /**
   * Register status bar item
   */
  registerStatusBarItem(statusItem: StatusBarItemDefinition): StatusBarItem
  
  /**
   * Register tree data provider
   */
  registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>): Disposable
  
  /**
   * Create terminal
   */
  createTerminal(options?: TerminalOptions): Terminal
  
  /**
   * Create output channel
   */
  createOutputChannel(name: string): OutputChannel
  
  /**
   * Show progress
   */
  withProgress<R>(options: ProgressOptions, task: (progress: Progress<ProgressReport>, token: CancellationToken) => Promise<R>): Promise<R>
}

/**
 * Notification types
 */
export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

/**
 * Notification action
 */
export interface NotificationAction {
  /** Action ID */
  id: string
  
  /** Action label */
  label: string
  
  /** Action icon */
  icon?: string | ThemeIcon
  
  /** Whether action is primary */
  primary?: boolean
}

/**
 * Dialog options
 */
export interface DialogOptions {
  /** Dialog title */
  title: string
  
  /** Dialog message */
  message: string
  
  /** Dialog type */
  type?: 'info' | 'warning' | 'error' | 'question'
  
  /** Dialog buttons */
  buttons?: DialogButton[]
  
  /** Default button index */
  defaultButton?: number
  
  /** Cancel button index */
  cancelButton?: number
  
  /** Modal dialog */
  modal?: boolean
  
  /** Detail message */
  detail?: string
  
  /** Checkbox text */
  checkboxLabel?: string
  
  /** Checkbox checked state */
  checkboxChecked?: boolean
}

/**
 * Dialog button
 */
export interface DialogButton {
  /** Button label */
  label: string
  
  /** Button ID */
  id: string
  
  /** Button icon */
  icon?: string | ThemeIcon
  
  /** Whether button is primary */
  primary?: boolean
}

/**
 * Dialog result
 */
export interface DialogResult {
  /** Selected button ID */
  buttonId?: string
  
  /** Checkbox state */
  checkboxChecked?: boolean
}

/**
 * Quick pick item
 */
export interface QuickPickItem {
  /** Item label */
  label: string
  
  /** Item description */
  description?: string
  
  /** Item detail */
  detail?: string
  
  /** Item icon */
  icon?: string | ThemeIcon
  
  /** Whether item is picked */
  picked?: boolean
  
  /** Always show */
  alwaysShow?: boolean
  
  /** Item buttons */
  buttons?: QuickInputButton[]
}

/**
 * Quick pick options
 */
export interface QuickPickOptions {
  /** Placeholder text */
  placeholder?: string
  
  /** Can pick many */
  canPickMany?: boolean
  
  /** Ignore focus out */
  ignoreFocusOut?: boolean
  
  /** Match on description */
  matchOnDescription?: boolean
  
  /** Match on detail */
  matchOnDetail?: boolean
  
  /** Active item */
  activeItem?: QuickPickItem
  
  /** Title */
  title?: string
  
  /** Step */
  step?: number
  
  /** Total steps */
  totalSteps?: number
}

/**
 * Input box options
 */
export interface InputBoxOptions {
  /** Placeholder text */
  placeholder?: string
  
  /** Prompt text */
  prompt?: string
  
  /** Default value */
  value?: string
  
  /** Value selection */
  valueSelection?: [number, number]
  
  /** Password input */
  password?: boolean
  
  /** Ignore focus out */
  ignoreFocusOut?: boolean
  
  /** Validation */
  validateInput?: (value: string) => string | undefined | null | Promise<string | undefined | null>
  
  /** Title */
  title?: string
  
  /** Step */
  step?: number
  
  /** Total steps */
  totalSteps?: number
}

/**
 * Open dialog options
 */
export interface OpenDialogOptions {
  /** Default URI */
  defaultUri?: string
  
  /** Open label */
  openLabel?: string
  
  /** Can select files */
  canSelectFiles?: boolean
  
  /** Can select folders */
  canSelectFolders?: boolean
  
  /** Can select many */
  canSelectMany?: boolean
  
  /** File filters */
  filters?: { [name: string]: string[] }
  
  /** Title */
  title?: string
}

/**
 * Save dialog options
 */
export interface SaveDialogOptions {
  /** Default URI */
  defaultUri?: string
  
  /** Save label */
  saveLabel?: string
  
  /** File filters */
  filters?: { [name: string]: string[] }
  
  /** Title */
  title?: string
}

/**
 * Panel definition
 */
export interface PanelDefinition {
  /** Panel ID */
  id: string
  
  /** Panel title */
  title: string
  
  /** Panel type */
  type: 'webview' | 'tree' | 'custom'
  
  /** Panel location */
  location: 'sidebar' | 'panel' | 'editor'
  
  /** Panel icon */
  icon?: string | ThemeIcon
  
  /** When clause */
  when?: string
  
  /** Initial state */
  initialState?: any
  
  /** Can toggle visibility */
  canToggleVisibility?: boolean
  
  /** Retain context when hidden */
  retainContextWhenHidden?: boolean
}

/**
 * Webview panel definition
 */
export interface WebviewPanelDefinition extends PanelDefinition {
  /** HTML content */
  html?: string
  
  /** Webview options */
  options?: WebviewOptions
}

/**
 * Webview options
 */
export interface WebviewOptions {
  /** Enable scripts */
  enableScripts?: boolean
  
  /** Enable command URIs */
  enableCommandUris?: boolean
  
  /** Local resource roots */
  localResourceRoots?: string[]
  
  /** Port mapping */
  portMapping?: Array<{ webviewPort: number; extensionHostPort: number }>
}

/**
 * Webview panel
 */
export interface WebviewPanel extends Disposable {
  /** Panel ID */
  readonly viewType: string
  
  /** Panel title */
  title: string
  
  /** Panel icon */
  iconPath?: string | ThemeIcon
  
  /** Webview */
  readonly webview: Webview
  
  /** Options */
  readonly options: WebviewPanelOptions
  
  /** Active state */
  readonly active: boolean
  
  /** Visible state */
  readonly visible: boolean
  
  /** View column */
  readonly viewColumn?: ViewColumn
  
  /** Reveal panel */
  reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void
  
  /** On did dispose */
  onDidDispose: Event<void>
  
  /** On did change view state */
  onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>
}

// Additional types continue here...
export interface Webview {
  html: string
  options: WebviewOptions
  onDidReceiveMessage: Event<any>
  postMessage(message: any): Promise<boolean>
  asWebviewUri(localResource: string): string
  cspSource: string
}

export interface WebviewPanelOptions {
  enableFindWidget?: boolean
  retainContextWhenHidden?: boolean
}

export interface WebviewPanelOnDidChangeViewStateEvent {
  readonly webviewPanel: WebviewPanel
}

export interface ViewColumn {
  // Reference to existing definition
}

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable
}

export interface CancellationToken {
  isCancellationRequested: boolean
  onCancellationRequested: Event<any>
}

export interface QuickInputButton {
  iconPath: string | ThemeIcon
  tooltip?: string
}

export interface MenuDefinition {
  id: string
  label: string
  group?: string
  order?: number
  when?: string
  submenu?: string
  command?: string
  icon?: string | ThemeIcon
}

export interface ToolbarDefinition {
  id: string
  title: string
  location: 'editor' | 'sidebar' | 'panel'
  group?: string
  order?: number
  items: ToolbarItem[]
  when?: string
}

export interface ToolbarItem {
  id: string
  command?: string
  icon?: string | ThemeIcon
  title?: string
  tooltip?: string
  when?: string
}

export interface StatusBarItemDefinition {
  id: string
  text: string
  tooltip?: string
  command?: string | Command
  alignment?: StatusBarAlignment
  priority?: number
  color?: string | ThemeColor
  backgroundColor?: string | ThemeColor
  when?: string
}

export interface StatusBarItem extends Disposable {
  alignment: StatusBarAlignment
  priority?: number
  text: string
  tooltip?: string
  color?: string | ThemeColor
  backgroundColor?: string | ThemeColor
  command?: string | Command
  accessibilityInformation?: AccessibilityInformation
  show(): void
  hide(): void
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2
}

export interface ThemeColor {
  id: string
}

export interface AccessibilityInformation {
  label: string
  role?: string
}

export interface TreeDataProvider<T> {
  onDidChangeTreeData?: Event<T | undefined | null | void>
  getTreeItem(element: T): TreeItem | Promise<TreeItem>
  getChildren(element?: T): T[] | Promise<T[]>
  getParent?(element: T): T | undefined | Promise<T | undefined>
  resolveTreeItem?(item: TreeItem, element: T, token: CancellationToken): TreeItem | Promise<TreeItem>
}

export interface TreeItem {
  label?: string | TreeItemLabel
  id?: string
  iconPath?: string | ThemeIcon
  description?: string | boolean
  resourceUri?: string
  tooltip?: string | MarkdownString
  command?: Command
  collapsibleState?: TreeItemCollapsibleState
  contextValue?: string
  accessibilityInformation?: AccessibilityInformation
}

export interface TreeItemLabel {
  label: string
  highlights?: [number, number][]
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export interface MarkdownString {
  value: string
  isTrusted?: boolean
  supportThemeIcons?: boolean
}

export interface TerminalOptions {
  name?: string
  shellPath?: string
  shellArgs?: string[] | string
  cwd?: string
  env?: { [key: string]: string | null }
  strictEnv?: boolean
  hideFromUser?: boolean
  message?: string
  iconPath?: string | ThemeIcon
  color?: ThemeColor
  location?: TerminalLocation
  isTransient?: boolean
}

export interface Terminal {
  name: string
  processId: Promise<number | undefined>
  creationOptions: Readonly<TerminalOptions>
  exitStatus: TerminalExitStatus | undefined
  state: TerminalState
  sendText(text: string, shouldExecute?: boolean): void
  show(preserveFocus?: boolean): void
  hide(): void
  dispose(): void
}

export interface TerminalExitStatus {
  code: number | undefined
  reason: TerminalExitReason
}

export enum TerminalExitReason {
  Unknown = 0,
  Shutdown = 1,
  Process = 2,
  User = 3,
  Extension = 4
}

export interface TerminalState {
  isInteractedWith: boolean
}

export interface TerminalLocation {
  // Simplified
}

export interface OutputChannel extends Disposable {
  name: string
  append(value: string): void
  appendLine(value: string): void
  replace(value: string): void
  clear(): void
  show(preserveFocus?: boolean): void
  hide(): void
}

export interface ProgressOptions {
  location: ProgressLocation
  title?: string
  cancellable?: boolean
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15
}

export interface Progress<T> {
  report(value: T): void
}

export interface ProgressReport {
  message?: string
  increment?: number
}