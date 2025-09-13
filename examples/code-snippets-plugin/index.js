/**
 * Code Snippets Plugin for Lokus
 * 
 * This plugin demonstrates:
 * - Slash command registration and handling
 * - Text expansion functionality
 * - Custom settings and configuration
 * - Snippet storage and management
 * - Dynamic UI creation and management
 * - Template variables and placeholders
 */

import { BasePlugin } from '../../src/plugins/core/BasePlugin.js';

export default class CodeSnippetsPlugin extends BasePlugin {
  constructor() {
    super();
    this.snippets = new Map();
    this.expansionTrigger = '::';
    this.isExpanding = false;
    this.panelId = null;
  }

  /**
   * Plugin activation - setup commands and text expansion
   */
  async activate() {
    await super.activate();
    
    try {
      // Load user settings
      await this.loadSettings();
      
      // Load snippets from storage
      await this.loadSnippets();
      
      // Register commands
      this.registerCommands();
      
      // Register slash commands
      this.registerSlashCommands();
      
      // Setup text expansion if enabled
      const textExpansionEnabled = await this.getSetting('enableTextExpansion', true);
      if (textExpansionEnabled) {
        this.setupTextExpansion();
      }
      
      // Create management panel
      this.setupUI();
      
      this.showNotification(
        `Code Snippets activated with ${this.snippets.size} snippets`,
        'info'
      );
      
    } catch (error) {
      this.logger.error('Failed to activate Code Snippets plugin:', error);
      this.showNotification('Failed to activate Code Snippets plugin', 'error');
      throw error;
    }
  }

  /**
   * Load plugin settings and update trigger
   */
  async loadSettings() {
    this.expansionTrigger = await this.getSetting('expansionTrigger', '::');
    this.logger.info('Settings loaded, expansion trigger:', this.expansionTrigger);
  }

  /**
   * Load snippets from storage or initialize with defaults
   */
  async loadSnippets() {
    try {
      // Load custom snippets from plugin storage
      const storedSnippets = await this.getSetting('customSnippets', {});
      
      // Start with default snippets
      const defaultSnippets = this.getDefaultSnippets();
      
      // Merge with custom snippets
      this.snippets.clear();
      
      // Add default snippets
      for (const [key, snippet] of Object.entries(defaultSnippets)) {
        this.snippets.set(key, snippet);
      }
      
      // Add custom snippets (override defaults if same key)
      for (const [key, snippet] of Object.entries(storedSnippets)) {
        this.snippets.set(key, snippet);
      }
      
      this.logger.info(`Loaded ${this.snippets.size} snippets`);
      
    } catch (error) {
      this.logger.error('Failed to load snippets:', error);
      // Initialize with defaults only
      const defaultSnippets = this.getDefaultSnippets();
      this.snippets.clear();
      for (const [key, snippet] of Object.entries(defaultSnippets)) {
        this.snippets.set(key, snippet);
      }
    }
  }

  /**
   * Get default code snippets
   */
  getDefaultSnippets() {
    return {
      'js-func': {
        name: 'JavaScript Function',
        description: 'Basic JavaScript function template',
        language: 'javascript',
        content: `function {{name}}({{params}}) {
  {{cursor}}
  return {{return_value}};
}`,
        variables: ['name', 'params', 'return_value']
      },
      'js-arrow': {
        name: 'Arrow Function',
        description: 'JavaScript arrow function',
        language: 'javascript',
        content: `const {{name}} = ({{params}}) => {
  {{cursor}}
};`
      },
      'js-class': {
        name: 'JavaScript Class',
        description: 'ES6 class template',
        language: 'javascript',
        content: `class {{name}} {
  constructor({{params}}) {
    {{cursor}}
  }
  
  {{method}}() {
    // Method implementation
  }
}`
      },
      'py-func': {
        name: 'Python Function',
        description: 'Python function with docstring',
        language: 'python',
        content: `def {{name}}({{params}}):
    """{{description}}
    
    Args:
        {{args}}: {{description}}
    
    Returns:
        {{return_type}}: {{description}}
    """
    {{cursor}}
    pass`
      },
      'py-class': {
        name: 'Python Class',
        description: 'Python class template',
        language: 'python',
        content: `class {{name}}:
    """{{description}}"""
    
    def __init__(self, {{params}}):
        {{cursor}}
        pass`
      },
      'html5': {
        name: 'HTML5 Boilerplate',
        description: 'Basic HTML5 document structure',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="{{lang}}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
</head>
<body>
    {{cursor}}
</body>
</html>`
      },
      'css-flex': {
        name: 'CSS Flexbox',
        description: 'Flexbox container styles',
        language: 'css',
        content: `.{{class_name}} {
  display: flex;
  flex-direction: {{direction}};
  justify-content: {{justify}};
  align-items: {{align}};
  {{cursor}}
}`
      },
      'log': {
        name: 'Console Log',
        description: 'Console.log statement',
        language: 'javascript',
        content: `console.log('{{message}}:', {{variable}});{{cursor}}`
      },
      'comment': {
        name: 'Comment Block',
        description: 'Multi-line comment block',
        language: 'generic',
        content: `/**
 * {{description}}
 * 
 * {{cursor}}
 */`
      },
      'todo': {
        name: 'TODO Comment',
        description: 'TODO comment reminder',
        language: 'generic',
        content: `// TODO: {{task}}{{cursor}}`
      }
    };
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    // Insert snippet command
    this.registerCommand({
      name: 'insert',
      description: 'Insert Code Snippet',
      action: () => this.showSnippetSelector()
    });

    // Manage snippets command  
    this.registerCommand({
      name: 'manage',
      description: 'Manage Code Snippets',
      action: () => this.showManagementPanel()
    });

    // Create new snippet command
    this.registerCommand({
      name: 'create',
      description: 'Create New Snippet',
      action: () => this.showCreateSnippetDialog()
    });
  }

  /**
   * Register slash commands for snippets
   */
  registerSlashCommands() {
    // Register main snippet command
    this.registerCommand({
      name: 'snippet',
      description: 'Insert a code snippet',
      icon: '📄',
      action: (args) => {
        if (args && args.length > 0) {
          // Direct snippet insertion by name
          const snippetName = args.join('-');
          this.insertSnippet(snippetName);
        } else {
          // Show snippet selector
          this.showSnippetSelector();
        }
      }
    });

    // Register individual snippet commands for popular ones
    const popularSnippets = ['js-func', 'js-arrow', 'py-func', 'html5', 'log'];
    for (const snippetKey of popularSnippets) {
      if (this.snippets.has(snippetKey)) {
        const snippet = this.snippets.get(snippetKey);
        this.registerCommand({
          name: snippetKey,
          description: `Insert ${snippet.name}`,
          icon: this.getLanguageIcon(snippet.language),
          action: () => this.insertSnippet(snippetKey)
        });
      }
    }
  }

  /**
   * Setup text expansion functionality
   */
  setupTextExpansion() {
    let expansionTimeout = null;
    
    this.addEventListener('editor:input', (event) => {
      if (!event.text || this.isExpanding) return;
      
      // Clear previous timeout
      if (expansionTimeout) {
        clearTimeout(expansionTimeout);
      }
      
      // Debounce expansion check
      expansionTimeout = setTimeout(() => {
        this.checkForExpansion(event);
      }, 100);
      
      this.addDisposable(() => {
        if (expansionTimeout) clearTimeout(expansionTimeout);
      });
    });
  }

  /**
   * Check if text input should trigger snippet expansion
   */
  checkForExpansion(event) {
    try {
      const selection = this.getSelection();
      if (!selection) return;
      
      const content = this.getEditorContent();
      const beforeCursor = content.substring(0, selection.from);
      
      // Look for trigger pattern
      const triggerPattern = new RegExp(`${this.escapeRegex(this.expansionTrigger)}([a-zA-Z0-9-_]+)$`);
      const match = beforeCursor.match(triggerPattern);
      
      if (match) {
        const snippetKey = match[1];
        if (this.snippets.has(snippetKey)) {
          this.expandSnippet(snippetKey, selection.from - match[0].length, selection.from);
        }
      }
    } catch (error) {
      this.logger.error('Error checking for expansion:', error);
    }
  }

  /**
   * Expand snippet at cursor position
   */
  async expandSnippet(snippetKey, from, to) {
    try {
      this.isExpanding = true;
      
      const snippet = this.snippets.get(snippetKey);
      if (!snippet) {
        this.logger.warn('Snippet not found:', snippetKey);
        return;
      }
      
      // Replace trigger text with snippet content
      const processedContent = await this.processSnippetContent(snippet.content);
      
      // Replace the trigger text
      this.api.editor.replaceRange(from, to, processedContent);
      
      // Position cursor at placeholder if any
      this.positionCursorAtPlaceholder(from, processedContent);
      
      this.showNotification(`Expanded snippet: ${snippet.name}`, 'success', 1000);
      
    } catch (error) {
      this.logger.error('Error expanding snippet:', error);
      this.showNotification('Failed to expand snippet', 'error');
    } finally {
      this.isExpanding = false;
    }
  }

  /**
   * Insert snippet at current cursor position
   */
  async insertSnippet(snippetKey) {
    try {
      const snippet = this.snippets.get(snippetKey);
      if (!snippet) {
        this.showNotification(`Snippet '${snippetKey}' not found`, 'error');
        return;
      }
      
      const processedContent = await this.processSnippetContent(snippet.content);
      
      // Insert at current cursor position
      this.insertContent(processedContent);
      
      // Position cursor at placeholder if any
      const selection = this.getSelection();
      if (selection) {
        this.positionCursorAtPlaceholder(selection.from - processedContent.length, processedContent);
      }
      
      this.showNotification(`Inserted snippet: ${snippet.name}`, 'success', 1000);
      
    } catch (error) {
      this.logger.error('Error inserting snippet:', error);
      this.showNotification('Failed to insert snippet', 'error');
    }
  }

  /**
   * Process snippet content with variable substitution
   */
  async processSnippetContent(content) {
    let processedContent = content;
    
    // Handle simple variable substitution (basic implementation)
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables = new Set();
    
    // Extract all variables
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    // Simple variable substitution with defaults
    const variableDefaults = {
      cursor: '',
      name: 'myFunction',
      params: '',
      description: 'Description here',
      title: 'My Page',
      lang: 'en',
      class_name: 'container',
      direction: 'row',
      justify: 'center',
      align: 'center',
      message: 'Debug',
      variable: 'data',
      task: 'Complete this task'
    };
    
    // Replace variables with defaults or empty strings
    for (const variable of variables) {
      const defaultValue = variableDefaults[variable] || `[${variable}]`;
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
      processedContent = processedContent.replace(regex, defaultValue);
    }
    
    return processedContent;
  }

  /**
   * Position cursor at the cursor placeholder or end of content
   */
  positionCursorAtPlaceholder(startPos, content) {
    try {
      // Look for cursor placeholder
      const cursorPos = content.indexOf('{{cursor}}');
      if (cursorPos !== -1) {
        // Remove cursor placeholder and position cursor there
        const finalContent = content.replace('{{cursor}}', '');
        this.api.editor.setSelection(startPos + cursorPos, startPos + cursorPos);
      }
    } catch (error) {
      this.logger.error('Error positioning cursor:', error);
    }
  }

  /**
   * Show snippet selector dialog
   */
  showSnippetSelector() {
    // This would typically show a UI dialog
    // For now, we'll show available snippets in a notification
    const snippetNames = Array.from(this.snippets.keys()).slice(0, 5).join(', ');
    this.showNotification(`Available snippets: ${snippetNames}...`, 'info', 5000);
  }

  /**
   * Show management panel for snippets
   */
  showManagementPanel() {
    if (this.panelId) {
      this.api.emit('panel_toggle', { panelId: this.panelId });
    }
  }

  /**
   * Show create snippet dialog
   */
  showCreateSnippetDialog() {
    this.showNotification('Create snippet dialog would open here', 'info');
  }

  /**
   * Setup UI components
   */
  setupUI() {
    // Register management panel
    this.panelId = this.registerPanel({
      name: 'snippets-manager',
      title: 'Code Snippets',
      position: 'sidebar',
      content: this.createManagementPanelContent(),
      icon: '📝'
    });
  }

  /**
   * Create management panel content
   */
  createManagementPanelContent() {
    const snippetsList = Array.from(this.snippets.entries())
      .map(([key, snippet]) => {
        return `
          <div class="snippet-item" data-key="${key}">
            <div class="snippet-header">
              <span class="snippet-name">${snippet.name}</span>
              <span class="snippet-language">${snippet.language}</span>
            </div>
            <div class="snippet-description">${snippet.description}</div>
            <div class="snippet-actions">
              <button class="btn-small" onclick="insertSnippet('${key}')">Insert</button>
              <button class="btn-small" onclick="editSnippet('${key}')">Edit</button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="snippets-manager">
        <div class="snippets-header">
          <h3>Code Snippets</h3>
          <button class="btn-primary" onclick="createNewSnippet()">+ New Snippet</button>
        </div>
        
        <div class="snippets-list">
          ${snippetsList}
        </div>
        
        <div class="snippets-info">
          <p>Total: ${this.snippets.size} snippets</p>
          <p>Expansion trigger: <code>${this.expansionTrigger}</code></p>
        </div>
      </div>
    `;
  }

  /**
   * Save custom snippets to storage
   */
  async saveCustomSnippets() {
    try {
      // Filter out default snippets and save only custom ones
      const customSnippets = {};
      const defaultKeys = Object.keys(this.getDefaultSnippets());
      
      for (const [key, snippet] of this.snippets.entries()) {
        if (!defaultKeys.includes(key)) {
          customSnippets[key] = snippet;
        }
      }
      
      await this.setSetting('customSnippets', customSnippets);
      this.logger.info('Custom snippets saved');
      
    } catch (error) {
      this.logger.error('Failed to save custom snippets:', error);
    }
  }

  /**
   * Get language icon for display
   */
  getLanguageIcon(language) {
    const icons = {
      javascript: '🟨',
      python: '🐍',
      html: '🌐',
      css: '🎨',
      java: '☕',
      cpp: '⚡',
      generic: '📄'
    };
    return icons[language] || icons.generic;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}