import { BasePlugin, PluginContext } from '@lokus/plugin-sdk'

/**
 * Hello World Plugin - A simple example plugin
 */
export default class HelloWorldPlugin extends BasePlugin {
  async activate(context: PluginContext): Promise<void> {
    await this.initialize(context)
    
    // Register commands
    this.registerCommand('hello-world.greet', this.greetUser.bind(this), {
      title: 'Say Hello',
      category: 'Hello World'
    })
    
    this.registerCommand('hello-world.count', this.showCount.bind(this), {
      title: 'Show Count',
      category: 'Hello World'
    })
    
    // Show activation message
    this.showNotification('Hello World plugin activated! 🎉', 'success')
    this.getLogger().info('Hello World plugin is now active')
  }
  
  /**
   * Greet the user
   */
  private async greetUser(): Promise<void> {
    const api = this.getAPI()
    
    // Show input box to get user's name
    const name = await api.ui.showInputBox({
      placeholder: 'Enter your name',
      prompt: 'What is your name?',
      value: 'World'
    })
    
    if (name) {
      // Show greeting dialog
      const result = await api.ui.showDialog({
        title: 'Hello!',
        message: `Hello, ${name}! 👋`,
        type: 'info',
        buttons: [
          { id: 'great', label: 'Great!', primary: true },
          { id: 'thanks', label: 'Thanks!' }
        ]
      })
      
      if (result.buttonId === 'great') {
        this.showNotification('Glad you think so! 😊', 'success')
      } else if (result.buttonId === 'thanks') {
        this.showNotification('You\'re welcome! 😊', 'success')
      }
      
      // Log the interaction
      this.getLogger().info(`Greeted user: ${name}`)
    }
  }
  
  /**
   * Show activation count
   */
  private async showCount(): Promise<void> {
    const config = this.getConfig()
    let count = config.get<number>('activationCount', 0)
    count++
    
    await config.set('activationCount', count)
    
    this.showNotification(`This plugin has been activated ${count} time(s)`, 'info')
    this.getLogger().info(`Activation count: ${count}`)
  }
}