/**
 * Hello World Plugin for Lokus
 * 
 * This is a simple example plugin that demonstrates:
 * - Basic plugin structure
 * - Command registration
 * - UI interaction
 * - Menu integration
 */

export class HelloWorldPlugin {
  constructor() {
    this.name = 'Hello World Plugin'
    this.commands = new Map()
  }

  /**
   * Plugin activation - called when the plugin is loaded
   * @param {PluginAPI} api - The Lokus plugin API
   */
  async activate(api) {
    console.log(`${this.name} activated!`)
    
    // Register the hello command
    this.commands.set('helloWorld.sayHello', async () => {
      await this.sayHello(api)
    })
    
    // Register the time command
    this.commands.set('helloWorld.showTime', async () => {
      await this.showCurrentTime(api)
    })
    
    // Register the insert text command
    this.commands.set('helloWorld.insertGreeting', async () => {
      await this.insertGreeting(api)
    })
    
    // Register all commands with Lokus
    for (const [commandId, handler] of this.commands) {
      api.commands.registerCommand(commandId, handler)
    }
    
    // Add menu items
    api.ui.addMenuItem('Hello World', [
      {
        label: 'Say Hello',
        command: 'helloWorld.sayHello',
        icon: '👋'
      },
      {
        label: 'Show Current Time',
        command: 'helloWorld.showTime',
        icon: '🕐'
      },
      {
        label: 'Insert Greeting',
        command: 'helloWorld.insertGreeting',
        icon: '✍️'
      }
    ])
    
    // Show activation message
    await api.ui.showMessage('Hello World Plugin loaded successfully!', 'info')
  }

  /**
   * Plugin deactivation - called when the plugin is unloaded
   * @param {PluginAPI} api - The Lokus plugin API
   */
  async deactivate(api) {
    // Cleanup: unregister all commands
    for (const [commandId] of this.commands) {
      api.commands.unregisterCommand(commandId)
    }
    this.commands.clear()
    
    // Remove menu items
    api.ui.removeMenuItem('Hello World')
    
    console.log(`${this.name} deactivated!`)
  }

  /**
   * Show a simple hello message
   * @param {PluginAPI} api - The Lokus plugin API
   */
  async sayHello(api) {
    const message = 'Hello from the Hello World plugin! 👋'
    await api.ui.showMessage(message, 'info')
  }

  /**
   * Show the current time
   * @param {PluginAPI} api - The Lokus plugin API
   */
  async showCurrentTime(api) {
    const now = new Date()
    const timeString = now.toLocaleTimeString()
    const dateString = now.toLocaleDateString()
    
    const message = `Current time: ${timeString} on ${dateString} 🕐`
    await api.ui.showMessage(message, 'info')
  }

  /**
   * Insert a greeting at the current cursor position
   * @param {PluginAPI} api - The Lokus plugin API
   */
  async insertGreeting(api) {
    try {
      const editor = await api.editor.getActiveEditor()
      if (editor) {
        const greeting = `Hello from Lokus! Generated at ${new Date().toLocaleString()}\n`
        await editor.insertText(greeting)
        await api.ui.showMessage('Greeting inserted!', 'success')
      } else {
        await api.ui.showMessage('No active editor found', 'warning')
      }
    } catch (error) {
      console.error('Error inserting greeting:', error)
      await api.ui.showMessage('Failed to insert greeting', 'error')
    }
  }
}

// Export the plugin class as default
export default HelloWorldPlugin