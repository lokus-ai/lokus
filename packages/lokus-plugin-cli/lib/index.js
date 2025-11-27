#!/usr/bin/env node

const { Command } = require('commander')
const fs = require('fs-extra')
const path = require('path')

// Simple color functions for CommonJS compatibility
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
}

const program = new Command()

program
  .name('lokus-plugin')
  .description('Official CLI tool for developing Lokus plugins')
  .version('1.0.0')

// Create command
program
  .command('create <name>')
  .description('Create a new plugin from template')
  .option('-t, --template <type>', 'Template type (basic, mcp-server)', 'basic')
  .option('--typescript', 'Use TypeScript')
  .action(async (name, options) => {
    try {
      
      // Basic template creation
      const pluginDir = path.resolve(name)
      await fs.ensureDir(pluginDir)
      
      // Create basic plugin.json
      const manifest = {
        id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: name,
        version: '1.0.0',
        description: `A Lokus plugin created with lokus-plugin CLI`,
        author: 'Your Name',
        main: 'src/index.js',
        lokusVersion: '^1.0.0',
        permissions: ['modify_ui'],
        activationEvents: ['onStartup'],
        categories: ['Other']
      }
      
      await fs.writeJson(path.join(pluginDir, 'plugin.json'), manifest, { spaces: 2 })
      
      // Create src directory and index file
      await fs.ensureDir(path.join(pluginDir, 'src'))
      
      const indexContent = `/**
 * ${name} Plugin for Lokus
 */

export class ${name.replace(/[^a-zA-Z0-9]/g, '')}Plugin {
  constructor() {
    this.name = '${name}'
  }

  async activate(api) {
    console.log(\`\${this.name} activated!\`)
    
    // Add your plugin logic here
    await api.ui.showMessage('Hello from ${name}!', 'info')
  }

  async deactivate(api) {
    console.log(\`\${this.name} deactivated!\`)
  }
}

export default ${name.replace(/[^a-zA-Z0-9]/g, '')}Plugin`

      await fs.writeFile(path.join(pluginDir, 'src', 'index.js'), indexContent)
      
      // Create README
      const readmeContent = `# ${name}

A Lokus plugin created with the lokus-plugin CLI.

## Installation

1. Copy this plugin directory to your Lokus plugins folder
2. Open Lokus and go to Settings > Plugins
3. Enable the ${name} plugin

## Development

See the [Plugin Development Guide](https://github.com/lokus-ai/lokus/blob/main/PLUGIN_DEVELOPMENT.md) for more information.
`
      
      await fs.writeFile(path.join(pluginDir, 'README.md'), readmeContent)
      
      
    } catch (error) {
      console.error(colors.red('Error:'), error.message)
      process.exit(1)
    }
  })

// Validate command
program
  .command('validate')
  .description('Validate a plugin manifest')
  .option('-p, --path <path>', 'Path to plugin directory', '.')
  .action(async (options) => {
    try {
      const pluginPath = path.resolve(options.path)
      const manifestPath = path.join(pluginPath, 'plugin.json')
      
      if (!await fs.pathExists(manifestPath)) {
        console.error(colors.red('Error: plugin.json not found'))
        process.exit(1)
      }
      
      const manifest = await fs.readJson(manifestPath)
      
      // Basic validation
      const required = ['id', 'name', 'version']
      const missing = required.filter(field => !manifest[field])
      
      if (missing.length > 0) {
        console.error(colors.red(`Missing required fields: ${missing.join(', ')}`))
        process.exit(1)
      }
      
      
    } catch (error) {
      console.error(colors.red('Error:'), error.message)
      process.exit(1)
    }
  })

// List command
program
  .command('list')
  .description('List available plugin templates')
  .action(() => {
  })

// Global error handler
program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0)
  }
  console.error(colors.red('Error:'), err.message)
  process.exit(1)
})

// Parse arguments
if (require.main === module) {
  program.parse(process.argv)
}

module.exports = { program }