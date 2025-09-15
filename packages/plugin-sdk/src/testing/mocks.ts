/**
 * @fileoverview Mock implementations for testing
 */

import type {
  LokusAPI,
  PluginContext,
  CommandAPI,
  EditorAPI,
  UIAPI,
  WorkspaceAPI,
  FileSystemAPI,
  NetworkAPI,
  StorageAPI,
  EventAPI,
  TaskAPI,
  DebugAPI,
  LanguageAPI,
  ThemeAPI,
  ConfigurationAPI,
  TerminalAPI,
  PluginManifest,
  Permission,
  Disposable
} from '../types/index.js'

/**
 * Mock Lokus API for testing
 */
export class MockLokusAPI implements LokusAPI {
  public readonly commands: MockCommandAPI
  public readonly editor: MockEditorAPI
  public readonly ui: MockUIAPI
  public readonly workspace: MockWorkspaceAPI
  public readonly fs: MockFileSystemAPI
  public readonly network: MockNetworkAPI
  public readonly storage: MockStorageAPI
  public readonly events: MockEventAPI
  public readonly tasks: MockTaskAPI
  public readonly debug: MockDebugAPI
  public readonly languages: MockLanguageAPI
  public readonly themes: MockThemeAPI
  public readonly config: MockConfigurationAPI
  public readonly terminal: MockTerminalAPI

  public readonly pluginId: string
  public readonly manifest: PluginManifest
  private permissions = new Set<Permission>()
  private disposables: Disposable[] = []

  constructor(pluginId: string, manifest: PluginManifest, permissions: Permission[] = []) {
    this.pluginId = pluginId
    this.manifest = manifest
    this.permissions = new Set(permissions)

    // Initialize mock APIs
    this.commands = new MockCommandAPI()
    this.editor = new MockEditorAPI()
    this.ui = new MockUIAPI()
    this.workspace = new MockWorkspaceAPI()
    this.fs = new MockFileSystemAPI()
    this.network = new MockNetworkAPI()
    this.storage = new MockStorageAPI()
    this.events = new MockEventAPI()
    this.tasks = new MockTaskAPI()
    this.debug = new MockDebugAPI()
    this.languages = new MockLanguageAPI()
    this.themes = new MockThemeAPI()
    this.config = new MockConfigurationAPI()
    this.terminal = new MockTerminalAPI()
  }

  hasPermission(permission: Permission): boolean {
    return this.permissions.has(permission)
  }

  addDisposable(disposable: Disposable): void {
    this.disposables.push(disposable)
  }

  getContext(): any {
    return {
      pluginId: this.pluginId,
      version: this.manifest.version,
      isActive: true,
      permissions: Array.from(this.permissions),
      storagePath: '/mock/storage',
      assetPath: '/mock/assets',
      isDevelopment: true
    }
  }

  log(level: any, message: string, ...args: unknown[]): void {
    console.log(`[${this.pluginId}] ${message}`, ...args)
  }

  // Test utilities
  grantPermission(permission: Permission): void {
    this.permissions.add(permission)
  }

  revokePermission(permission: Permission): void {
    this.permissions.delete(permission)
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
    this.disposables.length = 0
  }
}

/**
 * Mock Command API
 */
export class MockCommandAPI implements CommandAPI {
  private commands = new Map<string, any>()
  private executions: Array<{ commandId: string; args: unknown[] }> = []

  async register(command: any): Promise<Disposable> {
    this.commands.set(command.id, command)
    return {
      dispose: () => this.commands.delete(command.id)
    }
  }

  async execute<T = unknown>(commandId: string, ...args: unknown[]): Promise<T> {
    this.executions.push({ commandId, args })
    const command = this.commands.get(commandId)
    if (command?.handler) {
      return command.handler(...args)
    }
    throw new Error(`Command not found: ${commandId}`)
  }

  async getAll(): Promise<any[]> {
    return Array.from(this.commands.values())
  }

  async getByCategory(category: string): Promise<any[]> {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category)
  }

  async exists(commandId: string): Promise<boolean> {
    return this.commands.has(commandId)
  }

  registerWithPalette(command: any): Disposable {
    return this.register(command) as any
  }

  registerTextEditorCommand(command: any): Disposable {
    return this.register(command) as any
  }

  // Test utilities
  getExecutions(): Array<{ commandId: string; args: unknown[] }> {
    return [...this.executions]
  }

  clearExecutions(): void {
    this.executions.length = 0
  }
}

/**
 * Mock UI API
 */
export class MockUIAPI implements UIAPI {
  private notifications: Array<{ message: string; type: string }> = []
  private dialogs: Array<{ dialog: any; result?: any }> = []

  async showNotification(message: string, type: any = 'info', actions: any[] = []): Promise<string | undefined> {
    this.notifications.push({ message, type })
    return actions[0]?.id
  }

  async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return this.showNotification(message, 'info')
  }

  async showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return this.showNotification(message, 'warning')
  }

  async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return this.showNotification(message, 'error')
  }

  async showDialog(dialog: any): Promise<any> {
    const result = { buttonId: dialog.buttons?.[0]?.id }
    this.dialogs.push({ dialog, result })
    return result
  }

  async showQuickPick<T extends any>(items: T[] | Promise<T[]>, options?: any): Promise<T | undefined> {
    const resolvedItems = await Promise.resolve(items)
    return resolvedItems[0]
  }

  async showInputBox(options?: any): Promise<string | undefined> {
    return options?.value || 'mock-input'
  }

  async showOpenDialog(options?: any): Promise<string[] | undefined> {
    return ['/mock/file.txt']
  }

  async showSaveDialog(options?: any): Promise<string | undefined> {
    return '/mock/save.txt'
  }

  registerPanel(panel: any): Disposable {
    return { dispose: () => {} }
  }

  registerWebviewPanel(panel: any): any {
    return {
      viewType: panel.id,
      title: panel.title,
      webview: {
        html: panel.html || '',
        options: panel.options || {},
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: async () => true,
        asWebviewUri: (uri: string) => uri,
        cspSource: 'mock'
      },
      options: {},
      active: true,
      visible: true,
      reveal: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeViewState: () => ({ dispose: () => {} }),
      dispose: () => {}
    }
  }

  registerMenu(menu: any): Disposable {
    return { dispose: () => {} }
  }

  registerToolbar(toolbar: any): Disposable {
    return { dispose: () => {} }
  }

  registerStatusBarItem(statusItem: any): any {
    return {
      alignment: statusItem.alignment,
      priority: statusItem.priority,
      text: statusItem.text,
      tooltip: statusItem.tooltip,
      command: statusItem.command,
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }
  }

  registerTreeDataProvider<T>(viewId: string, treeDataProvider: any): Disposable {
    return { dispose: () => {} }
  }

  createTerminal(options?: any): any {
    return {
      name: options?.name || 'mock-terminal',
      processId: Promise.resolve(1234),
      creationOptions: options || {},
      exitStatus: undefined,
      state: { isInteractedWith: false },
      sendText: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }
  }

  createOutputChannel(name: string): any {
    return {
      name,
      append: () => {},
      appendLine: () => {},
      replace: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }
  }

  async withProgress<R>(options: any, task: any): Promise<R> {
    const progress = { report: () => {} }
    const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) }
    return task(progress, token)
  }

  // Test utilities
  getNotifications(): Array<{ message: string; type: string }> {
    return [...this.notifications]
  }

  getDialogs(): Array<{ dialog: any; result?: any }> {
    return [...this.dialogs]
  }

  clearNotifications(): void {
    this.notifications.length = 0
  }

  clearDialogs(): void {
    this.dialogs.length = 0
  }
}

/**
 * Mock Editor API
 */
export class MockEditorAPI implements EditorAPI {
  private activeEditor?: any
  private documents: any[] = []

  async getActiveEditor(): Promise<any> {
    return this.activeEditor
  }

  async getVisibleEditors(): Promise<any[]> {
    return this.activeEditor ? [this.activeEditor] : []
  }

  async getActiveDocument(): Promise<any> {
    return this.activeEditor?.document
  }

  async getOpenDocuments(): Promise<any[]> {
    return [...this.documents]
  }

  async openDocument(uri: string, options?: any): Promise<any> {
    const document = {
      uri,
      fileName: uri.split('/').pop(),
      languageId: 'plaintext',
      version: 1,
      isDirty: false,
      isClosed: false,
      getText: () => 'mock content',
      positionAt: () => ({ line: 0, character: 0 }),
      offsetAt: () => 0,
      lineCount: 1,
      lineAt: () => ({ lineNumber: 0, text: 'mock line', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } } }),
      save: async () => true,
      validateRange: (range: any) => range,
      validatePosition: (position: any) => position,
      getWordRangeAtPosition: () => undefined
    }
    this.documents.push(document)
    return document
  }

  async showDocument(document: any, options?: any): Promise<any> {
    const editor = {
      document,
      selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      selections: [],
      visibleRanges: [],
      options: {},
      viewColumn: 1,
      edit: async () => true,
      insertSnippet: async () => true,
      setDecorations: () => {},
      revealRange: () => {},
      show: () => {},
      hide: () => {}
    }
    this.activeEditor = editor
    return editor
  }

  async createUntitledDocument(options?: any): Promise<any> {
    return this.openDocument('untitled:Untitled-1', options)
  }

  async getContent(): Promise<string> {
    return this.activeEditor?.document?.getText() || ''
  }

  async setContent(content: string): Promise<void> {
    // Mock implementation
  }

  async insertContent(content: string): Promise<void> {
    // Mock implementation
  }

  async getSelection(): Promise<any> {
    return this.activeEditor?.selection
  }

  async setSelection(selection: any): Promise<void> {
    if (this.activeEditor) {
      this.activeEditor.selection = selection
    }
  }

  async getSelections(): Promise<any[]> {
    return this.activeEditor?.selections || []
  }

  async setSelections(selections: any[]): Promise<void> {
    if (this.activeEditor) {
      this.activeEditor.selections = selections
    }
  }

  async replaceText(range: any, text: string): Promise<void> {
    // Mock implementation
  }

  async getTextInRange(range: any): Promise<string> {
    return 'mock text'
  }

  registerCompletionProvider(selector: any, provider: any, ...triggerCharacters: string[]): Disposable {
    return { dispose: () => {} }
  }

  registerHoverProvider(selector: any, provider: any): Disposable {
    return { dispose: () => {} }
  }

  registerDefinitionProvider(selector: any, provider: any): Disposable {
    return { dispose: () => {} }
  }

  registerCodeActionProvider(selector: any, provider: any, metadata?: any): Disposable {
    return { dispose: () => {} }
  }

  registerFormatter(selector: any, provider: any): Disposable {
    return { dispose: () => {} }
  }

  registerRangeFormatter(selector: any, provider: any): Disposable {
    return { dispose: () => {} }
  }

  registerSemanticTokensProvider(selector: any, provider: any, legend: any): Disposable {
    return { dispose: () => {} }
  }

  registerFoldingRangeProvider(selector: any, provider: any): Disposable {
    return { dispose: () => {} }
  }

  registerDocumentLinkProvider(selector: any, provider: any): Disposable {
    return { dispose: () => {} }
  }

  onDidChangeActiveTextEditor(listener: any): Disposable {
    return { dispose: () => {} }
  }

  onDidChangeTextDocument(listener: any): Disposable {
    return { dispose: () => {} }
  }

  onDidChangeTextEditorSelection(listener: any): Disposable {
    return { dispose: () => {} }
  }

  onDidChangeTextEditorVisibleRanges(listener: any): Disposable {
    return { dispose: () => {} }
  }

  // Test utilities
  setActiveEditor(editor: any): void {
    this.activeEditor = editor
  }

  addDocument(document: any): void {
    this.documents.push(document)
  }
}

// Placeholder implementations for other APIs
export class MockWorkspaceAPI implements WorkspaceAPI {
  workspaceFolders = [{ uri: '/mock/workspace', name: 'Mock Workspace', index: 0 }]
  name = 'Mock Workspace'
  workspaceFile = '/mock/workspace/workspace.json'

  getWorkspaceFolder(uri: string) { return this.workspaceFolders[0] }
  asRelativePath(pathOrUri: string, includeWorkspaceFolder?: boolean) { return pathOrUri }
  async findFiles(include: string, exclude?: string, maxResults?: number, token?: any) { return ['/mock/file.txt'] }
  async saveAll(includeUntitled?: boolean) { return true }
  async applyEdit(edit: any) { return true }
  async openTextDocument(uriOrOptions: any) { return {} as any }
  onDidChangeWorkspaceFolders(listener: any) { return { dispose: () => {} } }
  onDidOpenTextDocument(listener: any) { return { dispose: () => {} } }
  onDidCloseTextDocument(listener: any) { return { dispose: () => {} } }
  onDidSaveTextDocument(listener: any) { return { dispose: () => {} } }
  onDidChangeTextDocument(listener: any) { return { dispose: () => {} } }
}

export class MockFileSystemAPI implements FileSystemAPI { 
  async readFile(path: string) { return 'mock content' }
  async writeFile(path: string, content: string) {}
  async exists(path: string) { return true }
  registerProvider(provider: any) { return { dispose: () => {} } }
}

export class MockNetworkAPI implements NetworkAPI {
  async fetch(url: string, options?: any) { return { ok: true, json: async () => ({}) } as any }
}

export class MockStorageAPI implements StorageAPI {
  private storage = new Map<string, unknown>()
  
  async get<T>(key: string, defaultValue?: T) { return this.storage.get(key) as T ?? defaultValue }
  async set(key: string, value: unknown) { this.storage.set(key, value) }
  async remove(key: string) { this.storage.delete(key) }
  async keys() { return Array.from(this.storage.keys()) }
  async clear() { this.storage.clear() }
}

export class MockEventAPI implements EventAPI {
  private listeners = new Map<string, Function[]>()
  
  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)!.push(handler)
    return { dispose: () => this.off(event, handler) }
  }
  
  off(event: string, handler: Function) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index >= 0) handlers.splice(index, 1)
    }
  }
  
  emit(event: string, data?: any) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }
}

export class MockTaskAPI implements TaskAPI {
  registerProvider(taskProvider: any) { return { dispose: () => {} } }
  async execute(task: any) { return {} }
}

export class MockDebugAPI implements DebugAPI {
  registerAdapter(debugAdapter: any) { return { dispose: () => {} } }
}

export class MockLanguageAPI implements LanguageAPI {
  register(language: any) { return { dispose: () => {} } }
  get(languageId: string) { return null }
  getByExtension(extension: string) { return null }
}

export class MockThemeAPI implements ThemeAPI {
  register(theme: any) { return { dispose: () => {} } }
  getAll() { return [] }
}

export class MockConfigurationAPI implements ConfigurationAPI {
  private config = new Map<string, unknown>()
  
  get<T>(key: string, defaultValue?: T) { return this.config.get(key) as T ?? defaultValue }
  async set(key: string, value: unknown) { this.config.set(key, value) }
  async update(key: string, value: unknown) { await this.set(key, value) }
  inspect<T>(key: string) { return undefined }
  getAll() { return Object.fromEntries(this.config) }
  has(key: string) { return this.config.has(key) }
  onDidChange(listener: any) { return { dispose: () => {} } }
}

export class MockTerminalAPI implements TerminalAPI {
  async create(options?: any) { return {} as any }
  async getAll() { return [] }
  async getActive() { return undefined }
  onDidOpenTerminal(listener: any) { return { dispose: () => {} } }
  onDidCloseTerminal(listener: any) { return { dispose: () => {} } }
}

/**
 * Mock plugin context
 */
export function createMockContext(
  pluginId: string,
  manifest: PluginManifest,
  permissions: Permission[] = []
): PluginContext {
  return {
    pluginId,
    manifest,
    api: new MockLokusAPI(pluginId, manifest, permissions),
    storageUri: '/mock/storage',
    globalStorageUri: '/mock/global-storage',
    assetUri: '/mock/assets',
    logPath: '/mock/logs',
    extensionMode: 2, // Development
    environment: {
      lokusVersion: '1.0.0',
      nodeVersion: '18.0.0',
      platform: 'darwin',
      arch: 'x64',
      appName: 'Lokus',
      appVersion: '1.0.0',
      appRoot: '/mock/app',
      userDataDir: '/mock/userdata',
      tmpDir: '/mock/tmp',
      isDevelopment: true,
      isTesting: true,
      sessionId: 'mock-session',
      machineId: 'mock-machine',
      language: 'en',
      uiScale: 1,
      highContrast: false,
      accessibility: {
        screenReader: false,
        reducedMotion: false,
        highContrast: false
      },
      performance: {
        cpuCount: 8,
        memoryTotal: 16 * 1024 * 1024 * 1024,
        memoryFree: 8 * 1024 * 1024 * 1024
      }
    },
    permissions: new Set(permissions),
    subscriptions: [],
    globalState: createMockMemento(),
    workspaceState: createMockMemento(),
    secrets: createMockSecretStorage()
  } as PluginContext
}

function createMockMemento(): any {
  const storage = new Map<string, unknown>()
  return {
    get: <T>(key: string, defaultValue?: T) => storage.get(key) as T ?? defaultValue,
    update: async (key: string, value: unknown) => storage.set(key, value),
    keys: () => Array.from(storage.keys()),
    setKeysForSync: () => {}
  }
}

function createMockSecretStorage(): any {
  const secrets = new Map<string, string>()
  return {
    store: async (key: string, value: string) => secrets.set(key, value),
    get: async (key: string) => secrets.get(key),
    delete: async (key: string) => secrets.delete(key),
    onDidChange: () => ({ dispose: () => {} })
  }
}