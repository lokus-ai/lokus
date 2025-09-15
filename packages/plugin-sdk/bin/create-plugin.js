#!/usr/bin/env node

const { Command } = require('commander')
const inquirer = require('inquirer')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs-extra')

const program = new Command()

program
  .name('create-lokus-plugin')
  .description('Create a new Lokus plugin from template')
  .version('1.0.0')

program
  .argument('[name]', 'Plugin name')
  .option('-t, --template <template>', 'Plugin template', 'basic')
  .option('-d, --dir <directory>', 'Output directory')
  .option('--typescript', 'Use TypeScript (default: true)', true)
  .option('--no-typescript', 'Use JavaScript instead of TypeScript')
  .option('--tests', 'Include test files (default: true)', true)
  .option('--no-tests', 'Skip test files')
  .option('--docs', 'Include documentation (default: true)', true)
  .option('--no-docs', 'Skip documentation')
  .action(async (name, options) => {
    try {
      console.log(chalk.blue('🚀 Welcome to Lokus Plugin Generator!'))
      console.log()
      
      const config = await getConfig(name, options)
      await createPlugin(config)
      
      console.log()
      console.log(chalk.green('✅ Plugin created successfully!'))
      console.log()
      console.log(chalk.yellow('Next steps:'))
      console.log(`  cd ${config.name}`)
      console.log('  npm install')
      if (config.typescript) {
        console.log('  npm run build')
      }
      console.log('  npm test')
      console.log()
      console.log('Happy coding! 🎉')
      
    } catch (error) {
      console.error(chalk.red('❌ Error creating plugin:'), error.message)
      process.exit(1)
    }
  })

async function getConfig(name, options) {
  const questions = []
  
  if (!name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Plugin name:',
      validate: (input) => input.trim().length > 0 || 'Plugin name is required'
    })
  }
  
  questions.push(
    {
      type: 'input',
      name: 'id',
      message: 'Plugin ID (kebab-case):',
      default: (answers) => (name || answers.name).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      validate: (input) => /^[a-z0-9-]+$/.test(input) || 'Plugin ID must be kebab-case'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Plugin description:',
      default: 'A Lokus plugin'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: process.env.USER || process.env.USERNAME || 'Anonymous'
    },
    {
      type: 'list',
      name: 'template',
      message: 'Plugin template:',
      choices: [
        { name: 'Basic Plugin - Simple starter template', value: 'basic' },
        { name: 'UI Extension - Custom panels and webviews', value: 'ui-extension' },
        { name: 'Language Support - Syntax highlighting and features', value: 'language-support' },
        { name: 'Task Provider - Build tasks and runners', value: 'task-provider' },
        { name: 'Debug Adapter - Debugging support', value: 'debug-adapter' },
        { name: 'Theme Plugin - Custom editor themes', value: 'theme' },
        { name: 'Command Plugin - Command palette extensions', value: 'command' }
      ],
      default: options.template
    }
  )
  
  if (!options.dir) {
    questions.push({
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: (answers) => `./${name || answers.name}`
    })
  }
  
  const answers = await inquirer.prompt(questions)
  
  return {
    name: name || answers.name,
    id: answers.id,
    description: answers.description,
    author: answers.author,
    template: answers.template,
    outputDir: options.dir || answers.outputDir,
    typescript: options.typescript,
    includeTests: options.tests,
    includeDocs: options.docs
  }
}

async function createPlugin(config) {
  console.log(chalk.blue(`Creating plugin "${config.name}" with template "${config.template}"...`))
  
  // Ensure output directory exists
  await fs.ensureDir(config.outputDir)
  
  // Check if directory is empty
  const files = await fs.readdir(config.outputDir)
  if (files.length > 0) {
    const { proceed } = await inquirer.prompt({
      type: 'confirm',
      name: 'proceed',
      message: 'Directory is not empty. Continue?',
      default: false
    })
    
    if (!proceed) {
      throw new Error('Operation cancelled')
    }
  }
  
  // Generate plugin files
  await generateTemplate(config)
  
  console.log(chalk.green(`Plugin files generated in ${config.outputDir}`))
}

async function generateTemplate(config) {
  // This would integrate with the actual template generators
  // For now, we'll create basic files
  
  const packageJson = {
    name: config.id,
    version: '1.0.0',
    description: config.description,
    main: config.typescript ? 'dist/index.js' : 'src/index.js',
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
    keywords: ['lokus', 'plugin'],
    author: config.author,
    license: 'MIT',
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
  }
  
  const manifest = {
    id: config.id,
    version: '1.0.0',
    name: config.name,
    description: config.description,
    author: config.author,
    main: config.typescript ? 'dist/index.js' : 'src/index.js',
    activationEvents: ['*'],
    permissions: ['commands:register', 'ui:notifications'],
    contributes: {
      commands: [
        {
          command: `${config.id}.hello`,
          title: 'Hello World',
          category: config.name
        }
      ]
    }
  }
  
  // Write package.json
  await fs.writeJSON(path.join(config.outputDir, 'package.json'), packageJson, { spaces: 2 })
  
  // Write plugin.json
  await fs.writeJSON(path.join(config.outputDir, 'plugin.json'), manifest, { spaces: 2 })
  
  // Create src directory
  await fs.ensureDir(path.join(config.outputDir, 'src'))
  
  // Write main plugin file
  const ext = config.typescript ? 'ts' : 'js'
  const mainFile = generateMainFile(config)
  await fs.writeFile(path.join(config.outputDir, 'src', `index.${ext}`), mainFile)
  
  // Write TypeScript config if needed
  if (config.typescript) {
    const tsConfig = {
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
      exclude: ['node_modules', 'dist']
    }
    await fs.writeJSON(path.join(config.outputDir, 'tsconfig.json'), tsConfig, { spaces: 2 })
  }
  
  // Write README if requested
  if (config.includeDocs) {
    const readme = generateReadme(config)
    await fs.writeFile(path.join(config.outputDir, 'README.md'), readme)
  }
  
  // Write gitignore
  const gitignore = `node_modules/
dist/
*.log
.env
.DS_Store
`
  await fs.writeFile(path.join(config.outputDir, '.gitignore'), gitignore)
}

function generateMainFile(config) {
  if (config.typescript) {
    return `import { BasePlugin, PluginContext } from '@lokus/plugin-sdk'

/**
 * ${config.name} Plugin
 * ${config.description}
 */
export default class ${toPascalCase(config.name)}Plugin extends BasePlugin {
  async activate(context: PluginContext): Promise<void> {
    await this.initialize(context)
    
    // Register commands
    this.registerCommand('${config.id}.hello', this.sayHello.bind(this), {
      title: 'Say Hello',
      category: '${config.name}'
    })
    
    this.getLogger().info('${config.name} plugin activated')
    this.showNotification('${config.name} plugin activated!', 'success')
  }
  
  private async sayHello(): Promise<void> {
    const api = this.getAPI()
    
    const result = await api.ui.showDialog({
      title: 'Hello from ${config.name}!',
      message: 'Welcome to your new plugin!',
      type: 'info',
      buttons: [
        { id: 'ok', label: 'Awesome!', primary: true }
      ]
    })
    
    if (result.buttonId === 'ok') {
      this.showNotification('Great! Happy coding! 🎉', 'success')
    }
  }
}
`
  } else {
    return `const { BasePlugin } = require('@lokus/plugin-sdk')

/**
 * ${config.name} Plugin
 * ${config.description}
 */
class ${toPascalCase(config.name)}Plugin extends BasePlugin {
  async activate(context) {
    await this.initialize(context)
    
    // Register commands
    this.registerCommand('${config.id}.hello', this.sayHello.bind(this), {
      title: 'Say Hello',
      category: '${config.name}'
    })
    
    this.getLogger().info('${config.name} plugin activated')
    this.showNotification('${config.name} plugin activated!', 'success')
  }
  
  async sayHello() {
    const api = this.getAPI()
    
    const result = await api.ui.showDialog({
      title: 'Hello from ${config.name}!',
      message: 'Welcome to your new plugin!',
      type: 'info',
      buttons: [
        { id: 'ok', label: 'Awesome!', primary: true }
      ]
    })
    
    if (result.buttonId === 'ok') {
      this.showNotification('Great! Happy coding! 🎉', 'success')
    }
  }
}

module.exports = ${toPascalCase(config.name)}Plugin
`
  }
}

function generateReadme(config) {
  return `# ${config.name}

${config.description}

## Installation

1. Clone this repository
2. Run \`npm install\`
${config.typescript ? '3. Run `npm run build`' : ''}
4. Install the plugin in Lokus

## Development

${config.typescript ? `
### Build

\`\`\`bash
npm run build        # Build once
npm run build:watch  # Build and watch for changes
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

## Features

- Hello World command
- Plugin activation notifications

## Commands

- **${config.id}.hello**: Show a hello message

## License

MIT
`
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

if (require.main === module) {
  program.parse()
}

module.exports = { createPlugin }