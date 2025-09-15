/**
 * Extension Points API - Rich plugin extension system
 * 
 * Provides comprehensive extension points for plugins to extend Lokus functionality:
 * - Commands and keybindings
 * - UI components (menus, toolbars, panels, status bar)
 * - Editor features (languages, themes, formatters)
 * - File system providers
 * - Task providers and debuggers
 */

import { EventEmitter } from '../../utils/EventEmitter.js'

export class ExtensionPoints extends EventEmitter {
  constructor() {
    super()
    
    // Extension point registries
    this.commands = new Map()
    this.keybindings = new Map()
    this.menus = new Map()
    this.toolbars = new Map()
    this.panels = new Map()
    this.statusBarItems = new Map()
    this.themes = new Map()
    this.languages = new Map()
    this.formatters = new Map()
    this.fileSystemProviders = new Map()
    this.taskProviders = new Map()
    this.debugAdapters = new Map()
    this.decorationProviders = new Map()
    this.viewProviders = new Map()
    
    // Plugin tracking
    this.pluginContributions = new Map() // pluginId -> Set of contribution IDs
  }

  // === COMMAND SYSTEM ===

  /**
   * Register a command that can be invoked by users or other plugins
   */
  registerCommand(pluginId, command) {
    this.validatePluginId(pluginId)
    this.validateCommand(command)

    const commandId = `${pluginId}.${command.id}`
    
    if (this.commands.has(commandId)) {
      throw new Error(`Command ${commandId} is already registered`)
    }

    const commandDefinition = {
      id: commandId,
      title: command.title,
      category: command.category || pluginId,
      handler: command.handler,
      when: command.when, // Conditional activation
      icon: command.icon,
      shortTitle: command.shortTitle,
      pluginId
    }

    this.commands.set(commandId, commandDefinition)
    this.trackContribution(pluginId, 'command', commandId)

    this.emit('command-registered', { pluginId, command: commandDefinition })
    
    return commandId
  }

  /**
   * Execute a command by ID
   */
  async executeCommand(commandId, ...args) {
    const command = this.commands.get(commandId)
    if (!command) {
      throw new Error(`Command ${commandId} not found`)
    }

    // Check conditional activation
    if (command.when && !this.evaluateWhenCondition(command.when)) {
      throw new Error(`Command ${commandId} is not available in current context`)
    }

    try {
      const result = await command.handler(...args)
      this.emit('command-executed', { commandId, args, result })
      return result
    } catch (error) {
      this.emit('command-error', { commandId, args, error })
      throw error
    }
  }

  /**
   * Register keybinding for a command
   */
  registerKeybinding(pluginId, keybinding) {
    this.validatePluginId(pluginId)
    
    const bindingId = `${pluginId}.${keybinding.key}`
    
    if (this.keybindings.has(bindingId)) {
      throw new Error(`Keybinding ${keybinding.key} is already registered`)
    }

    const keyBinding = {
      key: keybinding.key,
      command: keybinding.command,
      when: keybinding.when,
      args: keybinding.args,
      pluginId
    }

    this.keybindings.set(bindingId, keyBinding)
    this.trackContribution(pluginId, 'keybinding', bindingId)

    this.emit('keybinding-registered', { pluginId, keybinding: keyBinding })
    
    return bindingId
  }

  // === UI EXTENSION POINTS ===

  /**
   * Register menu contribution
   */
  registerMenu(pluginId, menu) {
    this.validatePluginId(pluginId)
    
    const menuId = `${pluginId}.${menu.id}`
    
    const menuDefinition = {
      id: menuId,
      label: menu.label,
      group: menu.group || 'navigation',
      order: menu.order || 100,
      when: menu.when,
      submenu: menu.submenu,
      command: menu.command,
      icon: menu.icon,
      pluginId
    }

    this.menus.set(menuId, menuDefinition)
    this.trackContribution(pluginId, 'menu', menuId)

    this.emit('menu-registered', { pluginId, menu: menuDefinition })
    
    return menuId
  }

  /**
   * Register toolbar contribution
   */
  registerToolbar(pluginId, toolbar) {
    this.validatePluginId(pluginId)
    
    const toolbarId = `${pluginId}.${toolbar.id}`
    
    const toolbarDefinition = {
      id: toolbarId,
      title: toolbar.title,
      location: toolbar.location || 'editor',
      group: toolbar.group || 'main',
      order: toolbar.order || 100,
      items: toolbar.items || [],
      when: toolbar.when,
      pluginId
    }

    this.toolbars.set(toolbarId, toolbarDefinition)
    this.trackContribution(pluginId, 'toolbar', toolbarId)

    this.emit('toolbar-registered', { pluginId, toolbar: toolbarDefinition })
    
    return toolbarId
  }

  /**
   * Register custom panel/view
   */
  registerPanel(pluginId, panel) {
    this.validatePluginId(pluginId)
    
    const panelId = `${pluginId}.${panel.id}`
    
    const panelDefinition = {
      id: panelId,
      title: panel.title,
      type: panel.type || 'webview', // 'webview', 'react', 'custom'
      location: panel.location || 'sidebar', // 'sidebar', 'panel', 'editor'
      icon: panel.icon,
      when: panel.when,
      initialState: panel.initialState,
      canToggleVisibility: panel.canToggleVisibility !== false,
      retainContextWhenHidden: panel.retainContextWhenHidden || false,
      pluginId
    }

    // Add type-specific properties
    if (panel.type === 'webview') {
      panelDefinition.html = panel.html
      panelDefinition.options = panel.options
    } else if (panel.type === 'react') {
      panelDefinition.component = panel.component
      panelDefinition.props = panel.props
    }

    this.panels.set(panelId, panelDefinition)
    this.trackContribution(pluginId, 'panel', panelId)

    this.emit('panel-registered', { pluginId, panel: panelDefinition })
    
    return panelId
  }

  /**
   * Register status bar item
   */
  registerStatusBarItem(pluginId, statusItem) {
    this.validatePluginId(pluginId)
    
    const itemId = `${pluginId}.${statusItem.id}`
    
    const statusBarItem = {
      id: itemId,
      text: statusItem.text,
      tooltip: statusItem.tooltip,
      command: statusItem.command,
      alignment: statusItem.alignment || 'left', // 'left', 'right'
      priority: statusItem.priority || 100,
      color: statusItem.color,
      backgroundColor: statusItem.backgroundColor,
      when: statusItem.when,
      pluginId
    }

    this.statusBarItems.set(itemId, statusBarItem)
    this.trackContribution(pluginId, 'statusBarItem', itemId)

    this.emit('status-bar-item-registered', { pluginId, statusBarItem })
    
    return itemId
  }

  // === EDITOR EXTENSION POINTS ===

  /**
   * Register language support
   */
  registerLanguage(pluginId, language) {
    this.validatePluginId(pluginId)
    
    const languageId = language.id
    
    if (this.languages.has(languageId)) {
      throw new Error(`Language ${languageId} is already registered`)
    }

    const languageDefinition = {
      id: languageId,
      aliases: language.aliases || [],
      extensions: language.extensions || [],
      filenames: language.filenames || [],
      firstLine: language.firstLine,
      configuration: language.configuration,
      pluginId
    }

    this.languages.set(languageId, languageDefinition)
    this.trackContribution(pluginId, 'language', languageId)

    this.emit('language-registered', { pluginId, language: languageDefinition })
    
    return languageId
  }

  /**
   * Register theme
   */
  registerTheme(pluginId, theme) {
    this.validatePluginId(pluginId)
    
    const themeId = `${pluginId}.${theme.id}`
    
    if (this.themes.has(themeId)) {
      throw new Error(`Theme ${themeId} is already registered`)
    }

    const themeDefinition = {
      id: themeId,
      label: theme.label,
      type: theme.type || 'dark', // 'dark', 'light', 'highContrast'
      colors: theme.colors || {},
      tokenColors: theme.tokenColors || [],
      semanticHighlighting: theme.semanticHighlighting !== false,
      pluginId
    }

    this.themes.set(themeId, themeDefinition)
    this.trackContribution(pluginId, 'theme', themeId)

    this.emit('theme-registered', { pluginId, theme: themeDefinition })
    
    return themeId
  }

  /**
   * Register document formatter
   */
  registerFormatter(pluginId, formatter) {
    this.validatePluginId(pluginId)
    
    const formatterId = `${pluginId}.${formatter.id}`
    
    const formatterDefinition = {
      id: formatterId,
      displayName: formatter.displayName,
      selector: formatter.selector, // Language selector
      formatDocument: formatter.formatDocument,
      formatSelection: formatter.formatSelection,
      formatOnType: formatter.formatOnType,
      triggerCharacters: formatter.triggerCharacters || [],
      pluginId
    }

    this.formatters.set(formatterId, formatterDefinition)
    this.trackContribution(pluginId, 'formatter', formatterId)

    this.emit('formatter-registered', { pluginId, formatter: formatterDefinition })
    
    return formatterId
  }

  // === FILE SYSTEM PROVIDERS ===

  /**
   * Register file system provider for custom protocols
   */
  registerFileSystemProvider(pluginId, provider) {
    this.validatePluginId(pluginId)
    
    const scheme = provider.scheme
    
    if (this.fileSystemProviders.has(scheme)) {
      throw new Error(`File system provider for scheme ${scheme} is already registered`)
    }

    const providerDefinition = {
      scheme,
      displayName: provider.displayName,
      capabilities: provider.capabilities,
      isReadonly: provider.isReadonly || false,
      isCaseSensitive: provider.isCaseSensitive !== false,
      
      // Required methods
      stat: provider.stat,
      readDirectory: provider.readDirectory,
      readFile: provider.readFile,
      writeFile: provider.writeFile,
      createDirectory: provider.createDirectory,
      delete: provider.delete,
      rename: provider.rename,
      
      // Optional methods
      copy: provider.copy,
      watch: provider.watch,
      
      pluginId
    }

    this.fileSystemProviders.set(scheme, providerDefinition)
    this.trackContribution(pluginId, 'fileSystemProvider', scheme)

    this.emit('file-system-provider-registered', { pluginId, provider: providerDefinition })
    
    return scheme
  }

  // === TASK PROVIDERS ===

  /**
   * Register task provider
   */
  registerTaskProvider(pluginId, taskProvider) {
    this.validatePluginId(pluginId)
    
    const providerId = `${pluginId}.${taskProvider.type}`
    
    const taskProviderDefinition = {
      type: taskProvider.type,
      displayName: taskProvider.displayName,
      provideTasks: taskProvider.provideTasks,
      resolveTask: taskProvider.resolveTask,
      pluginId
    }

    this.taskProviders.set(providerId, taskProviderDefinition)
    this.trackContribution(pluginId, 'taskProvider', providerId)

    this.emit('task-provider-registered', { pluginId, taskProvider: taskProviderDefinition })
    
    return providerId
  }

  // === DEBUG ADAPTERS ===

  /**
   * Register debug adapter
   */
  registerDebugAdapter(pluginId, debugAdapter) {
    this.validatePluginId(pluginId)
    
    const adapterId = debugAdapter.type
    
    if (this.debugAdapters.has(adapterId)) {
      throw new Error(`Debug adapter for type ${adapterId} is already registered`)
    }

    const debugAdapterDefinition = {
      type: adapterId,
      label: debugAdapter.label,
      program: debugAdapter.program,
      runtime: debugAdapter.runtime,
      configurationAttributes: debugAdapter.configurationAttributes || {},
      initialConfigurations: debugAdapter.initialConfigurations || [],
      configurationSnippets: debugAdapter.configurationSnippets || [],
      variables: debugAdapter.variables || {},
      pluginId
    }

    this.debugAdapters.set(adapterId, debugAdapterDefinition)
    this.trackContribution(pluginId, 'debugAdapter', adapterId)

    this.emit('debug-adapter-registered', { pluginId, debugAdapter: debugAdapterDefinition })
    
    return adapterId
  }

  // === DECORATION PROVIDERS ===

  /**
   * Register decoration provider for file/folder decorations
   */
  registerDecorationProvider(pluginId, decorationProvider) {
    this.validatePluginId(pluginId)
    
    const providerId = `${pluginId}.decorations`
    
    const decorationProviderDefinition = {
      id: providerId,
      label: decorationProvider.label,
      provideFileDecoration: decorationProvider.provideFileDecoration,
      onDidChangeFileDecorations: decorationProvider.onDidChangeFileDecorations,
      pluginId
    }

    this.decorationProviders.set(providerId, decorationProviderDefinition)
    this.trackContribution(pluginId, 'decorationProvider', providerId)

    this.emit('decoration-provider-registered', { pluginId, decorationProvider: decorationProviderDefinition })
    
    return providerId
  }

  // === VALIDATION AND UTILITIES ===

  /**
   * Validate plugin ID format
   */
  validatePluginId(pluginId) {
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error('Plugin ID must be a non-empty string')
    }
    
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/.test(pluginId)) {
      throw new Error('Plugin ID contains invalid characters')
    }
  }

  /**
   * Validate command structure
   */
  validateCommand(command) {
    if (!command || typeof command !== 'object') {
      throw new Error('Command must be an object')
    }

    if (!command.id || typeof command.id !== 'string') {
      throw new Error('Command ID must be a non-empty string')
    }

    if (!command.title || typeof command.title !== 'string') {
      throw new Error('Command title must be a non-empty string')
    }

    if (!command.handler || typeof command.handler !== 'function') {
      throw new Error('Command handler must be a function')
    }
  }

  /**
   * Evaluate when condition for conditional contributions
   */
  evaluateWhenCondition(whenClause) {
    // This would implement proper context evaluation
    // For now, just return true for any condition
    return true
  }

  /**
   * Track contribution for cleanup
   */
  trackContribution(pluginId, type, contributionId) {
    if (!this.pluginContributions.has(pluginId)) {
      this.pluginContributions.set(pluginId, new Set())
    }
    
    this.pluginContributions.get(pluginId).add(`${type}:${contributionId}`)
  }

  // === GETTERS ===

  /**
   * Get all commands
   */
  getCommands() {
    return Array.from(this.commands.values())
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category) {
    return this.getCommands().filter(cmd => cmd.category === category)
  }

  /**
   * Get menu items for location
   */
  getMenuItems(location) {
    return Array.from(this.menus.values())
      .filter(menu => !menu.location || menu.location === location)
      .sort((a, b) => (a.order || 100) - (b.order || 100))
  }

  /**
   * Get toolbar for location
   */
  getToolbar(location) {
    return Array.from(this.toolbars.values())
      .filter(toolbar => toolbar.location === location)
      .sort((a, b) => (a.order || 100) - (b.order || 100))
  }

  /**
   * Get panels for location
   */
  getPanels(location) {
    return Array.from(this.panels.values())
      .filter(panel => panel.location === location)
  }

  /**
   * Get status bar items by alignment
   */
  getStatusBarItems(alignment) {
    return Array.from(this.statusBarItems.values())
      .filter(item => item.alignment === alignment)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100))
  }

  /**
   * Get language definition
   */
  getLanguage(languageId) {
    return this.languages.get(languageId)
  }

  /**
   * Get language by file extension
   */
  getLanguageByExtension(extension) {
    for (const language of this.languages.values()) {
      if (language.extensions.includes(extension)) {
        return language
      }
    }
    return null
  }

  /**
   * Get all themes
   */
  getThemes() {
    return Array.from(this.themes.values())
  }

  /**
   * Get formatters for language
   */
  getFormatters(languageId) {
    return Array.from(this.formatters.values())
      .filter(formatter => this.matchesSelector(formatter.selector, languageId))
  }

  /**
   * Match language selector
   */
  matchesSelector(selector, languageId) {
    if (typeof selector === 'string') {
      return selector === languageId
    }
    
    if (Array.isArray(selector)) {
      return selector.includes(languageId)
    }
    
    if (selector && selector.language) {
      return selector.language === languageId
    }
    
    return false
  }

  /**
   * Get file system provider for scheme
   */
  getFileSystemProvider(scheme) {
    return this.fileSystemProviders.get(scheme)
  }

  /**
   * Get task providers
   */
  getTaskProviders() {
    return Array.from(this.taskProviders.values())
  }

  /**
   * Get debug adapter
   */
  getDebugAdapter(type) {
    return this.debugAdapters.get(type)
  }

  // === CLEANUP ===

  /**
   * Unregister all contributions from a plugin
   */
  unregisterPlugin(pluginId) {
    const contributions = this.pluginContributions.get(pluginId)
    if (!contributions) {
      return
    }

    for (const contribution of contributions) {
      const [type, id] = contribution.split(':', 2)
      
      switch (type) {
        case 'command':
          this.commands.delete(id)
          break
        case 'keybinding':
          this.keybindings.delete(id)
          break
        case 'menu':
          this.menus.delete(id)
          break
        case 'toolbar':
          this.toolbars.delete(id)
          break
        case 'panel':
          this.panels.delete(id)
          break
        case 'statusBarItem':
          this.statusBarItems.delete(id)
          break
        case 'theme':
          this.themes.delete(id)
          break
        case 'language':
          this.languages.delete(id)
          break
        case 'formatter':
          this.formatters.delete(id)
          break
        case 'fileSystemProvider':
          this.fileSystemProviders.delete(id)
          break
        case 'taskProvider':
          this.taskProviders.delete(id)
          break
        case 'debugAdapter':
          this.debugAdapters.delete(id)
          break
        case 'decorationProvider':
          this.decorationProviders.delete(id)
          break
      }
    }

    this.pluginContributions.delete(pluginId)
    
    this.emit('plugin-unregistered', { pluginId })
  }

  /**
   * Get statistics about registered extensions
   */
  getStats() {
    return {
      commands: this.commands.size,
      keybindings: this.keybindings.size,
      menus: this.menus.size,
      toolbars: this.toolbars.size,
      panels: this.panels.size,
      statusBarItems: this.statusBarItems.size,
      themes: this.themes.size,
      languages: this.languages.size,
      formatters: this.formatters.size,
      fileSystemProviders: this.fileSystemProviders.size,
      taskProviders: this.taskProviders.size,
      debugAdapters: this.debugAdapters.size,
      decorationProviders: this.decorationProviders.size,
      totalPlugins: this.pluginContributions.size
    }
  }
}

export default ExtensionPoints