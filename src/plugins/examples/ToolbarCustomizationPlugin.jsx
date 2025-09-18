/**
 * Toolbar Customization Plugin - Example of toolbar extension capabilities
 * 
 * This plugin demonstrates how to create custom toolbar functionality:
 * - Custom toolbar buttons and dropdowns
 * - Dynamic toolbar state management
 * - Toolbar groups and organization
 * - Context-sensitive toolbar items
 * - Custom formatting shortcuts
 * - Toolbar preferences and persistence
 */

// Plugin metadata
export const PLUGIN_ID = 'toolbar-customization-plugin'
export const PLUGIN_NAME = 'Toolbar Customization Plugin'
export const PLUGIN_VERSION = '1.0.0'

/**
 * Toolbar Customization Plugin Class
 */
export class ToolbarCustomizationPlugin {
  constructor() {
    this.id = PLUGIN_ID
    this.name = PLUGIN_NAME
    this.version = PLUGIN_VERSION
    this.description = 'Adds custom toolbar functionality and formatting options'
    this.author = 'Lokus Team'
    
    // Plugin state
    this.toolbarSettings = {
      showWordCount: true,
      showFormatting: true,
      showAdvanced: false,
      compactMode: false
    }
    
    console.log(`[ToolbarCustomizationPlugin] Initialized v${this.version}`)
  }

  /**
   * Plugin activation
   */
  async activate() {
    console.log('[ToolbarCustomizationPlugin] Activating...')
    
    try {
      // Load saved toolbar settings
      await this.loadToolbarSettings()
      
      console.log('[ToolbarCustomizationPlugin] ✅ Activated successfully')
      return true
    } catch (error) {
      console.error('[ToolbarCustomizationPlugin] ❌ Activation failed:', error)
      throw error
    }
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    console.log('[ToolbarCustomizationPlugin] Deactivating...')
    
    // Save current settings
    await this.saveToolbarSettings()
    
    console.log('[ToolbarCustomizationPlugin] ✅ Deactivated successfully')
  }

  /**
   * Register editor extensions
   */
  async registerEditorExtensions(editorAPI) {
    console.log('[ToolbarCustomizationPlugin] Registering editor extensions...')
    
    try {
      // Register formatting toolbar items
      await this.registerFormattingToolbar(editorAPI)
      
      // Register advanced toolbar items
      await this.registerAdvancedToolbar(editorAPI)
      
      // Register status toolbar items
      await this.registerStatusToolbar(editorAPI)
      
      // Register toolbar management items
      await this.registerToolbarManagement(editorAPI)
      
      // Register custom formats
      await this.registerCustomFormats(editorAPI)
      
      // Register keyboard shortcuts
      await this.registerKeyboardShortcuts(editorAPI)
      
      console.log('[ToolbarCustomizationPlugin] ✅ All extensions registered successfully')
      
    } catch (error) {
      console.error('[ToolbarCustomizationPlugin] ❌ Failed to register extensions:', error)
      throw error
    }
  }

  /**
   * Register formatting toolbar items
   */
  async registerFormattingToolbar(editorAPI) {
    const formattingItems = [
      {
        id: 'text-formatting',
        type: 'dropdown',
        title: 'Text Formatting',
        icon: '🎨',
        group: 'formatting',
        order: 10,
        when: () => this.toolbarSettings.showFormatting,
        items: [
          {
            id: 'bold',
            title: 'Bold',
            icon: '𝐁',
            shortcut: 'Mod+B',
            handler: ({ editor }) => editor.commands.toggleBold(),
            isActive: ({ editor }) => editor.isActive('bold')
          },
          {
            id: 'italic',
            title: 'Italic',
            icon: '𝐼',
            shortcut: 'Mod+I',
            handler: ({ editor }) => editor.commands.toggleItalic(),
            isActive: ({ editor }) => editor.isActive('italic')
          },
          {
            id: 'underline',
            title: 'Underline',
            icon: 'U̲',
            shortcut: 'Mod+U',
            handler: ({ editor }) => editor.commands.toggleUnderline(),
            isActive: ({ editor }) => editor.isActive('underline')
          },
          {
            id: 'separator1',
            type: 'separator'
          },
          {
            id: 'text-color',
            title: 'Text Color',
            icon: '🌈',
            handler: ({ editor }) => this.openColorPicker(editor, 'text')
          },
          {
            id: 'background-color',
            title: 'Background Color',
            icon: '🎯',
            handler: ({ editor }) => this.openColorPicker(editor, 'background')
          },
          {
            id: 'separator2',
            type: 'separator'
          },
          {
            id: 'clear-formatting',
            title: 'Clear Formatting',
            icon: '🧹',
            handler: ({ editor }) => editor.commands.clearNodes().unsetAllMarks()
          }
        ]
      },
      {
        id: 'quick-formatting',
        type: 'button',
        title: 'Quick Format',
        icon: '✨',
        group: 'formatting',
        order: 15,
        handler: ({ editor }) => this.openQuickFormatMenu(editor),
        when: () => this.toolbarSettings.showFormatting
      }
    ]
    
    for (const item of formattingItems) {
      editorAPI.registerToolbarItem(PLUGIN_ID, item)
    }
    
    console.log(`[ToolbarCustomizationPlugin] ✅ Registered ${formattingItems.length} formatting toolbar items`)
  }

  /**
   * Register advanced toolbar items
   */
  async registerAdvancedToolbar(editorAPI) {
    const advancedItems = [
      {
        id: 'advanced-tools',
        type: 'dropdown',
        title: 'Advanced Tools',
        icon: '🔧',
        group: 'advanced',
        order: 50,
        when: () => this.toolbarSettings.showAdvanced,
        items: [
          {
            id: 'word-count',
            title: 'Word Count',
            icon: '📊',
            handler: ({ editor }) => this.showWordCount(editor)
          },
          {
            id: 'reading-time',
            title: 'Reading Time',
            icon: '⏱️',
            handler: ({ editor }) => this.showReadingTime(editor)
          },
          {
            id: 'document-stats',
            title: 'Document Statistics',
            icon: '📈',
            handler: ({ editor }) => this.showDocumentStats(editor)
          },
          {
            id: 'separator1',
            type: 'separator'
          },
          {
            id: 'find-replace',
            title: 'Find & Replace',
            icon: '🔍',
            shortcut: 'Mod+F',
            handler: ({ editor }) => this.openFindReplace(editor)
          },
          {
            id: 'goto-line',
            title: 'Go to Line',
            icon: '🎯',
            shortcut: 'Mod+G',
            handler: ({ editor }) => this.openGoToLine(editor)
          },
          {
            id: 'separator2',
            type: 'separator'
          },
          {
            id: 'export-options',
            title: 'Export Options',
            icon: '📤',
            handler: ({ editor }) => this.openExportOptions(editor)
          },
          {
            id: 'import-options',
            title: 'Import Options',
            icon: '📥',
            handler: ({ editor }) => this.openImportOptions(editor)
          }
        ]
      },
      {
        id: 'document-outline',
        type: 'button',
        title: 'Document Outline',
        icon: '📋',
        group: 'advanced',
        order: 55,
        handler: ({ editor }) => this.toggleDocumentOutline(editor),
        isActive: ({ editor }) => this.isDocumentOutlineVisible(),
        when: () => this.toolbarSettings.showAdvanced
      }
    ]
    
    for (const item of advancedItems) {
      editorAPI.registerToolbarItem(PLUGIN_ID, item)
    }
    
    console.log(`[ToolbarCustomizationPlugin] ✅ Registered ${advancedItems.length} advanced toolbar items`)
  }

  /**
   * Register status toolbar items
   */
  async registerStatusToolbar(editorAPI) {
    const statusItems = [
      {
        id: 'word-count-status',
        type: 'status',
        title: 'Word Count',
        group: 'status',
        order: 10,
        render: ({ editor }) => this.renderWordCount(editor),
        when: () => this.toolbarSettings.showWordCount
      },
      {
        id: 'cursor-position',
        type: 'status',
        title: 'Cursor Position',
        group: 'status',
        order: 15,
        render: ({ editor }) => this.renderCursorPosition(editor)
      },
      {
        id: 'document-mode',
        type: 'status',
        title: 'Document Mode',
        group: 'status',
        order: 20,
        render: ({ editor }) => this.renderDocumentMode(editor)
      }
    ]
    
    for (const item of statusItems) {
      editorAPI.registerToolbarItem(PLUGIN_ID, item)
    }
    
    console.log(`[ToolbarCustomizationPlugin] ✅ Registered ${statusItems.length} status toolbar items`)
  }

  /**
   * Register toolbar management items
   */
  async registerToolbarManagement(editorAPI) {
    const managementItem = {
      id: 'toolbar-settings',
      type: 'button',
      title: 'Toolbar Settings',
      icon: '⚙️',
      group: 'settings',
      order: 100,
      handler: ({ editor }) => this.openToolbarSettings(editor)
    }
    
    editorAPI.registerToolbarItem(PLUGIN_ID, managementItem)
    
    console.log('[ToolbarCustomizationPlugin] ✅ Registered toolbar management items')
  }

  /**
   * Register custom formats
   */
  async registerCustomFormats(editorAPI) {
    const customFormats = [
      {
        name: 'smallCaps',
        displayName: 'Small Caps Format',
        extensions: ['.txt'],
        export: (content) => {
          // Convert text to small caps format
          return content.replace(/[a-z]/g, (char) => char.toUpperCase())
        }
      },
      {
        name: 'cleanText',
        displayName: 'Clean Text Format',
        extensions: ['.txt'],
        export: (content) => {
          // Strip all formatting and return plain text
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = content
          return tempDiv.textContent || tempDiv.innerText || ''
        }
      }
    ]
    
    for (const format of customFormats) {
      editorAPI.registerFormat(PLUGIN_ID, format)
    }
    
    console.log(`[ToolbarCustomizationPlugin] ✅ Registered ${customFormats.length} custom formats`)
  }

  /**
   * Register keyboard shortcuts
   */
  async registerKeyboardShortcuts(editorAPI) {
    const shortcuts = [
      {
        key: 'Mod+Shift+f',
        handler: ({ editor }) => this.openQuickFormatMenu(editor)
      },
      {
        key: 'Mod+Shift+s',
        handler: ({ editor }) => this.showDocumentStats(editor)
      },
      {
        key: 'Mod+Shift+o',
        handler: ({ editor }) => this.toggleDocumentOutline(editor)
      },
      {
        key: 'Alt+Shift+t',
        handler: ({ editor }) => this.openToolbarSettings(editor)
      }
    ]
    
    for (const shortcut of shortcuts) {
      editorAPI.registerKeyboardShortcut(PLUGIN_ID, shortcut)
    }
    
    console.log(`[ToolbarCustomizationPlugin] ✅ Registered ${shortcuts.length} keyboard shortcuts`)
  }

  // === TOOLBAR FUNCTIONALITY ===

  /**
   * Open color picker
   */
  openColorPicker(editor, type) {
    console.log(`[ToolbarCustomizationPlugin] Opening ${type} color picker`)
    
    // Create color picker modal
    const colors = [
      '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
      '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
      '#ff6600', '#ff9900', '#99ff00', '#00ff99', '#0099ff', '#9900ff'
    ]
    
    const overlay = this.createModal('Color Picker', '400px')
    const content = overlay.querySelector('.modal-content')
    
    const colorGrid = document.createElement('div')
    colorGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      padding: 16px;
    `
    
    colors.forEach(color => {
      const colorButton = document.createElement('button')
      colorButton.style.cssText = `
        width: 40px;
        height: 40px;
        border: 2px solid rgb(var(--border));
        border-radius: 6px;
        background: ${color};
        cursor: pointer;
        transition: transform 0.2s ease;
      `
      
      colorButton.addEventListener('click', () => {
        if (type === 'text') {
          editor.commands.setColor(color)
        } else {
          editor.commands.setHighlight({ color })
        }
        document.body.removeChild(overlay)
      })
      
      colorButton.addEventListener('mouseenter', () => {
        colorButton.style.transform = 'scale(1.1)'
      })
      
      colorButton.addEventListener('mouseleave', () => {
        colorButton.style.transform = 'scale(1)'
      })
      
      colorGrid.appendChild(colorButton)
    })
    
    content.appendChild(colorGrid)
  }

  /**
   * Open quick format menu
   */
  openQuickFormatMenu(editor) {
    console.log('[ToolbarCustomizationPlugin] Opening quick format menu')
    
    const overlay = this.createModal('Quick Format', '300px')
    const content = overlay.querySelector('.modal-content')
    
    const formatOptions = [
      { name: 'Title Case', action: () => this.applyTitleCase(editor) },
      { name: 'UPPER CASE', action: () => this.applyUpperCase(editor) },
      { name: 'lower case', action: () => this.applyLowerCase(editor) },
      { name: 'Remove Extra Spaces', action: () => this.removeExtraSpaces(editor) },
      { name: 'Smart Quotes', action: () => this.applySmartQuotes(editor) },
      { name: 'Clean Paste', action: () => this.cleanPastedContent(editor) }
    ]
    
    const optionsList = document.createElement('div')
    optionsList.style.cssText = `
      padding: 16px;
    `
    
    formatOptions.forEach(option => {
      const button = document.createElement('button')
      button.textContent = option.name
      button.style.cssText = `
        display: block;
        width: 100%;
        padding: 12px;
        margin-bottom: 8px;
        border: 1px solid rgb(var(--border));
        border-radius: 6px;
        background: rgb(var(--panel));
        color: rgb(var(--text));
        cursor: pointer;
        text-align: left;
        transition: background-color 0.2s ease;
      `
      
      button.addEventListener('click', () => {
        option.action()
        document.body.removeChild(overlay)
      })
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgb(var(--accent) / 0.1)'
      })
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'rgb(var(--panel))'
      })
      
      optionsList.appendChild(button)
    })
    
    content.appendChild(optionsList)
  }

  /**
   * Show word count
   */
  showWordCount(editor) {
    const stats = this.getDocumentStats(editor)
    
    const overlay = this.createModal('Document Statistics', '400px')
    const content = overlay.querySelector('.modal-content')
    
    const statsHTML = `
      <div style="padding: 20px; font-size: 16px; line-height: 1.6;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <strong>Words:</strong> ${stats.words.toLocaleString()}
          </div>
          <div>
            <strong>Characters:</strong> ${stats.characters.toLocaleString()}
          </div>
          <div>
            <strong>Characters (no spaces):</strong> ${stats.charactersNoSpaces.toLocaleString()}
          </div>
          <div>
            <strong>Paragraphs:</strong> ${stats.paragraphs.toLocaleString()}
          </div>
          <div>
            <strong>Sentences:</strong> ${stats.sentences.toLocaleString()}
          </div>
          <div>
            <strong>Reading time:</strong> ${stats.readingTime}
          </div>
        </div>
      </div>
    `
    
    content.innerHTML = statsHTML
  }

  /**
   * Show reading time
   */
  showReadingTime(editor) {
    const stats = this.getDocumentStats(editor)
    alert(`Estimated reading time: ${stats.readingTime}`)
  }

  /**
   * Show document stats
   */
  showDocumentStats(editor) {
    this.showWordCount(editor)
  }

  /**
   * Toggle document outline
   */
  toggleDocumentOutline(editor) {
    console.log('[ToolbarCustomizationPlugin] Toggling document outline')
    // Implementation would show/hide a document outline panel
  }

  /**
   * Open toolbar settings
   */
  openToolbarSettings(editor) {
    console.log('[ToolbarCustomizationPlugin] Opening toolbar settings')
    
    const overlay = this.createModal('Toolbar Settings', '500px')
    const content = overlay.querySelector('.modal-content')
    
    const settingsForm = document.createElement('div')
    settingsForm.style.cssText = 'padding: 20px;'
    
    const settings = [
      { key: 'showWordCount', label: 'Show Word Count', type: 'checkbox' },
      { key: 'showFormatting', label: 'Show Formatting Tools', type: 'checkbox' },
      { key: 'showAdvanced', label: 'Show Advanced Tools', type: 'checkbox' },
      { key: 'compactMode', label: 'Compact Mode', type: 'checkbox' }
    ]
    
    settings.forEach(setting => {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 16px;
      `
      
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = setting.key
      checkbox.checked = this.toolbarSettings[setting.key]
      checkbox.style.marginRight = '8px'
      
      const label = document.createElement('label')
      label.htmlFor = setting.key
      label.textContent = setting.label
      label.style.cursor = 'pointer'
      
      wrapper.appendChild(checkbox)
      wrapper.appendChild(label)
      settingsForm.appendChild(wrapper)
    })
    
    // Save button
    const saveButton = document.createElement('button')
    saveButton.textContent = 'Save Settings'
    saveButton.style.cssText = `
      padding: 10px 20px;
      background: rgb(var(--accent));
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 16px;
    `
    
    saveButton.addEventListener('click', () => {
      settings.forEach(setting => {
        const checkbox = document.getElementById(setting.key)
        this.toolbarSettings[setting.key] = checkbox.checked
      })
      
      this.saveToolbarSettings()
      document.body.removeChild(overlay)
      
      // Trigger toolbar refresh
      console.log('[ToolbarCustomizationPlugin] Toolbar settings saved')
    })
    
    settingsForm.appendChild(saveButton)
    content.appendChild(settingsForm)
  }

  // === UTILITY METHODS ===

  /**
   * Create modal overlay
   */
  createModal(title, width = '400px') {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `
    
    const modal = document.createElement('div')
    modal.className = 'modal-content'
    modal.style.cssText = `
      background: rgb(var(--panel));
      border: 1px solid rgb(var(--border));
      border-radius: 12px;
      width: ${width};
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `
    
    const header = document.createElement('div')
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid rgb(var(--border));
      background: rgb(var(--bg));
      border-radius: 12px 12px 0 0;
    `
    
    const titleElement = document.createElement('h3')
    titleElement.textContent = title
    titleElement.style.cssText = `
      margin: 0;
      color: rgb(var(--text));
      font-size: 18px;
      font-weight: 600;
    `
    
    header.appendChild(titleElement)
    modal.appendChild(header)
    overlay.appendChild(modal)
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay)
      }
    })
    
    // Close on escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    
    document.body.appendChild(overlay)
    return overlay
  }

  /**
   * Get document statistics
   */
  getDocumentStats(editor) {
    const text = editor.getText()
    const words = text.split(/\s+/).filter(word => word.length > 0).length
    const characters = text.length
    const charactersNoSpaces = text.replace(/\s/g, '').length
    const paragraphs = text.split(/\n\s*\n/).length
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    
    // Estimate reading time (200 words per minute average)
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200))
    const readingTime = readingTimeMinutes === 1 ? '1 minute' : `${readingTimeMinutes} minutes`
    
    return {
      words,
      characters,
      charactersNoSpaces,
      paragraphs,
      sentences,
      readingTime
    }
  }

  /**
   * Render word count for status bar
   */
  renderWordCount(editor) {
    const stats = this.getDocumentStats(editor)
    return `${stats.words} words`
  }

  /**
   * Render cursor position for status bar
   */
  renderCursorPosition(editor) {
    // This would require access to the editor's selection state
    return 'Line 1, Col 1'
  }

  /**
   * Render document mode for status bar
   */
  renderDocumentMode(editor) {
    return 'Edit Mode'
  }

  /**
   * Check if document outline is visible
   */
  isDocumentOutlineVisible() {
    return false // Placeholder
  }

  /**
   * Apply title case formatting
   */
  applyTitleCase(editor) {
    // Implementation would apply title case to selected text
    console.log('[ToolbarCustomizationPlugin] Applying title case')
  }

  /**
   * Apply upper case formatting
   */
  applyUpperCase(editor) {
    // Implementation would apply upper case to selected text
    console.log('[ToolbarCustomizationPlugin] Applying upper case')
  }

  /**
   * Apply lower case formatting
   */
  applyLowerCase(editor) {
    // Implementation would apply lower case to selected text
    console.log('[ToolbarCustomizationPlugin] Applying lower case')
  }

  /**
   * Remove extra spaces
   */
  removeExtraSpaces(editor) {
    // Implementation would remove extra spaces from selected text
    console.log('[ToolbarCustomizationPlugin] Removing extra spaces')
  }

  /**
   * Apply smart quotes
   */
  applySmartQuotes(editor) {
    // Implementation would convert straight quotes to smart quotes
    console.log('[ToolbarCustomizationPlugin] Applying smart quotes')
  }

  /**
   * Clean pasted content
   */
  cleanPastedContent(editor) {
    // Implementation would clean formatting from pasted content
    console.log('[ToolbarCustomizationPlugin] Cleaning pasted content')
  }

  /**
   * Open find and replace
   */
  openFindReplace(editor) {
    console.log('[ToolbarCustomizationPlugin] Opening find and replace')
  }

  /**
   * Open go to line
   */
  openGoToLine(editor) {
    console.log('[ToolbarCustomizationPlugin] Opening go to line')
  }

  /**
   * Open export options
   */
  openExportOptions(editor) {
    console.log('[ToolbarCustomizationPlugin] Opening export options')
  }

  /**
   * Open import options
   */
  openImportOptions(editor) {
    console.log('[ToolbarCustomizationPlugin] Opening import options')
  }

  /**
   * Load toolbar settings
   */
  async loadToolbarSettings() {
    try {
      const stored = localStorage.getItem(`${PLUGIN_ID}-settings`)
      if (stored) {
        this.toolbarSettings = { ...this.toolbarSettings, ...JSON.parse(stored) }
      }
    } catch (error) {
      console.warn('[ToolbarCustomizationPlugin] Failed to load settings:', error)
    }
  }

  /**
   * Save toolbar settings
   */
  async saveToolbarSettings() {
    try {
      localStorage.setItem(`${PLUGIN_ID}-settings`, JSON.stringify(this.toolbarSettings))
    } catch (error) {
      console.warn('[ToolbarCustomizationPlugin] Failed to save settings:', error)
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      name: this.name,
      version: this.version,
      toolbarSettings: this.toolbarSettings
    }
  }
}

// Export plugin instance
export default new ToolbarCustomizationPlugin()