/**
 * @fileoverview Basic plugin template
 */

import type { TemplateGenerator, TemplateConfig, TemplateValidationResult, TemplateDescription, TemplateOption } from './index.js'

/**
 * Basic plugin template generator
 */
export class BasicPluginTemplate implements TemplateGenerator {
  async generate(config: TemplateConfig): Promise<void> {
    const { outputDir, name, id, description, author, version = '1.0.0', typescript = true } = config
    
    // Generate package.json
    const packageJson = this.generatePackageJson(config)
    
    // Generate manifest
    const manifest = this.generateManifest(config)
    
    // Generate main plugin file
    const mainFile = typescript 
      ? this.generateTypeScriptMain(config)
      : this.generateJavaScriptMain(config)
    
    // Generate TypeScript config if needed
    const tsConfig = typescript ? this.generateTsConfig() : null
    
    // Generate README
    const readme = this.generateReadme(config)
    
    // Generate .gitignore
    const gitignore = this.generateGitignore()
    
    // Write files (implementation would use file system)
    console.log('Generating basic plugin template:', {
      outputDir,
      name,
      files: {
        'package.json': packageJson,
        'plugin.json': manifest,
        [`src/index.${typescript ? 'ts' : 'js'}`]: mainFile,
        ...(tsConfig && { 'tsconfig.json': tsConfig }),
        'README.md': readme,
        '.gitignore': gitignore
      }
    })
  }

  async validate(config: TemplateConfig): Promise<TemplateValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!config.name) {
      errors.push('Plugin name is required')
    }

    if (!config.id) {
      errors.push('Plugin ID is required')
    } else if (!/^[a-z0-9-]+$/.test(config.id)) {
      errors.push('Plugin ID must contain only lowercase letters, numbers, and hyphens')
    }

    if (!config.outputDir) {
      errors.push('Output directory is required')
    }

    if (config.version && !/^\d+\.\d+\.\d+/.test(config.version)) {
      warnings.push('Version should follow semantic versioning (x.y.z)')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  getDescription(): TemplateDescription {
    return {
      name: 'basic',
      displayName: 'Basic Plugin',
      description: 'A simple plugin template with basic structure and minimal functionality',
      category: 'General',
      tags: ['basic', 'starter', 'minimal'],
      complexity: 'beginner',
      setupTime: '5 minutes',
      requiredSkills: ['Basic JavaScript/TypeScript'],
      features: [
        'Plugin activation/deactivation',
        'Basic command registration',
        'Configuration support',
        'TypeScript support (optional)'
      ],
      useCases: [
        'Learning plugin development',
        'Starting a new plugin project',
        'Simple automation tasks',
        'Basic editor enhancements'
      ]
    }
  }

  getRequiredOptions(): TemplateOption[] {
    return [
      {
        key: 'name',
        name: 'Plugin Name',
        description: 'The display name of your plugin',
        type: 'string',
        required: true
      },
      {
        key: 'id',
        name: 'Plugin ID',
        description: 'Unique identifier for your plugin (kebab-case)',
        type: 'string',
        required: true,
        pattern: '^[a-z0-9-]+$',
        validationMessage: 'Plugin ID must contain only lowercase letters, numbers, and hyphens'
      },
      {
        key: 'description',
        name: 'Description',
        description: 'Brief description of what your plugin does',
        type: 'string',
        required: false
      },
      {
        key: 'author',
        name: 'Author',
        description: 'Plugin author name',
        type: 'string',
        required: false
      }
    ]
  }

  private generatePackageJson(config: TemplateConfig): string {
    return JSON.stringify({
      name: config.id,
      version: config.version || '1.0.0',
      description: config.description || 'A Lokus plugin',
      main: config.typescript ? 'dist/index.js' : 'src/index.js',
      types: config.typescript ? 'dist/index.d.ts' : undefined,
      scripts: {
        ...(config.typescript && {
          build: 'tsc',
          'build:watch': 'tsc --watch',
          dev: 'npm run build:watch'
        }),
        test: 'jest',
        lint: 'eslint src/**/*.{js,ts}',
        'lint:fix': 'eslint src/**/*.{js,ts} --fix'
      },
      keywords: ['lokus', 'plugin', 'extension'],
      author: config.author || '',
      license: 'MIT',
      engines: {
        lokus: '^1.0.0'
      },
      dependencies: {
        '@lokus/plugin-sdk': '^1.0.0'
      },
      devDependencies: {
        ...(config.typescript && {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0'
        }),
        eslint: '^8.0.0',
        jest: '^29.0.0'
      }
    }, null, 2)
  }

  private generateManifest(config: TemplateConfig): string {
    return JSON.stringify({
      id: config.id,
      version: config.version || '1.0.0',
      name: config.name,
      description: config.description || 'A Lokus plugin',
      author: config.author || '',
      main: config.typescript ? 'dist/index.js' : 'src/index.js',
      activationEvents: ['*'],
      permissions: [
        'commands:register',
        'ui:notifications'
      ],
      contributes: {
        commands: [
          {
            command: `${config.id}.hello`,
            title: 'Hello World',
            category: config.name
          }
        ]
      }
    }, null, 2)
  }

  private generateTypeScriptMain(config: TemplateConfig): string {
    return `import { Plugin, PluginContext, LokusAPI } from '@lokus/plugin-sdk'

/**
 * ${config.name} Plugin
 * ${config.description || 'A Lokus plugin'}
 */
export default class ${this.toPascalCase(config.name || 'MyPlugin')}Plugin implements Plugin {
  private api?: LokusAPI
  private context?: PluginContext

  /**
   * Called when the plugin is activated
   */
  async activate(context: PluginContext): Promise<void> {
    this.context = context
    this.api = context.api

    // Register commands
    this.registerCommands()

    // Show activation message
    this.api.ui.showNotification('${config.name} plugin activated!', 'info')
  }

  /**
   * Called when the plugin is deactivated
   */
  async deactivate(): Promise<void> {
    // Clean up resources here
    this.api?.ui.showNotification('${config.name} plugin deactivated', 'info')
  }

  /**
   * Register plugin commands
   */
  private registerCommands(): void {
    if (!this.api) return

    // Register hello command
    this.api.commands.register({
      id: '${config.id}.hello',
      title: 'Hello World',
      category: '${config.name}',
      handler: this.handleHelloCommand.bind(this)
    })
  }

  /**
   * Handle hello command
   */
  private async handleHelloCommand(): Promise<void> {
    if (!this.api) return

    const response = await this.api.ui.showDialog({
      title: 'Hello from ${config.name}!',
      message: 'This is a basic plugin example.',
      type: 'info',
      buttons: [
        { id: 'ok', label: 'OK', primary: true }
      ]
    })

    if (response.buttonId === 'ok') {
      this.api.ui.showNotification('Hello World! 👋', 'success')
    }
  }
}
`
  }

  private generateJavaScriptMain(config: TemplateConfig): string {
    return `/**
 * ${config.name} Plugin
 * ${config.description || 'A Lokus plugin'}
 */
class ${this.toPascalCase(config.name || 'MyPlugin')}Plugin {
  /**
   * Called when the plugin is activated
   */
  async activate(context) {
    this.context = context
    this.api = context.api

    // Register commands
    this.registerCommands()

    // Show activation message
    this.api.ui.showNotification('${config.name} plugin activated!', 'info')
  }

  /**
   * Called when the plugin is deactivated
   */
  async deactivate() {
    // Clean up resources here
    this.api?.ui.showNotification('${config.name} plugin deactivated', 'info')
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    if (!this.api) return

    // Register hello command
    this.api.commands.register({
      id: '${config.id}.hello',
      title: 'Hello World',
      category: '${config.name}',
      handler: this.handleHelloCommand.bind(this)
    })
  }

  /**
   * Handle hello command
   */
  async handleHelloCommand() {
    if (!this.api) return

    const response = await this.api.ui.showDialog({
      title: 'Hello from ${config.name}!',
      message: 'This is a basic plugin example.',
      type: 'info',
      buttons: [
        { id: 'ok', label: 'OK', primary: true }
      ]
    })

    if (response.buttonId === 'ok') {
      this.api.ui.showNotification('Hello World! 👋', 'success')
    }
  }
}

module.exports = ${this.toPascalCase(config.name || 'MyPlugin')}Plugin
`
  }

  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts']
    }, null, 2)
  }

  private generateReadme(config: TemplateConfig): string {
    return `# ${config.name}

${config.description || 'A Lokus plugin'}

## Features

- Basic plugin structure
- Command registration
- UI notifications
- Configuration support

## Installation

1. Clone this repository
2. Run \`npm install\`
3. Run \`npm run build\` (if using TypeScript)
4. Install the plugin in Lokus

## Development

${config.typescript ? `
### TypeScript

\`\`\`bash
npm run build        # Build once
npm run build:watch  # Build and watch for changes
npm run dev          # Alias for build:watch
\`\`\`
` : ''}

### Testing

\`\`\`bash
npm test
\`\`\`

### Linting

\`\`\`bash
npm run lint
npm run lint:fix
\`\`\`

## Commands

- **${config.id}.hello**: Show a hello world message

## Configuration

No configuration options available yet.

## License

MIT
`
  }

  private generateGitignore(): string {
    return `# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Coverage
coverage/

# Environment
.env
.env.local
.env.production
`
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }
}