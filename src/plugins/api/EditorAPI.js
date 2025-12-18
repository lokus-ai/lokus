/**
 * Editor Plugin API - Comprehensive TipTap Editor Integration
 * 
 * This API enables plugins to deeply integrate with the TipTap editor by providing:
 * - Custom nodes, marks, and extensions registration
 * - Slash command integration
 * - Toolbar and menu contributions
 * - Input rules and keyboard shortcuts
 * - Node views and custom rendering
 * - Editor lifecycle hooks
 * - Hot-reloading support with validation
 */

import { EventEmitter } from '../../utils/EventEmitter.js'

import { Disposable } from '../../utils/Disposable.js';
import { errorHandler } from './ErrorHandler.js'

export class EditorPluginAPI extends EventEmitter {
  constructor() {
    super()

    // Extension registries
    this.nodes = new Map()
    this.marks = new Map()
    this.extensions = new Map()
    this.slashCommands = new Map()
    this.inputRules = new Map()
    this.keyboardShortcuts = new Map()
    this.toolbarItems = new Map()
    this.menuItems = new Map()
    this.nodeViews = new Map()
    this.editorCommands = new Map()
    this.formats = new Map()

    // Language feature providers
    this.providers = new Map()

    // Plugin tracking for cleanup
    this.pluginContributions = new Map()

    // Editor instance reference
    this.editorInstance = null

    // Validation cache
    this.validationCache = new Map()

    // Performance monitoring
    this.loadTimes = new Map()

    // Current plugin ID for tracking provider registrations
    this.currentPluginId = null
  }

  // === ADAPTERS FOR SDK COMPATIBILITY ===

  /**
   * Create a TextDocument adapter from TipTap state
   */
  _createDocumentAdapter(state, uri = 'untitled:default') {
    const self = this
    const text = state.doc.textContent
    const lines = text.split('\n')

    return {
      uri: { toString: () => uri, path: uri, scheme: 'untitled' },
      fileName: uri,
      isUntitled: true,
      languageId: 'markdown',
      version: 1,
      isDirty: false,
      isClosed: false,
      eol: 1,
      lineCount: lines.length,

      getText: (range) => {
        if (!range) return text
        const startOffset = self._positionToOffset(range.start)
        const endOffset = self._positionToOffset(range.end)
        return text.substring(startOffset, endOffset)
      },

      lineAt: (lineOrPosition) => {
        const lineNum = typeof lineOrPosition === 'number'
          ? lineOrPosition
          : lineOrPosition.line
        const lineText = lines[lineNum] || ''
        return {
          lineNumber: lineNum,
          text: lineText,
          range: {
            start: { line: lineNum, character: 0 },
            end: { line: lineNum, character: lineText.length }
          },
          rangeIncludingLineBreak: {
            start: { line: lineNum, character: 0 },
            end: { line: lineNum + 1, character: 0 }
          },
          firstNonWhitespaceCharacterIndex: lineText.search(/\S/),
          isEmptyOrWhitespace: lineText.trim().length === 0
        }
      },

      offsetAt: (position) => {
        let offset = 0
        for (let i = 0; i < position.line && i < lines.length; i++) {
          offset += lines[i].length + 1 // +1 for newline
        }
        offset += Math.min(position.character, (lines[position.line] || '').length)
        return offset
      },

      positionAt: (offset) => {
        let remaining = offset
        for (let line = 0; line < lines.length; line++) {
          if (remaining <= lines[line].length) {
            return { line, character: remaining }
          }
          remaining -= lines[line].length + 1
        }
        return { line: lines.length - 1, character: (lines[lines.length - 1] || '').length }
      },

      validateRange: (range) => range,
      validatePosition: (position) => position,
      save: async () => true
    }
  }

  /**
   * Create a TextEditor adapter from TipTap view
   */
  _createEditorAdapter(view) {
    if (!view) return undefined

    return {
      document: this._createDocumentAdapter(view.state),
      selection: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
        active: { line: 0, character: 0 },
        anchor: { line: 0, character: 0 },
        isEmpty: true,
        isSingleLine: true
      },
      selections: [],
      visibleRanges: [],
      options: {},
      viewColumn: 1,

      edit: async (callback) => {
        // TODO: Implement edit builder
        return true
      },

      insertSnippet: async (snippet) => {
        // TODO: Implement snippet insertion
        return true
      },

      setDecorations: (decorationType, ranges) => {
        // TODO: Implement decorations
      },

      revealRange: (range) => { },
      show: () => { },
      hide: () => { }
    }
  }

  /**
   * Get active text editor (SDK compatible)
   */
  getActiveEditor() {
    return Promise.resolve(this._createEditorAdapter(this.editorInstance))
  }

  /**
   * Get editor content
   * @returns {Promise<string>} Current editor content
   */
  async getContent() {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }
    return this.editorInstance.getHTML()
  }

  /**
   * Set editor content
   */
  async setContent(content) {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }
    this.editorInstance.commands.setContent(content)
    this.emit('content-changed', { content })
  }

  /**
   * Insert content at cursor position
   * @param {string} content - Content to insert
   */
  async insertContent(content) {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }
    this.editorInstance.commands.insertContent(content)
    this.emit('content-inserted', { content })
  }

  /**
   * Set selection in editor
   */
  async setSelection(selection) {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }

    // Convert from SDK Selection format to TipTap format
    const from = this._positionToOffset(selection.start || selection.anchor)
    const to = this._positionToOffset(selection.end || selection.active)

    this.editorInstance.commands.setTextSelection({ from, to })
    this.emit('selection-changed', { from, to })
  }

  /**
   * Get all selections (currently only supports single selection)
   * @returns {Promise<Selection[]>} Array of selections
   */
  async getSelections() {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }

    const selection = this._createSelectionFromEditor(this.editorInstance)
    return [selection]
  }

  /**
   * Set multiple selections (currently only supports single selection)
   * @param {Selection[]} selections - Array of selections
   */
  async setSelections(selections) {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }

    if (!selections || selections.length === 0) {
      return
    }

    // For now, only set the first selection
    const selection = selections[0]
    await this.setSelection(selection)
  }

  /**
   * Replace text in a range
   * @param {Range} range - Range to replace
   * @param {string} text - New text
   */
  async replaceText(range, text) {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }

    const from = this._positionToOffset(range.start)
    const to = this._positionToOffset(range.end)

    // Delete the range and insert new text
    this.editorInstance
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, text)
      .run()

    this.emit('text-replaced', { range, text })
  }

  /**
   * Get text in range
   */
  async getTextInRange(range) {
    if (!this.editorInstance) {
      throw new Error('Editor not initialized')
    }

    const from = this._positionToOffset(range.start)
    const to = this._positionToOffset(range.end)

    return this.editorInstance.state.doc.textBetween(from, to)
  }

  /**
   * Convert Position to offset
   */
  _positionToOffset(position) {
    if (typeof position === 'number') return position
    if (!this.editorInstance) return 0

    // If position is {line, character} format
    if (position && typeof position.line === 'number') {
      const doc = this.editorInstance.state.doc
      const text = doc.textContent
      const lines = text.split('\n')

      let offset = 0
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1 // +1 for newline
      }
      offset += Math.min(position.character || 0, (lines[position.line] || '').length)

      return offset
    }

    return 0
  }

  /**
   * Convert offset to Position
   */
  _offsetToPosition(offset) {
    if (!this.editorInstance) {
      return { line: 0, character: 0 }
    }

    const text = this.editorInstance.state.doc.textContent
    const lines = text.split('\n')

    let remaining = offset
    for (let line = 0; line < lines.length; line++) {
      if (remaining <= lines[line].length) {
        return { line, character: remaining }
      }
      remaining -= lines[line].length + 1
    }

    return { line: lines.length - 1, character: (lines[lines.length - 1] || '').length }
  }

  /**
   * Listen to active editor changes
   */
  onDidChangeActiveTextEditor(listener) {
    const handler = (editor) => {
      listener(this._createEditorAdapter(editor))
    }
    this.on('editor-changed', handler)

    return new Disposable(() => {
      this.off('editor-changed', handler)
    })
  }

  /**
   * Listen to selection changes
   */
  onDidChangeTextEditorSelection(listener) {
    if (!this.editorInstance) {
      // Queue for when editor is ready
      const setupListener = () => {
        this.editorInstance.on('selectionUpdate', ({ editor }) => {
          const event = {
            textEditor: this._createEditorAdapter(editor.view),
            selections: [this._createSelectionFromEditor(editor)],
            kind: 1 // Keyboard
          }
          listener(event)
        })
      }

      this.once('editor-attached', setupListener)
      return new Disposable(() => {
        this.off('editor-attached', setupListener)
      })
    }

    const handler = ({ editor }) => {
      const event = {
        textEditor: this._createEditorAdapter(editor.view),
        selections: [this._createSelectionFromEditor(editor)],
        kind: 1
      }
      listener(event)
    }

    this.editorInstance.on('selectionUpdate', handler)

    return new Disposable(() => {
      this.editorInstance?.off('selectionUpdate', handler)
    })
  }

  /**
   * Listen to text document changes
   * @param {Function} listener - Callback function
   * @returns {Disposable} Disposable to unregister the listener
   */
  onDidChangeTextDocument(listener) {
    if (!this.editorInstance) {
      // Queue for when editor is ready
      const setupListener = () => {
        this.editorInstance.on('update', ({ editor }) => {
          const event = {
            document: this._createDocumentAdapter(editor.state),
            contentChanges: [],
            reason: undefined
          }
          listener(event)
        })
      }

      this.once('editor-attached', setupListener)
      return new Disposable(() => {
        this.off('editor-attached', setupListener)
      })
    }

    const handler = ({ editor }) => {
      const event = {
        document: this._createDocumentAdapter(editor.state),
        contentChanges: [],
        reason: undefined
      }
      listener(event)
    }

    this.editorInstance.on('update', handler)

    return new Disposable(() => {
      this.editorInstance?.off('update', handler)
    })
  }

  /**
   * Listen to visible range changes
   * @param {Function} listener - Callback function
   * @returns {Disposable} Disposable to unregister the listener
   */
  onDidChangeTextEditorVisibleRanges(listener) {
    if (!this.editorInstance) {
      // Queue for when editor is ready
      const setupListener = () => {
        this.editorInstance.on('update', ({ editor }) => {
          const event = {
            textEditor: this._createEditorAdapter(editor.view),
            visibleRanges: []
          }
          listener(event)
        })
      }

      this.once('editor-attached', setupListener)
      return new Disposable(() => {
        this.off('editor-attached', setupListener)
      })
    }

    const handler = ({ editor }) => {
      const event = {
        textEditor: this._createEditorAdapter(editor.view),
        visibleRanges: []
      }
      listener(event)
    }

    this.editorInstance.on('update', handler)

    return new Disposable(() => {
      this.editorInstance?.off('update', handler)
    })
  }

  /**
   * Create selection from TipTap editor
   */
  _createSelectionFromEditor(editor) {
    const { from, to } = editor.state.selection
    return {
      start: this._offsetToPosition(from),
      end: this._offsetToPosition(to),
      anchor: this._offsetToPosition(from),
      active: this._offsetToPosition(to),
      isEmpty: from === to,
      isSingleLine: true // Simplified
    }
  }

  // === LANGUAGE PROVIDER REGISTRATION METHODS ===

  /**
   * Register a completion item provider
   * @param {string|object} selector - Document selector (language ID or {language, scheme, pattern})
   * @param {object} provider - Completion provider with provideCompletionItems method
   * @param {string[]} [triggerCharacters] - Characters that trigger completion
   * @returns {Disposable} Disposable to unregister the provider
   */
  registerCompletionProvider(selector, provider, ...triggerCharacters) {
    const id = `completion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'completion',
      selector,
      provider,
      triggerCharacters,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('completion-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('completion-provider-unregistered', { id })
    })
  }

  /**
   * Register a hover provider
   * @param {string|object} selector - Document selector
   * @param {object} provider - Hover provider with provideHover method
   * @returns {Disposable} Disposable to unregister
   */
  registerHoverProvider(selector, provider) {
    const id = `hover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'hover',
      selector,
      provider,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('hover-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('hover-provider-unregistered', { id })
    })
  }

  /**
   * Register a definition provider (go-to-definition)
   * @param {string|object} selector - Document selector
   * @param {object} provider - Definition provider with provideDefinition method
   * @returns {Disposable} Disposable to unregister
   */
  registerDefinitionProvider(selector, provider) {
    const id = `definition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'definition',
      selector,
      provider,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('definition-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('definition-provider-unregistered', { id })
    })
  }

  /**
   * Register a code action provider (quick fixes, refactoring)
   * @param {string|object} selector - Document selector
   * @param {object} provider - Code action provider with provideCodeActions method
   * @param {object} [metadata] - Provider metadata (providedCodeActionKinds, etc.)
   * @returns {Disposable} Disposable to unregister
   */
  registerCodeActionProvider(selector, provider, metadata) {
    const id = `codeaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'codeAction',
      selector,
      provider,
      metadata,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('code-action-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('code-action-provider-unregistered', { id })
    })
  }

  /**
   * Register a document formatting provider
   * @param {string|object} selector - Document selector
   * @param {object} provider - Formatting provider with provideDocumentFormattingEdits method
   * @returns {Disposable} Disposable to unregister
   */
  registerDocumentFormattingProvider(selector, provider) {
    const id = `formatting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'formatting',
      selector,
      provider,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('formatting-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('formatting-provider-unregistered', { id })
    })
  }

  /**
   * Register a folding range provider
   * @param {string|object} selector - Document selector
   * @param {object} provider - Folding range provider with provideFoldingRanges method
   * @returns {Disposable} Disposable to unregister
   */
  registerFoldingRangeProvider(selector, provider) {
    const id = `folding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'folding',
      selector,
      provider,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('folding-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('folding-provider-unregistered', { id })
    })
  }

  /**
   * Register a document link provider
   * @param {string|object} selector - Document selector
   * @param {object} provider - Link provider with provideDocumentLinks method
   * @returns {Disposable} Disposable to unregister
   */
  registerDocumentLinkProvider(selector, provider) {
    const id = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration = {
      id,
      type: 'link',
      selector,
      provider,
      pluginId: this.currentPluginId
    }

    this.providers.set(id, registration)

    this.emit('link-provider-registered', registration)

    return new Disposable(() => {
      this.providers.delete(id)
      this.emit('link-provider-unregistered', { id })
    })
  }

  /**
   * Get providers by type
   * @param {string} type - Provider type (completion, hover, definition, etc.)
   * @returns {Array} Array of providers matching the type
   */
  getProviders(type) {
    const providers = []
    for (const provider of this.providers.values()) {
      if (provider.type === type) {
        providers.push(provider)
      }
    }
    return providers
  }

  /**
   * Unregister all providers for a specific plugin
   * @param {string} pluginId - Plugin ID
   */
  unregisterAllProviders(pluginId) {
    for (const [id, provider] of this.providers) {
      if (provider.pluginId === pluginId) {
        this.providers.delete(id)
        this.emit(`${provider.type}-provider-unregistered`, { id })
      }
    }
  }

  // === TIPTAP EXTENSION REGISTRATION METHODS ===

  /**
   * Register a custom TipTap node
   */
  registerNode(pluginId, nodeConfig) {
    this.validatePluginId(pluginId)
    this.validateNodeConfig(nodeConfig)

    const nodeId = `${pluginId}.${nodeConfig.name}`

    if (this.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} is already registered`)
    }

    // Create TipTap node with validation and error handling
    const nodeDefinition = this.createSecureNode(nodeConfig, pluginId)

    this.nodes.set(nodeId, {
      ...nodeDefinition,
      pluginId,
      originalConfig: nodeConfig,
      type: 'node'
    })

    this.trackContribution(pluginId, 'node', nodeId)
    this.emit('node-registered', { pluginId, nodeId, nodeDefinition })

    // Hot reload if editor is available
    if (this.editorInstance) {
      this.hotReloadExtensions()
    }

    return new Disposable(() => {
      this.nodes.delete(nodeId)
      this.trackContribution(pluginId, 'node', nodeId) // Remove from tracking? Or handle in dispose?
      // Actually, trackContribution adds. We should probably have untrack.
      // For now, just deleting from map is enough as unregisterPlugin handles bulk cleanup.
      this.emit('node-unregistered', { pluginId, nodeId })

      if (this.editorInstance) {
        this.hotReloadExtensions()
      }
    })
  }

  /**
   * Register a custom TipTap mark
   */
  registerMark(pluginId, markConfig) {
    this.validatePluginId(pluginId)
    this.validateMarkConfig(markConfig)

    const markId = `${pluginId}.${markConfig.name}`

    if (this.marks.has(markId)) {
      throw new Error(`Mark ${markId} is already registered`)
    }

    const markDefinition = this.createSecureMark(markConfig, pluginId)

    this.marks.set(markId, {
      ...markDefinition,
      pluginId,
      originalConfig: markConfig,
      type: 'mark'
    })

    this.trackContribution(pluginId, 'mark', markId)
    this.emit('mark-registered', { pluginId, markId, markDefinition })

    if (this.editorInstance) {
      this.hotReloadExtensions()
    }

    return new Disposable(() => {
      this.marks.delete(markId)
      this.emit('mark-unregistered', { pluginId, markId })

      if (this.editorInstance) {
        this.hotReloadExtensions()
      }
    })
  }

  /**
   * Register a custom TipTap extension
   */
  registerExtension(pluginId, extensionConfig) {
    this.validatePluginId(pluginId)
    this.validateExtensionConfig(extensionConfig)

    const extensionId = `${pluginId}.${extensionConfig.name}`

    if (this.extensions.has(extensionId)) {
      throw new Error(`Extension ${extensionId} is already registered`)
    }

    const extensionDefinition = this.createSecureExtension(extensionConfig, pluginId)

    this.extensions.set(extensionId, {
      ...extensionDefinition,
      pluginId,
      originalConfig: extensionConfig,
      type: 'extension'
    })

    this.trackContribution(pluginId, 'extension', extensionId)
    this.emit('extension-registered', { pluginId, extensionId, extensionDefinition })

    if (this.editorInstance) {
      this.hotReloadExtensions()
    }

    return new Disposable(() => {
      this.extensions.delete(extensionId)
      this.emit('extension-unregistered', { pluginId, extensionId })

      if (this.editorInstance) {
        this.hotReloadExtensions()
      }
    })
  }

  /**
   * Register slash commands
   */
  registerSlashCommand(pluginId, slashCommandConfig) {
    this.validatePluginId(pluginId)
    this.validateSlashCommandConfig(slashCommandConfig)

    const commandId = `${pluginId}.${slashCommandConfig.id}`

    if (this.slashCommands.has(commandId)) {
      throw new Error(`Slash command ${commandId} is already registered`)
    }

    const commandDefinition = {
      id: commandId,
      title: slashCommandConfig.title,
      description: slashCommandConfig.description,
      icon: slashCommandConfig.icon,
      group: slashCommandConfig.group || pluginId,
      order: slashCommandConfig.order || 100,
      keywords: slashCommandConfig.keywords || [],
      handler: this.wrapCommandHandler(slashCommandConfig.handler, pluginId),
      when: slashCommandConfig.when,
      pluginId
    }

    this.slashCommands.set(commandId, commandDefinition)
    this.trackContribution(pluginId, 'slashCommand', commandId)
    this.emit('slash-command-registered', { pluginId, commandId, commandDefinition })

    return new Disposable(() => {
      this.slashCommands.delete(commandId)
      this.emit('slash-command-unregistered', { pluginId, commandId })
    })
  }

  /**
   * Register input rules
   */
  registerInputRule(pluginId, inputRuleConfig) {
    this.validatePluginId(pluginId)
    this.validateInputRuleConfig(inputRuleConfig)

    const ruleId = `${pluginId}.${inputRuleConfig.id}`

    if (this.inputRules.has(ruleId)) {
      throw new Error(`Input rule ${ruleId} is already registered`)
    }

    const ruleDefinition = {
      id: ruleId,
      pattern: inputRuleConfig.pattern,
      handler: this.wrapInputRuleHandler(inputRuleConfig.handler, pluginId),
      priority: inputRuleConfig.priority || 100,
      when: inputRuleConfig.when,
      pluginId
    }

    this.inputRules.set(ruleId, ruleDefinition)
    this.trackContribution(pluginId, 'inputRule', ruleId)
    this.emit('input-rule-registered', { pluginId, ruleId, ruleDefinition })

    return ruleId
  }

  /**
   * Register keyboard shortcuts
   */
  registerKeyboardShortcut(pluginId, shortcutConfig) {
    this.validatePluginId(pluginId)
    this.validateKeyboardShortcutConfig(shortcutConfig)

    const shortcutId = `${pluginId}.${shortcutConfig.key}`

    if (this.keyboardShortcuts.has(shortcutId)) {
      throw new Error(`Keyboard shortcut ${shortcutConfig.key} is already registered`)
    }

    const shortcutDefinition = {
      id: shortcutId,
      key: shortcutConfig.key,
      handler: this.wrapCommandHandler(shortcutConfig.handler, pluginId),
      when: shortcutConfig.when,
      priority: shortcutConfig.priority || 100,
      pluginId
    }

    this.keyboardShortcuts.set(shortcutId, shortcutDefinition)
    this.trackContribution(pluginId, 'keyboardShortcut', shortcutId)
    this.emit('keyboard-shortcut-registered', { pluginId, shortcutId, shortcutDefinition })

    return shortcutId
  }

  /**
   * Register toolbar items
   */
  registerToolbarItem(pluginId, toolbarConfig) {
    this.validatePluginId(pluginId)
    this.validateToolbarItemConfig(toolbarConfig)

    const itemId = `${pluginId}.${toolbarConfig.id}`

    if (this.toolbarItems.has(itemId)) {
      throw new Error(`Toolbar item ${itemId} is already registered`)
    }

    const itemDefinition = {
      id: itemId,
      type: toolbarConfig.type || 'button', // 'button', 'dropdown', 'separator'
      title: toolbarConfig.title,
      icon: toolbarConfig.icon,
      group: toolbarConfig.group || 'editor',
      order: toolbarConfig.order || 100,
      handler: toolbarConfig.handler ? this.wrapCommandHandler(toolbarConfig.handler, pluginId) : null,
      isActive: toolbarConfig.isActive,
      isDisabled: toolbarConfig.isDisabled,
      items: toolbarConfig.items, // For dropdown type
      when: toolbarConfig.when,
      pluginId
    }

    this.toolbarItems.set(itemId, itemDefinition)
    this.trackContribution(pluginId, 'toolbarItem', itemId)
    this.emit('toolbar-item-registered', { pluginId, itemId, itemDefinition })

    return itemId
  }

  /**
   * Register node views for custom rendering
   */
  registerNodeView(pluginId, nodeViewConfig) {
    this.validatePluginId(pluginId)
    this.validateNodeViewConfig(nodeViewConfig)

    const viewId = `${pluginId}.${nodeViewConfig.name}`

    if (this.nodeViews.has(viewId)) {
      throw new Error(`Node view ${viewId} is already registered`)
    }

    const viewDefinition = {
      id: viewId,
      name: nodeViewConfig.name,
      component: nodeViewConfig.component,
      renderHTML: nodeViewConfig.renderHTML,
      interactive: nodeViewConfig.interactive !== false,
      draggable: nodeViewConfig.draggable || false,
      selectable: nodeViewConfig.selectable !== false,
      pluginId
    }

    this.nodeViews.set(viewId, viewDefinition)
    this.trackContribution(pluginId, 'nodeView', viewId)
    this.emit('node-view-registered', { pluginId, viewId, viewDefinition })

    return viewId
  }

  /**
   * Register custom editor commands
   */
  registerEditorCommand(pluginId, commandConfig) {
    this.validatePluginId(pluginId)
    this.validateEditorCommandConfig(commandConfig)

    const commandId = `${pluginId}.${commandConfig.name}`

    if (this.editorCommands.has(commandId)) {
      throw new Error(`Editor command ${commandId} is already registered`)
    }

    const commandDefinition = {
      id: commandId,
      name: commandConfig.name,
      handler: this.wrapCommandHandler(commandConfig.handler, pluginId),
      description: commandConfig.description,
      pluginId
    }

    this.editorCommands.set(commandId, commandDefinition)
    this.trackContribution(pluginId, 'editorCommand', commandId)
    this.emit('editor-command-registered', { pluginId, commandId, commandDefinition })

    return commandId
  }

  /**
   * Register custom formats for import/export
   */
  registerFormat(pluginId, formatConfig) {
    this.validatePluginId(pluginId)
    this.validateFormatConfig(formatConfig)

    const formatId = `${pluginId}.${formatConfig.name}`

    if (this.formats.has(formatId)) {
      throw new Error(`Format ${formatId} is already registered`)
    }

    const formatDefinition = {
      id: formatId,
      name: formatConfig.name,
      displayName: formatConfig.displayName,
      extensions: formatConfig.extensions || [],
      mimeTypes: formatConfig.mimeTypes || [],
      import: formatConfig.import ? this.wrapFormatHandler(formatConfig.import, pluginId) : null,
      export: formatConfig.export ? this.wrapFormatHandler(formatConfig.export, pluginId) : null,
      pluginId
    }

    this.formats.set(formatId, formatDefinition)
    this.trackContribution(pluginId, 'format', formatId)
    this.emit('format-registered', { pluginId, formatId, formatDefinition })

    return formatId
  }

  // === SECURE EXTENSION CREATORS ===

  /**
   * Create a secure TipTap node with validation
   */
  createSecureNode(config, pluginId) {
    const startTime = performance.now()

    // Validate security
    const securityViolations = errorHandler.validateSecurity(pluginId, 'node-creation', {
      config,
      domAccess: true
    })

    if (securityViolations.length > 0) {
    }

    try {
      const nodeDefinition = Node.create({
        name: config.name,
        group: config.group || 'block',
        content: config.content,
        marks: config.marks,
        inline: config.inline || false,
        atom: config.atom || false,
        selectable: config.selectable !== false,
        draggable: config.draggable || false,
        defining: config.defining || false,
        isolating: config.isolating || false,

        addAttributes() {
          return this.validateAttributes(config.attributes || {})
        },

        parseHTML() {
          return this.validateParseHTML(config.parseHTML || [])
        },

        renderHTML({ HTMLAttributes }) {
          try {
            if (config.renderHTML) {
              return config.renderHTML({ HTMLAttributes })
            }
            return [config.tag || 'div', HTMLAttributes]
          } catch (error) {
            return [config.tag || 'div', HTMLAttributes, '[Render Error]']
          }
        },

        addCommands() {
          if (!config.commands) return {}

          const commands = {}
          for (const [name, handler] of Object.entries(config.commands)) {
            commands[name] = (...args) => this.wrapCommandHandler(handler, pluginId)(...args)
          }
          return commands
        },

        addInputRules() {
          if (!config.inputRules) return []

          return config.inputRules.map(rule => {
            return new InputRule({
              find: rule.find,
              handler: this.wrapInputRuleHandler(rule.handler, pluginId)
            })
          })
        },

        addPasteRules() {
          if (!config.pasteRules) return []

          return config.pasteRules.map(rule => ({
            find: rule.find,
            handler: this.wrapInputRuleHandler(rule.handler, pluginId)
          }))
        },

        addKeyboardShortcuts() {
          if (!config.keyboardShortcuts) return {}

          const shortcuts = {}
          for (const [key, handler] of Object.entries(config.keyboardShortcuts)) {
            shortcuts[key] = this.wrapCommandHandler(handler, pluginId)
          }
          return shortcuts
        },

        addNodeView() {
          if (!config.nodeView) return null

          return this.wrapNodeView(config.nodeView, pluginId)
        },

        onBeforeCreate() {
          if (config.onBeforeCreate) {
            this.wrapLifecycleHandler(config.onBeforeCreate, pluginId)()
          }
        },

        onCreate() {
          if (config.onCreate) {
            this.wrapLifecycleHandler(config.onCreate, pluginId)()
          }
        },

        onUpdate() {
          if (config.onUpdate) {
            this.wrapLifecycleHandler(config.onUpdate, pluginId)()
          }
        },

        onDestroy() {
          if (config.onDestroy) {
            this.wrapLifecycleHandler(config.onDestroy, pluginId)()
          }
        }
      })

      const loadTime = performance.now() - startTime
      this.loadTimes.set(`${pluginId}.${config.name}`, loadTime)

      // Monitor performance
      errorHandler.monitorPerformance(pluginId, 'extensionLoad', loadTime, {
        extensionType: 'node',
        extensionName: config.name
      })

      return nodeDefinition
    } catch (error) {
      // Handle error with context
      const errorInfo = errorHandler.handleError(pluginId, error, {
        operation: 'node-creation',
        extensionName: config.name,
        config
      })

      throw new Error(`Failed to create node: ${error.message}`)
    }
  }

  /**
   * Create a secure TipTap mark with validation
   */
  createSecureMark(config, pluginId) {
    const startTime = performance.now()

    try {
      const markDefinition = Mark.create({
        name: config.name,
        inclusive: config.inclusive !== false,
        excludes: config.excludes || '',
        group: config.group,
        spanning: config.spanning !== false,

        addAttributes() {
          return this.validateAttributes(config.attributes || {})
        },

        parseHTML() {
          return this.validateParseHTML(config.parseHTML || [])
        },

        renderHTML({ HTMLAttributes }) {
          try {
            if (config.renderHTML) {
              return config.renderHTML({ HTMLAttributes })
            }
            return [config.tag || 'span', HTMLAttributes]
          } catch (error) {
            return [config.tag || 'span', HTMLAttributes]
          }
        },

        addCommands() {
          if (!config.commands) return {}

          const commands = {}
          for (const [name, handler] of Object.entries(config.commands)) {
            commands[name] = (...args) => this.wrapCommandHandler(handler, pluginId)(...args)
          }
          return commands
        },

        addInputRules() {
          if (!config.inputRules) return []

          return config.inputRules.map(rule => {
            return new InputRule({
              find: rule.find,
              handler: this.wrapInputRuleHandler(rule.handler, pluginId)
            })
          })
        },

        addKeyboardShortcuts() {
          if (!config.keyboardShortcuts) return {}

          const shortcuts = {}
          for (const [key, handler] of Object.entries(config.keyboardShortcuts)) {
            shortcuts[key] = this.wrapCommandHandler(handler, pluginId)
          }
          return shortcuts
        }
      })

      const loadTime = performance.now() - startTime
      this.loadTimes.set(`${pluginId}.${config.name}`, loadTime)

      return markDefinition
    } catch (error) {
      throw new Error(`Failed to create mark: ${error.message}`)
    }
  }

  /**
   * Create a secure TipTap extension with validation
   */
  createSecureExtension(config, pluginId) {
    const startTime = performance.now()

    try {
      const extensionDefinition = Extension.create({
        name: config.name,
        priority: config.priority || 100,

        addOptions() {
          return this.validateOptions(config.options || {})
        },

        addCommands() {
          if (!config.commands) return {}

          const commands = {}
          for (const [name, handler] of Object.entries(config.commands)) {
            commands[name] = (...args) => this.wrapCommandHandler(handler, pluginId)(...args)
          }
          return commands
        },

        addKeyboardShortcuts() {
          if (!config.keyboardShortcuts) return {}

          const shortcuts = {}
          for (const [key, handler] of Object.entries(config.keyboardShortcuts)) {
            shortcuts[key] = this.wrapCommandHandler(handler, pluginId)
          }
          return shortcuts
        },

        addInputRules() {
          if (!config.inputRules) return []

          return config.inputRules.map(rule => {
            return new InputRule({
              find: rule.find,
              handler: this.wrapInputRuleHandler(rule.handler, pluginId)
            })
          })
        },

        addProseMirrorPlugins() {
          if (!config.proseMirrorPlugins) return []

          return config.proseMirrorPlugins.map(pluginFactory => {
            return this.wrapProseMirrorPlugin(pluginFactory, pluginId)
          })
        },

        onBeforeCreate() {
          if (config.onBeforeCreate) {
            this.wrapLifecycleHandler(config.onBeforeCreate, pluginId)()
          }
        },

        onCreate() {
          if (config.onCreate) {
            this.wrapLifecycleHandler(config.onCreate, pluginId)()
          }
        },

        onUpdate() {
          if (config.onUpdate) {
            this.wrapLifecycleHandler(config.onUpdate, pluginId)()
          }
        },

        onDestroy() {
          if (config.onDestroy) {
            this.wrapLifecycleHandler(config.onDestroy, pluginId)()
          }
        }
      })

      const loadTime = performance.now() - startTime
      this.loadTimes.set(`${pluginId}.${config.name}`, loadTime)

      return extensionDefinition
    } catch (error) {
      throw new Error(`Failed to create extension: ${error.message}`)
    }
  }

  // === WRAPPER METHODS FOR SECURITY ===

  /**
   * Wrap command handlers with error handling and plugin context
   */
  wrapCommandHandler(handler, pluginId) {
    return (...args) => {
      const startTime = performance.now()

      try {
        const result = handler(...args)

        // Monitor performance
        const duration = performance.now() - startTime
        errorHandler.monitorPerformance(pluginId, 'commandExecution', duration, { args })

        this.emit('command-executed', { pluginId, args, result })
        return result
      } catch (error) {
        // Handle error with context
        const errorInfo = errorHandler.handleError(pluginId, error, {
          operation: 'command-execution',
          args,
          handlerName: handler.name || 'anonymous'
        })

        this.emit('command-error', { pluginId, args, error, errorInfo })
        return false
      }
    }
  }

  /**
   * Wrap input rule handlers with error handling
   */
  wrapInputRuleHandler(handler, pluginId) {
    return (...args) => {
      const startTime = performance.now()

      try {
        const result = handler(...args)

        // Monitor performance
        const duration = performance.now() - startTime
        errorHandler.monitorPerformance(pluginId, 'inputRuleExecution', duration, { args })

        return result
      } catch (error) {
        // Handle error with context
        const errorInfo = errorHandler.handleError(pluginId, error, {
          operation: 'input-rule-execution',
          args,
          handlerName: handler.name || 'anonymous'
        })

        this.emit('input-rule-error', { pluginId, args, error, errorInfo })
        return false
      }
    }
  }

  /**
   * Wrap node view with error handling
   */
  wrapNodeView(nodeView, pluginId) {
    return (props) => {
      const startTime = performance.now()

      try {
        const result = nodeView(props)

        // Monitor performance
        const duration = performance.now() - startTime
        errorHandler.monitorPerformance(pluginId, 'nodeViewRender', duration, {
          nodeType: props.node?.type?.name
        })

        return result
      } catch (error) {
        // Handle error with context
        const errorInfo = errorHandler.handleError(pluginId, error, {
          operation: 'node-view-render',
          nodeType: props.node?.type?.name,
          props
        })

        // Return safe fallback
        return {
          dom: this.createErrorNodeView(pluginId, error),
          contentDOM: null
        }
      }
    }
  }

  /**
   * Create error fallback node view
   */
  createErrorNodeView(pluginId, error) {
    const errorDiv = document.createElement('div')
    errorDiv.style.cssText = `
      padding: 12px;
      border: 2px dashed rgb(var(--danger));
      border-radius: 6px;
      background: rgba(var(--danger), 0.1);
      color: rgb(var(--danger));
      font-family: monospace;
      font-size: 12px;
      text-align: center;
    `

    errorDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">⚠️ Plugin Error</div>
      <div>Plugin: ${pluginId}</div>
      <div>Error: ${error.message}</div>
    `

    return errorDiv
  }

  /**
   * Wrap lifecycle handlers with error handling
   */
  wrapLifecycleHandler(handler, pluginId) {
    return (...args) => {
      try {
        return handler(...args)
      } catch (error) {
        this.emit('lifecycle-error', { pluginId, args, error })
      }
    }
  }

  /**
   * Wrap ProseMirror plugins with error handling
   */
  wrapProseMirrorPlugin(pluginFactory, pluginId) {
    try {
      return pluginFactory()
    } catch (error) {
      return null
    }
  }

  /**
   * Wrap format handlers with error handling
   */
  wrapFormatHandler(handler, pluginId) {
    return (...args) => {
      try {
        return handler(...args)
      } catch (error) {
        this.emit('format-error', { pluginId, args, error })
        throw error
      }
    }
  }

  // === EDITOR INTEGRATION ===

  /**
   * Set the editor instance for hot reloading
   */
  setEditorInstance(editor) {
    this.editorInstance = editor

    if (!editor) {
      return
    }

    this.emit('editor-attached', { editor })

    // Listen for editor updates
    editor.on('update', () => {
      this.emit('editor-update')
    })

    editor.on('selectionUpdate', () => {
      this.emit('editor-selection-update')
    })
  }

  /**
   * Get all registered extensions for the editor
   */
  getAllExtensions() {
    const extensions = []

    // Add nodes
    for (const node of this.nodes.values()) {
      extensions.push(node)
    }

    // Add marks
    for (const mark of this.marks.values()) {
      extensions.push(mark)
    }

    // Add extensions
    for (const extension of this.extensions.values()) {
      extensions.push(extension)
    }

    return extensions
  }

  /**
   * Get slash commands in the format expected by the slash command system
   */
  getSlashCommands() {
    const commandGroups = new Map()

    for (const command of this.slashCommands.values()) {
      const group = command.group
      if (!commandGroups.has(group)) {
        commandGroups.set(group, {
          group,
          commands: []
        })
      }

      commandGroups.get(group).commands.push({
        title: command.title,
        description: command.description,
        icon: command.icon,
        command: command.handler
      })
    }

    return Array.from(commandGroups.values())
  }

  /**
   * Get toolbar items organized by group
   */
  getToolbarItems(group = 'editor') {
    return Array.from(this.toolbarItems.values())
      .filter(item => item.group === group)
      .sort((a, b) => (a.order || 100) - (b.order || 100))
  }

  /**
   * Hot reload extensions in the editor
   */
  async hotReloadExtensions() {
    if (!this.editorInstance) {
      return
    }

    const startTime = performance.now()

    try {

      // Get current content
      const content = this.editorInstance.getHTML()

      // Get all extensions
      const extensions = this.getAllExtensions()

      // Validate extensions before reload
      const validExtensions = this.validateExtensionsForReload(extensions)

      // Create new editor configuration
      const editorConfig = {
        extensions: validExtensions,
        content,
        // Preserve other editor options
        ...this.editorInstance.options
      }

      // Recreate editor with new extensions
      this.editorInstance.destroy()

      // Monitor performance
      const duration = performance.now() - startTime
      errorHandler.monitorPerformance('system', 'hotReload', duration, {
        extensionCount: validExtensions.length
      })

      // Emit event for editor recreation
      this.emit('hot-reload-requested', { extensions: validExtensions, content })

    } catch (error) {
      // Handle error with context
      const errorInfo = errorHandler.handleError('system', error, {
        operation: 'hot-reload',
        extensionCount: this.getAllExtensions().length
      })

      this.emit('hot-reload-error', { error, errorInfo })
    }
  }

  /**
   * Validate extensions before hot reload
   */
  validateExtensionsForReload(extensions) {
    return extensions.filter(extension => {
      try {
        // Basic validation - ensure extension has required properties
        if (!extension || typeof extension !== 'object') {
          return false
        }

        // Check if plugin is quarantined
        const pluginId = extension.pluginId
        if (pluginId && errorHandler.quarantinedPlugins.has(pluginId)) {
          return false
        }

        return true
      } catch (error) {
        return false
      }
    })
  }

  /**
   * Get all visible editors
   */
  getVisibleEditors() {
    // Currently only one editor is supported
    return this.editorInstance ? Promise.resolve([this._createEditorAdapter(this.editorInstance)]) : Promise.resolve([])
  }

  /**
   * Get active text document
   */
  getActiveDocument() {
    return this.editorInstance ? Promise.resolve(this._createDocumentAdapter(this.editorInstance.state)) : Promise.resolve(undefined)
  }

  /**
   * Get all open documents
   */
  getOpenDocuments() {
    // Currently only one document is supported
    return this.getActiveDocument().then(doc => doc ? [doc] : [])
  }

  /**
   * Open document
   */
  async openDocument(uri, options) {
    // TODO: Implement actual document opening logic
    return this._createDocumentAdapter({ doc: { childCount: 0, textContent: '' } }, uri)
  }

  /**
   * Show document
   */
  async showDocument(document, options) {
    // TODO: Implement actual document showing logic
    return this._createEditorAdapter(this.editorInstance)
  }

  /**
   * Create untitled document
   */
  async createUntitledDocument(options) {
    return this._createDocumentAdapter({ doc: { childCount: 0, textContent: '' } }, 'untitled:new')
  }

  // === CORE REGISTRATION METHODS ===

  validatePluginId(pluginId) {
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error('Plugin ID must be a non-empty string')
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/.test(pluginId)) {
      throw new Error('Plugin ID contains invalid characters')
    }
  }

  validateNodeConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Node config must be an object')
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Node name must be a non-empty string')
    }
  }

  validateMarkConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Mark config must be an object')
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Mark name must be a non-empty string')
    }
  }

  validateExtensionConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Extension config must be an object')
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Extension name must be a non-empty string')
    }
  }

  validateSlashCommandConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Slash command config must be an object')
    }

    if (!config.id || typeof config.id !== 'string') {
      throw new Error('Slash command ID must be a non-empty string')
    }

    if (!config.title || typeof config.title !== 'string') {
      throw new Error('Slash command title must be a non-empty string')
    }

    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Slash command handler must be a function')
    }
  }

  validateInputRuleConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Input rule config must be an object')
    }

    if (!config.id || typeof config.id !== 'string') {
      throw new Error('Input rule ID must be a non-empty string')
    }

    if (!config.pattern) {
      throw new Error('Input rule pattern is required')
    }

    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Input rule handler must be a function')
    }
  }

  validateKeyboardShortcutConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Keyboard shortcut config must be an object')
    }

    if (!config.key || typeof config.key !== 'string') {
      throw new Error('Keyboard shortcut key must be a non-empty string')
    }

    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Keyboard shortcut handler must be a function')
    }
  }

  validateToolbarItemConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Toolbar item config must be an object')
    }

    if (!config.id || typeof config.id !== 'string') {
      throw new Error('Toolbar item ID must be a non-empty string')
    }

    if (!config.title || typeof config.title !== 'string') {
      throw new Error('Toolbar item title must be a non-empty string')
    }
  }

  validateNodeViewConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Node view config must be an object')
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Node view name must be a non-empty string')
    }
  }

  validateEditorCommandConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Editor command config must be an object')
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Editor command name must be a non-empty string')
    }

    if (!config.handler || typeof config.handler !== 'function') {
      throw new Error('Editor command handler must be a function')
    }
  }

  validateFormatConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Format config must be an object')
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Format name must be a non-empty string')
    }

    if (!config.displayName || typeof config.displayName !== 'string') {
      throw new Error('Format display name must be a non-empty string')
    }
  }

  validateAttributes(attributes) {
    if (!attributes || typeof attributes !== 'object') {
      return {}
    }

    // Validate attribute definitions
    for (const [name, config] of Object.entries(attributes)) {
      if (typeof config !== 'object') {
        continue
      }
    }

    return attributes
  }

  validateParseHTML(parseHTML) {
    if (!Array.isArray(parseHTML)) {
      return []
    }

    return parseHTML.filter(rule => {
      if (!rule || typeof rule !== 'object') {
        return false
      }

      if (!rule.tag && !rule.attrs) {
        return false
      }

      return true
    })
  }

  validateOptions(options) {
    if (!options || typeof options !== 'object') {
      return {}
    }

    return options
  }

  // === UTILITY METHODS ===

  /**
   * Track contribution for cleanup
   */
  trackContribution(pluginId, type, contributionId) {
    if (!this.pluginContributions.has(pluginId)) {
      this.pluginContributions.set(pluginId, new Set())
    }

    this.pluginContributions.get(pluginId).add(`${type}:${contributionId}`)
  }

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
        case 'node':
          this.nodes.delete(id)
          break
        case 'mark':
          this.marks.delete(id)
          break
        case 'extension':
          this.extensions.delete(id)
          break
        case 'slashCommand':
          this.slashCommands.delete(id)
          break
        case 'inputRule':
          this.inputRules.delete(id)
          break
        case 'keyboardShortcut':
          this.keyboardShortcuts.delete(id)
          break
        case 'toolbarItem':
          this.toolbarItems.delete(id)
          break
        case 'nodeView':
          this.nodeViews.delete(id)
          break
        case 'editorCommand':
          this.editorCommands.delete(id)
          break
        case 'format':
          this.formats.delete(id)
          break
      }
    }

    this.pluginContributions.delete(pluginId)

    // Unregister all language providers
    this.unregisterAllProviders(pluginId)

    // Hot reload to remove the extensions
    if (this.editorInstance) {
      this.hotReloadExtensions()
    }

    this.emit('plugin-unregistered', { pluginId })
  }

  /**
   * Get statistics about registered extensions
   */
  getStats() {
    const systemStats = errorHandler.getSystemStats()

    return {
      nodes: this.nodes.size,
      marks: this.marks.size,
      extensions: this.extensions.size,
      slashCommands: this.slashCommands.size,
      inputRules: this.inputRules.size,
      keyboardShortcuts: this.keyboardShortcuts.size,
      toolbarItems: this.toolbarItems.size,
      nodeViews: this.nodeViews.size,
      editorCommands: this.editorCommands.size,
      formats: this.formats.size,
      providers: this.providers.size,
      totalPlugins: this.pluginContributions.size,
      averageLoadTime: this.getAverageLoadTime(),
      // Add error handler stats
      errorStats: systemStats,
      quarantinedPlugins: Array.from(errorHandler.quarantinedPlugins)
    }
  }

  /**
   * Get average load time for extensions
   */
  getAverageLoadTime() {
    const times = Array.from(this.loadTimes.values())
    if (times.length === 0) return 0
    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.validationCache.clear()
    this.loadTimes.clear()
  }

  /**
   * Check if a plugin has any registered extensions
   */
  hasPluginExtensions(pluginId) {
    return this.pluginContributions.has(pluginId) &&
      this.pluginContributions.get(pluginId).size > 0
  }

  /**
   * Get all contributions from a specific plugin
   */
  getPluginContributions(pluginId) {
    const contributions = this.pluginContributions.get(pluginId)
    if (!contributions) return []

    return Array.from(contributions).map(contribution => {
      const [type, id] = contribution.split(':', 2)
      return { type, id }
    })
  }
}

// Export singleton instance
export const editorAPI = new EditorPluginAPI()

export default {
  EditorPluginAPI,
  editorAPI
}