/**
 * Syntax Highlighting Plugin - Enhanced code block support
 * 
 * This plugin demonstrates advanced editor extensions by providing:
 * - Enhanced code blocks with syntax highlighting
 * - Language selection and auto-detection
 * - Line numbers and copy functionality
 * - Custom toolbar for code actions
 * - Multiple syntax highlighting themes
 * - Code formatting capabilities
 */

import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Plugin metadata
export const PLUGIN_ID = 'syntax-highlight-plugin'
export const PLUGIN_NAME = 'Syntax Highlighting Plugin'
export const PLUGIN_VERSION = '1.0.0'

/**
 * Syntax Highlighting Plugin Class
 */
export class SyntaxHighlightPlugin {
  constructor() {
    this.id = PLUGIN_ID
    this.name = PLUGIN_NAME
    this.version = PLUGIN_VERSION
    this.description = 'Enhanced code blocks with syntax highlighting'
    this.author = 'Lokus Team'
    
    // Plugin state
    this.hljs = null
    this.loadedLanguages = new Set()
    this.theme = 'github'
    this.availableThemes = [
      'github', 'github-dark', 'vs', 'vs2015', 'atom-one-dark',
      'atom-one-light', 'monokai', 'dracula', 'tomorrow'
    ]
    
    console.log(`[SyntaxHighlightPlugin] Initialized v${this.version}`)
  }

  /**
   * Plugin activation
   */
  async activate() {
    console.log('[SyntaxHighlightPlugin] Activating...')
    
    try {
      // Load highlight.js
      await this.loadHighlightJS()
      
      // Load default theme
      await this.loadTheme(this.theme)
      
      console.log('[SyntaxHighlightPlugin] ✅ Activated successfully')
      return true
    } catch (error) {
      console.error('[SyntaxHighlightPlugin] ❌ Activation failed:', error)
      throw error
    }
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    console.log('[SyntaxHighlightPlugin] Deactivating...')
    
    // Clean up any loaded resources
    this.loadedLanguages.clear()
    
    console.log('[SyntaxHighlightPlugin] ✅ Deactivated successfully')
  }

  /**
   * Register editor extensions
   */
  async registerEditorExtensions(editorAPI) {
    console.log('[SyntaxHighlightPlugin] Registering editor extensions...')
    
    try {
      // Register enhanced code block node
      await this.registerEnhancedCodeBlock(editorAPI)
      
      // Register slash commands
      await this.registerSlashCommands(editorAPI)
      
      // Register toolbar items
      await this.registerToolbarItems(editorAPI)
      
      // Register input rules
      await this.registerInputRules(editorAPI)
      
      // Register keyboard shortcuts
      await this.registerKeyboardShortcuts(editorAPI)
      
      console.log('[SyntaxHighlightPlugin] ✅ All extensions registered successfully')
      
    } catch (error) {
      console.error('[SyntaxHighlightPlugin] ❌ Failed to register extensions:', error)
      throw error
    }
  }

  /**
   * Register enhanced code block node
   */
  async registerEnhancedCodeBlock(editorAPI) {
    const nodeConfig = {
      name: 'enhancedCodeBlock',
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      
      attributes: {
        language: {
          default: null,
          parseHTML: element => element.getAttribute('data-language'),
          renderHTML: attributes => ({ 'data-language': attributes.language })
        },
        filename: {
          default: null,
          parseHTML: element => element.getAttribute('data-filename'),
          renderHTML: attributes => ({ 'data-filename': attributes.filename })
        },
        showLineNumbers: {
          default: true,
          parseHTML: element => element.getAttribute('data-line-numbers') === 'true',
          renderHTML: attributes => ({ 'data-line-numbers': attributes.showLineNumbers })
        },
        theme: {
          default: 'github',
          parseHTML: element => element.getAttribute('data-theme'),
          renderHTML: attributes => ({ 'data-theme': attributes.theme })
        },
        highlightLines: {
          default: null,
          parseHTML: element => element.getAttribute('data-highlight-lines'),
          renderHTML: attributes => ({ 'data-highlight-lines': attributes.highlightLines })
        }
      },
      
      parseHTML: () => [
        {
          tag: 'pre[data-type="enhanced-code-block"]',
          preserveWhitespace: 'full',
          getAttrs: element => ({
            language: element.getAttribute('data-language'),
            filename: element.getAttribute('data-filename'),
            showLineNumbers: element.getAttribute('data-line-numbers') === 'true',
            theme: element.getAttribute('data-theme'),
            highlightLines: element.getAttribute('data-highlight-lines')
          })
        }
      ],
      
      renderHTML: ({ HTMLAttributes, node }) => {
        return [
          'pre',
          {
            'data-type': 'enhanced-code-block',
            'data-language': HTMLAttributes.language,
            'data-filename': HTMLAttributes.filename,
            'data-line-numbers': HTMLAttributes.showLineNumbers,
            'data-theme': HTMLAttributes.theme,
            'data-highlight-lines': HTMLAttributes.highlightLines,
            class: 'enhanced-code-block'
          },
          ['code', {}, 0]
        ]
      },
      
      nodeView: (props) => this.createCodeBlockNodeView(props),
      
      commands: {
        setEnhancedCodeBlock: (attributes = {}) => ({ commands }) => {
          return commands.setNode('enhancedCodeBlock', attributes)
        },
        
        updateCodeBlock: (attributes) => ({ commands }) => {
          return commands.updateAttributes('enhancedCodeBlock', attributes)
        },
        
        toggleLineNumbers: () => ({ commands, state }) => {
          const { selection } = state
          const node = state.doc.nodeAt(selection.from)
          if (node && node.type.name === 'enhancedCodeBlock') {
            return commands.updateAttributes('enhancedCodeBlock', {
              showLineNumbers: !node.attrs.showLineNumbers
            })
          }
          return false
        }
      },
      
      keyboardShortcuts: {
        'Mod-Alt-c': ({ commands }) => {
          return commands.setEnhancedCodeBlock()
        },
        'Mod-Shift-l': ({ commands }) => {
          return commands.toggleLineNumbers()
        }
      }
    }
    
    editorAPI.registerNode(PLUGIN_ID, nodeConfig)
    console.log('[SyntaxHighlightPlugin] ✅ Enhanced code block node registered')
  }

  /**
   * Register slash commands
   */
  async registerSlashCommands(editorAPI) {
    const popularLanguages = [
      { id: 'javascript', name: 'JavaScript', icon: '🟨' },
      { id: 'typescript', name: 'TypeScript', icon: '🔷' },
      { id: 'python', name: 'Python', icon: '🐍' },
      { id: 'java', name: 'Java', icon: '☕' },
      { id: 'cpp', name: 'C++', icon: '⚡' },
      { id: 'rust', name: 'Rust', icon: '🦀' },
      { id: 'go', name: 'Go', icon: '🐹' },
      { id: 'php', name: 'PHP', icon: '🐘' },
      { id: 'ruby', name: 'Ruby', icon: '💎' },
      { id: 'sql', name: 'SQL', icon: '🗃️' }
    ]
    
    const commands = [
      {
        id: 'code-block',
        title: 'Code Block',
        description: 'Insert a code block with syntax highlighting',
        icon: '💻',
        group: 'Code',
        order: 1,
        keywords: ['code', 'block', 'syntax', 'highlight'],
        handler: ({ editor, range }) => {
          editor.chain()
            .focus()
            .deleteRange(range)
            .setEnhancedCodeBlock()
            .run()
        }
      },
      ...popularLanguages.map((lang, index) => ({
        id: `code-${lang.id}`,
        title: `${lang.name} Code`,
        description: `Insert ${lang.name} code block`,
        icon: lang.icon,
        group: 'Code',
        order: 10 + index,
        keywords: ['code', lang.id, lang.name.toLowerCase()],
        handler: ({ editor, range }) => {
          editor.chain()
            .focus()
            .deleteRange(range)
            .setEnhancedCodeBlock({ language: lang.id })
            .run()
        }
      }))
    ]
    
    for (const command of commands) {
      editorAPI.registerSlashCommand(PLUGIN_ID, command)
    }
    
    console.log(`[SyntaxHighlightPlugin] ✅ Registered ${commands.length} slash commands`)
  }

  /**
   * Register toolbar items
   */
  async registerToolbarItems(editorAPI) {
    const toolbarItem = {
      id: 'code-actions',
      type: 'dropdown',
      title: 'Code Actions',
      icon: '💻',
      group: 'code',
      order: 10,
      isActive: ({ editor }) => {
        return editor.isActive('enhancedCodeBlock')
      },
      items: [
        {
          id: 'insert-code-block',
          title: 'Insert Code Block',
          icon: '📝',
          handler: ({ editor }) => {
            editor.commands.setEnhancedCodeBlock()
          }
        },
        {
          id: 'toggle-line-numbers',
          title: 'Toggle Line Numbers',
          icon: '🔢',
          handler: ({ editor }) => {
            editor.commands.toggleLineNumbers()
          }
        },
        {
          id: 'change-language',
          title: 'Change Language',
          icon: '🌐',
          handler: ({ editor }) => {
            this.openLanguageSelector(editor)
          }
        },
        {
          id: 'change-theme',
          title: 'Change Theme',
          icon: '🎨',
          handler: ({ editor }) => {
            this.openThemeSelector(editor)
          }
        }
      ]
    }
    
    editorAPI.registerToolbarItem(PLUGIN_ID, toolbarItem)
    console.log('[SyntaxHighlightPlugin] ✅ Registered toolbar items')
  }

  /**
   * Register input rules
   */
  async registerInputRules(editorAPI) {
    const inputRules = [
      {
        id: 'code-block-fence',
        pattern: /^```([a-z]*)?[\s\n]$/,
        handler: ({ state, range, match, chain }) => {
          const language = match[1] || null
          chain()
            .deleteRange(range)
            .setEnhancedCodeBlock({ language })
            .run()
        }
      },
      {
        id: 'code-block-tilde',
        pattern: /^~~~([a-z]*)?[\s\n]$/,
        handler: ({ state, range, match, chain }) => {
          const language = match[1] || null
          chain()
            .deleteRange(range)
            .setEnhancedCodeBlock({ language })
            .run()
        }
      }
    ]
    
    for (const rule of inputRules) {
      editorAPI.registerInputRule(PLUGIN_ID, rule)
    }
    
    console.log(`[SyntaxHighlightPlugin] ✅ Registered ${inputRules.length} input rules`)
  }

  /**
   * Register keyboard shortcuts
   */
  async registerKeyboardShortcuts(editorAPI) {
    const shortcuts = [
      {
        key: 'Mod-Alt-c',
        handler: ({ editor }) => {
          return editor.commands.setEnhancedCodeBlock()
        }
      },
      {
        key: 'Mod-Shift-l',
        handler: ({ editor }) => {
          return editor.commands.toggleLineNumbers()
        }
      }
    ]
    
    for (const shortcut of shortcuts) {
      editorAPI.registerKeyboardShortcut(PLUGIN_ID, shortcut)
    }
    
    console.log(`[SyntaxHighlightPlugin] ✅ Registered ${shortcuts.length} keyboard shortcuts`)
  }

  /**
   * Create enhanced code block node view
   */
  createCodeBlockNodeView({ node, view, getPos, editor }) {
    const dom = document.createElement('div')
    dom.className = 'enhanced-code-block-wrapper'
    dom.style.cssText = `
      position: relative;
      margin: 16px 0;
      border: 1px solid rgb(var(--border));
      border-radius: 8px;
      overflow: hidden;
      background: rgb(var(--panel));
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    `
    
    // Create header
    const header = document.createElement('div')
    header.className = 'code-block-header'
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgb(var(--bg));
      border-bottom: 1px solid rgb(var(--border));
      font-size: 12px;
    `
    
    // Language indicator
    const languageIndicator = document.createElement('div')
    languageIndicator.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgb(var(--muted));
    `
    
    const languageIcon = document.createElement('span')
    languageIcon.textContent = this.getLanguageIcon(node.attrs.language)
    
    const languageText = document.createElement('span')
    languageText.textContent = this.getLanguageName(node.attrs.language)
    
    languageIndicator.appendChild(languageIcon)
    languageIndicator.appendChild(languageText)
    
    // Action buttons
    const actions = document.createElement('div')
    actions.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `
    
    // Copy button
    const copyButton = document.createElement('button')
    copyButton.textContent = '📋'
    copyButton.title = 'Copy code'
    copyButton.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: rgb(var(--muted));
      font-size: 14px;
    `
    
    copyButton.addEventListener('click', () => {
      this.copyCodeToClipboard(contentDOM.textContent)
    })
    
    // Settings button
    const settingsButton = document.createElement('button')
    settingsButton.textContent = '⚙️'
    settingsButton.title = 'Code block settings'
    settingsButton.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: rgb(var(--muted));
      font-size: 14px;
    `
    
    settingsButton.addEventListener('click', () => {
      this.openCodeBlockSettings(node, getPos, editor)
    })
    
    actions.appendChild(copyButton)
    actions.appendChild(settingsButton)
    
    header.appendChild(languageIndicator)
    header.appendChild(actions)
    
    // Create content area
    const contentWrapper = document.createElement('div')
    contentWrapper.style.cssText = `
      position: relative;
      overflow: auto;
    `
    
    // Line numbers (optional)
    let lineNumbers = null
    if (node.attrs.showLineNumbers) {
      lineNumbers = document.createElement('div')
      lineNumbers.className = 'line-numbers'
      lineNumbers.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        padding: 16px 8px;
        background: rgb(var(--bg));
        border-right: 1px solid rgb(var(--border));
        color: rgb(var(--muted));
        font-size: 12px;
        line-height: 1.5;
        user-select: none;
        min-width: 40px;
        text-align: right;
      `
      contentWrapper.appendChild(lineNumbers)
    }
    
    // Create content DOM for TipTap
    const contentDOM = document.createElement('pre')
    contentDOM.style.cssText = `
      margin: 0;
      padding: 16px;
      ${node.attrs.showLineNumbers ? 'padding-left: 60px;' : ''}
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      color: rgb(var(--text));
      background: transparent;
      overflow: visible;
      white-space: pre-wrap;
    `
    
    contentWrapper.appendChild(contentDOM)
    
    // Assemble node view
    dom.appendChild(header)
    dom.appendChild(contentWrapper)
    
    // Apply syntax highlighting
    this.applySyntaxHighlighting(contentDOM, node.attrs.language)
    
    // Update line numbers
    if (lineNumbers) {
      this.updateLineNumbers(lineNumbers, contentDOM)
    }
    
    return {
      dom,
      contentDOM,
      update: (updatedNode) => {
        if (updatedNode.type.name !== 'enhancedCodeBlock') return false
        
        // Update language indicator
        languageIcon.textContent = this.getLanguageIcon(updatedNode.attrs.language)
        languageText.textContent = this.getLanguageName(updatedNode.attrs.language)
        
        // Re-apply syntax highlighting if language changed
        if (updatedNode.attrs.language !== node.attrs.language) {
          this.applySyntaxHighlighting(contentDOM, updatedNode.attrs.language)
        }
        
        // Update line numbers if visibility changed
        if (updatedNode.attrs.showLineNumbers !== node.attrs.showLineNumbers) {
          if (updatedNode.attrs.showLineNumbers && !lineNumbers) {
            // Add line numbers
            lineNumbers = document.createElement('div')
            lineNumbers.className = 'line-numbers'
            lineNumbers.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              padding: 16px 8px;
              background: rgb(var(--bg));
              border-right: 1px solid rgb(var(--border));
              color: rgb(var(--muted));
              font-size: 12px;
              line-height: 1.5;
              user-select: none;
              min-width: 40px;
              text-align: right;
            `
            contentWrapper.insertBefore(lineNumbers, contentDOM)
            contentDOM.style.paddingLeft = '60px'
            this.updateLineNumbers(lineNumbers, contentDOM)
          } else if (!updatedNode.attrs.showLineNumbers && lineNumbers) {
            // Remove line numbers
            contentWrapper.removeChild(lineNumbers)
            lineNumbers = null
            contentDOM.style.paddingLeft = '16px'
          }
        }
        
        // Update line numbers if they exist
        if (lineNumbers) {
          this.updateLineNumbers(lineNumbers, contentDOM)
        }
        
        return true
      }
    }
  }

  /**
   * Apply syntax highlighting using highlight.js
   */
  async applySyntaxHighlighting(element, language) {
    if (!this.hljs || !language) return
    
    try {
      // Ensure language is loaded
      if (!this.loadedLanguages.has(language)) {
        await this.loadLanguage(language)
      }
      
      // Apply highlighting
      const result = this.hljs.highlight(element.textContent, { language })
      element.innerHTML = result.value
      
      // Add language class
      element.className = `hljs language-${language}`
      
    } catch (error) {
      console.warn(`[SyntaxHighlightPlugin] Failed to highlight ${language}:`, error)
      // Fallback: just add language class without highlighting
      element.className = `language-${language}`
    }
  }

  /**
   * Update line numbers
   */
  updateLineNumbers(lineNumbersElement, contentElement) {
    const lines = contentElement.textContent.split('\n')
    const lineCount = lines.length
    
    let lineNumbersHTML = ''
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHTML += `<div>${i}</div>`
    }
    
    lineNumbersElement.innerHTML = lineNumbersHTML
  }

  /**
   * Get language icon
   */
  getLanguageIcon(language) {
    const icons = {
      javascript: '🟨',
      typescript: '🔷',
      python: '🐍',
      java: '☕',
      cpp: '⚡',
      c: '⚡',
      rust: '🦀',
      go: '🐹',
      php: '🐘',
      ruby: '💎',
      sql: '🗃️',
      html: '🌐',
      css: '🎨',
      json: '📄',
      xml: '📋',
      yaml: '📝',
      markdown: '📖',
      bash: '🐚',
      shell: '🐚',
      powershell: '💻'
    }
    
    return icons[language] || '📄'
  }

  /**
   * Get language display name
   */
  getLanguageName(language) {
    if (!language) return 'Plain Text'
    
    const names = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      rust: 'Rust',
      go: 'Go',
      php: 'PHP',
      ruby: 'Ruby',
      sql: 'SQL',
      html: 'HTML',
      css: 'CSS',
      json: 'JSON',
      xml: 'XML',
      yaml: 'YAML',
      markdown: 'Markdown',
      bash: 'Bash',
      shell: 'Shell',
      powershell: 'PowerShell'
    }
    
    return names[language] || language.charAt(0).toUpperCase() + language.slice(1)
  }

  /**
   * Copy code to clipboard
   */
  async copyCodeToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      console.log('[SyntaxHighlightPlugin] Code copied to clipboard')
      // Could show a toast notification here
    } catch (error) {
      console.error('[SyntaxHighlightPlugin] Failed to copy to clipboard:', error)
      // Fallback: select text
      this.selectText(text)
    }
  }

  /**
   * Select text fallback for copy
   */
  selectText(text) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      console.log('[SyntaxHighlightPlugin] Code copied using fallback method')
    } catch (error) {
      console.error('[SyntaxHighlightPlugin] Fallback copy failed:', error)
    }
    
    document.body.removeChild(textArea)
  }

  /**
   * Open language selector modal
   */
  openLanguageSelector(editor) {
    // Implementation would show a modal for language selection
    console.log('[SyntaxHighlightPlugin] Opening language selector...')
  }

  /**
   * Open theme selector modal
   */
  openThemeSelector(editor) {
    // Implementation would show a modal for theme selection
    console.log('[SyntaxHighlightPlugin] Opening theme selector...')
  }

  /**
   * Open code block settings modal
   */
  openCodeBlockSettings(node, getPos, editor) {
    // Implementation would show a modal for code block settings
    console.log('[SyntaxHighlightPlugin] Opening code block settings...')
  }

  /**
   * Load highlight.js library
   */
  async loadHighlightJS() {
    if (this.hljs) return
    
    try {
      console.log('[SyntaxHighlightPlugin] Loading highlight.js...')
      
      // Check if already loaded
      if (window.hljs) {
        this.hljs = window.hljs
        return
      }
      
      // Load from CDN
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js'
      
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
      })
      
      document.head.appendChild(script)
      await loadPromise
      
      this.hljs = window.hljs
      console.log('[SyntaxHighlightPlugin] ✅ highlight.js loaded successfully')
      
    } catch (error) {
      console.error('[SyntaxHighlightPlugin] ❌ Failed to load highlight.js:', error)
      throw new Error(`Failed to load highlight.js: ${error.message}`)
    }
  }

  /**
   * Load specific language for highlight.js
   */
  async loadLanguage(language) {
    if (this.loadedLanguages.has(language)) return
    
    try {
      // Most common languages are included in the core bundle
      // For others, we might need to load them separately
      this.loadedLanguages.add(language)
      console.log(`[SyntaxHighlightPlugin] Language ${language} ready`)
      
    } catch (error) {
      console.warn(`[SyntaxHighlightPlugin] Failed to load language ${language}:`, error)
    }
  }

  /**
   * Load syntax highlighting theme
   */
  async loadTheme(themeName) {
    try {
      console.log(`[SyntaxHighlightPlugin] Loading theme: ${themeName}`)
      
      // Remove existing theme
      const existingTheme = document.getElementById('hljs-theme')
      if (existingTheme) {
        existingTheme.remove()
      }
      
      // Load new theme
      const link = document.createElement('link')
      link.id = 'hljs-theme'
      link.rel = 'stylesheet'
      link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/${themeName}.min.css`
      
      document.head.appendChild(link)
      this.theme = themeName
      
      console.log(`[SyntaxHighlightPlugin] ✅ Theme ${themeName} loaded`)
      
    } catch (error) {
      console.error(`[SyntaxHighlightPlugin] ❌ Failed to load theme ${themeName}:`, error)
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      name: this.name,
      version: this.version,
      hljsLoaded: !!this.hljs,
      loadedLanguages: Array.from(this.loadedLanguages),
      currentTheme: this.theme,
      availableThemes: this.availableThemes
    }
  }
}

// Export plugin instance
export default new SyntaxHighlightPlugin()