/**
 * CLI Integration Module
 * 
 * Exports CLI components for the lokus-plugin-cli tool
 */

export { CLITemplateGenerator, CLICommands } from './CLITemplateGenerator.js'

/**
 * Register CLI commands with the lokus-plugin-cli
 */
export function registerCLICommands(cli) {
  const { CLICommands } = await import('./CLITemplateGenerator.js')
  
  for (const command of Object.values(CLICommands)) {
    cli.command(command.name)
      .description(command.description)
      .alias(command.alias)
      .action(command.action)
    
    // Add options
    for (const option of command.options) {
      const flags = option.alias ? `-${option.alias}, --${option.name}` : `--${option.name}`
      const optionCommand = cli.option(flags, option.description)
      
      if (option.default !== undefined) {
        optionCommand.default(option.default)
      }
      
      if (option.choices) {
        optionCommand.choices(option.choices)
      }
    }
  }
}

/**
 * CLI Template Integration
 */
export class CLITemplateIntegration {
  constructor() {
    this.commands = new Map()
    this.middleware = []
  }

  /**
   * Register a template command
   */
  registerCommand(name, command) {
    this.commands.set(name, command)
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middleware.push(middleware)
  }

  /**
   * Execute command with middleware
   */
  async executeCommand(name, options = {}) {
    const command = this.commands.get(name)
    if (!command) {
      throw new Error(`Command '${name}' not found`)
    }

    // Apply middleware
    let context = { command: name, options }
    for (const middleware of this.middleware) {
      context = await middleware(context)
    }

    // Execute command
    return await command.action(context.options)
  }

  /**
   * Get available commands
   */
  getCommands() {
    return Array.from(this.commands.keys())
  }

  /**
   * Get command info
   */
  getCommandInfo(name) {
    return this.commands.get(name)
  }
}

/**
 * Default CLI integration instance
 */
export const defaultCLIIntegration = new CLITemplateIntegration()

// Register built-in commands
const { CLICommands } = await import('./CLITemplateGenerator.js')
for (const [name, command] of Object.entries(CLICommands)) {
  defaultCLIIntegration.registerCommand(name, command)
}

export default {
  CLITemplateGenerator,
  CLICommands,
  CLITemplateIntegration,
  registerCLICommands,
  defaultCLIIntegration
}