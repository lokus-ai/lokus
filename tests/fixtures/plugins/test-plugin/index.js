/**
 * Test Plugin - Comprehensive plugin for testing plugin system functionality
 */

export default class TestPlugin {
  constructor() {
    this.api = null
    this.isActive = false
    this.panelElement = null
  }

  /**
   * Plugin activation - called when plugin is loaded
   * @param {PluginAPI} api - The plugin API instance
   */
  async activate(api) {
    this.api = api
    this.isActive = true
    
    console.log('Test Plugin activated')
    
    // Register commands
    this.registerCommands()
    
    // Register UI components
    this.registerUI()
    
    // Register event listeners
    this.registerEvents()
    
    // Initialize plugin state
    await this.initializeState()
  }

  /**
   * Plugin deactivation - called when plugin is unloaded
   */
  async deactivate() {
    console.log('Test Plugin deactivated')
    
    // Clean up resources
    if (this.panelElement) {
      this.panelElement.remove()
    }
    
    // Unregister event listeners
    this.unregisterEvents()
    
    this.isActive = false
    this.api = null
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    // Insert text command
    this.api.commands.registerCommand('test-plugin.insert-text', async (args = {}) => {
      const text = args.text || 'Test plugin content inserted'
      this.api.editor.insertContent(text)
      
      this.api.ui.showNotification({
        type: 'success',
        title: 'Test Plugin',
        message: 'Text inserted successfully'
      })
    })

    // Show notification command
    this.api.commands.registerCommand('test-plugin.show-notification', async (args = {}) => {
      this.api.ui.showNotification({
        type: args.type || 'info',
        title: 'Test Plugin Notification',
        message: args.message || 'This is a test notification from the plugin'
      })
    })

    // Error command for testing error handling
    this.api.commands.registerCommand('test-plugin.error-command', async () => {
      throw new Error('Intentional test error from plugin')
    })

    // Register slash commands
    this.api.commands.registerSlashCommand({
      trigger: 'test-command',
      description: 'Insert test content',
      handler: () => {
        this.api.commands.execute('test-plugin.insert-text')
      }
    })

    this.api.commands.registerSlashCommand({
      trigger: 'error-command',
      description: 'Trigger test error',
      handler: () => {
        this.api.commands.execute('test-plugin.error-command')
      }
    })

    // Register keyboard shortcuts
    this.api.commands.registerShortcut({
      keys: 'Ctrl+Shift+T',
      command: 'test-plugin.insert-text',
      description: 'Test Plugin Action'
    })
  }

  /**
   * Register UI components
   */
  registerUI() {
    // Register custom panel
    this.api.ui.registerPanel({
      id: 'test-panel',
      title: 'Test Plugin Panel',
      icon: 'test-icon',
      position: 'sidebar',
      component: this.createPanelComponent()
    })

    // Register menu items
    this.api.ui.registerMenuItem({
      id: 'test-menu-item',
      label: 'Test Plugin Action',
      command: 'test-plugin.insert-text',
      icon: 'test-icon',
      group: 'plugins'
    })
  }

  /**
   * Create panel component
   */
  createPanelComponent() {
    const panel = document.createElement('div')
    panel.className = 'test-plugin-panel'
    panel.setAttribute('data-testid', 'plugin-panel-test-plugin')
    
    const title = document.createElement('h3')
    title.textContent = 'Test Plugin Panel'
    title.setAttribute('data-testid', 'plugin-panel-title')
    panel.appendChild(title)
    
    const button = document.createElement('button')
    button.textContent = 'Insert Test Text'
    button.onclick = () => {
      this.api.commands.execute('test-plugin.insert-text', { text: 'Text from panel button' })
    }
    panel.appendChild(button)
    
    const settings = document.createElement('div')
    settings.innerHTML = `
      <h4>Plugin Settings</h4>
      <label>
        Theme:
        <select id="plugin-theme">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        <input type="checkbox" id="plugin-auto-save"> Auto Save
      </label>
    `
    panel.appendChild(settings)
    
    // Load current settings
    this.loadPanelSettings(settings)
    
    // Save settings on change
    settings.addEventListener('change', () => {
      this.savePanelSettings(settings)
    })
    
    this.panelElement = panel
    return panel
  }

  /**
   * Register event listeners
   */
  registerEvents() {
    // Listen for editor selection changes
    this.api.events.subscribe('editor.selectionChange', (data) => {
      console.log('Editor selection changed:', data)
    })

    // Listen for document changes
    this.api.events.subscribe('editor.documentChange', (data) => {
      console.log('Document changed:', data)
    })

    // Listen for plugin events from other plugins
    this.api.events.subscribe('plugin.message', (data) => {
      if (data.target === 'test-plugin') {
        this.handlePluginMessage(data)
      }
    })
  }

  /**
   * Unregister event listeners
   */
  unregisterEvents() {
    // Clean up event subscriptions
    this.api.events.unsubscribe('editor.selectionChange')
    this.api.events.unsubscribe('editor.documentChange')
    this.api.events.unsubscribe('plugin.message')
  }

  /**
   * Initialize plugin state
   */
  async initializeState() {
    try {
      // Load plugin settings
      const settings = await this.api.settings.get()
      console.log('Plugin settings loaded:', settings)
      
      // Load plugin data
      const data = await this.api.storage.get('plugin-data', { initialized: false })
      
      if (!data.initialized) {
        // First time initialization
        await this.api.storage.set('plugin-data', {
          initialized: true,
          createdAt: new Date().toISOString(),
          usage: 0
        })
        
        this.api.ui.showNotification({
          type: 'info',
          title: 'Test Plugin',
          message: 'Plugin initialized successfully'
        })
      }
      
      // Update usage counter
      data.usage = (data.usage || 0) + 1
      await this.api.storage.set('plugin-data', data)
      
    } catch (error) {
      this.api.utils.handleError(error, 'Failed to initialize plugin state')
    }
  }

  /**
   * Handle messages from other plugins
   */
  handlePluginMessage(data) {
    console.log('Received plugin message:', data)
    
    if (data.action === 'ping') {
      // Respond to ping
      this.api.events.emit('plugin.message', {
        from: 'test-plugin',
        target: data.from,
        action: 'pong',
        message: 'Hello from test plugin!'
      })
    }
  }

  /**
   * Load panel settings
   */
  async loadPanelSettings(panel) {
    try {
      const settings = await this.api.settings.get()
      
      const themeSelect = panel.querySelector('#plugin-theme')
      const autoSaveCheckbox = panel.querySelector('#plugin-auto-save')
      
      if (themeSelect) {
        themeSelect.value = settings.theme || 'light'
      }
      
      if (autoSaveCheckbox) {
        autoSaveCheckbox.checked = settings.autoSave || false
      }
      
    } catch (error) {
      this.api.utils.handleError(error, 'Failed to load panel settings')
    }
  }

  /**
   * Save panel settings
   */
  async savePanelSettings(panel) {
    try {
      const themeSelect = panel.querySelector('#plugin-theme')
      const autoSaveCheckbox = panel.querySelector('#plugin-auto-save')
      
      const newSettings = {}
      
      if (themeSelect) {
        newSettings.theme = themeSelect.value
      }
      
      if (autoSaveCheckbox) {
        newSettings.autoSave = autoSaveCheckbox.checked
      }
      
      await this.api.settings.update(newSettings)
      
      this.api.ui.showNotification({
        type: 'success',
        title: 'Settings Saved',
        message: 'Plugin settings updated successfully'
      })
      
    } catch (error) {
      this.api.utils.handleError(error, 'Failed to save panel settings')
    }
  }

  /**
   * Plugin information
   */
  getInfo() {
    return {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      isActive: this.isActive,
      hasPanel: !!this.panelElement
    }
  }
}