/**
 * CLI Template Generator
 * 
 * Command-line interface for generating MCP plugins from templates
 * Provides interactive template selection and project scaffolding
 */

import fs from 'fs/promises'
import path from 'path'
import { prompts } from 'enquirer'
import chalk from 'chalk'
import ora from 'ora'
import { MCPPluginTemplateGenerator } from '../MCPPluginTemplate.js'
import { TEMPLATE_TYPES, TEMPLATE_CATEGORIES, TEMPLATE_COMPLEXITY } from '../TemplateConfig.js'

/**
 * CLI Template Generator Class
 */
export class CLITemplateGenerator {
  constructor() {
    this.templateGenerator = new MCPPluginTemplateGenerator()
    this.spinner = null
  }

  /**
   * Generate project from template with CLI interface
   */
  async generateProject(templateType, options = {}) {
    this.spinner = ora('Initializing template generator...').start()
    
    try {
      // Validate template type
      const template = this.templateGenerator.getTemplate(templateType)
      if (!template) {
        throw new Error(`Template type "${templateType}" not found`)
      }

      this.spinner.succeed('Template generator initialized')

      // Get project details if not provided
      const projectOptions = await this.getProjectOptions(template, options)
      
      // Validate project directory
      const projectPath = path.resolve(projectOptions.projectDirectory || projectOptions.pluginId)
      const validation = await this.validateProjectDirectory(projectPath)
      
      if (!validation.valid) {
        throw new Error(validation.message)
      }

      // Generate plugin structure
      this.spinner = ora('Generating plugin structure...').start()
      const pluginStructure = await this.templateGenerator.generatePlugin(templateType, projectOptions)
      this.spinner.succeed('Plugin structure generated')

      // Create project files
      this.spinner = ora('Creating project files...').start()
      await this.createProjectStructure(projectPath, pluginStructure)
      this.spinner.succeed('Project files created')

      // Post-generation setup
      await this.postGenerationSetup(projectPath, pluginStructure, projectOptions)

      this.displaySuccessMessage(projectPath, pluginStructure)

    } catch (error) {
      if (this.spinner) {
        this.spinner.fail(`Generation failed: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Get project options interactively
   */
  async getProjectOptions(template, providedOptions = {}) {
    console.log(chalk.cyan(`\n🚀 Creating ${template.name}\n`))
    console.log(chalk.gray(template.description))
    console.log()

    const questions = []

    // Basic project information
    if (!providedOptions.pluginId) {
      questions.push({
        type: 'input',
        name: 'pluginId',
        message: 'Plugin ID (lowercase, hyphens allowed):',
        validate: (value) => {
          if (!value) return 'Plugin ID is required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Plugin ID must contain only lowercase letters, numbers, and hyphens'
          if (value.length < 3) return 'Plugin ID must be at least 3 characters'
          return true
        }
      })
    }

    if (!providedOptions.pluginName) {
      questions.push({
        type: 'input',
        name: 'pluginName',
        message: 'Plugin display name:',
        validate: (value) => value ? true : 'Plugin name is required'
      })
    }

    if (!providedOptions.description) {
      questions.push({
        type: 'input',
        name: 'description',
        message: 'Plugin description:',
        validate: (value) => value ? true : 'Description is required'
      })
    }

    if (!providedOptions.author) {
      questions.push({
        type: 'input',
        name: 'author',
        message: 'Author name:',
        initial: process.env.USER || 'Your Name'
      })
    }

    if (!providedOptions.publisher) {
      questions.push({
        type: 'input',
        name: 'publisher',
        message: 'Publisher (for marketplace):',
        initial: (answers) => answers.author?.toLowerCase().replace(/\s+/g, '-') || 'your-publisher'
      })
    }

    // Development options
    if (!providedOptions.hasOwnProperty('useTypeScript')) {
      questions.push({
        type: 'confirm',
        name: 'useTypeScript',
        message: 'Use TypeScript?',
        initial: true
      })
    }

    if (!providedOptions.hasOwnProperty('includeTests')) {
      questions.push({
        type: 'confirm',
        name: 'includeTests',
        message: 'Include test files?',
        initial: true
      })
    }

    if (!providedOptions.hasOwnProperty('includeDocumentation')) {
      questions.push({
        type: 'confirm',
        name: 'includeDocumentation',
        message: 'Include documentation?',
        initial: true
      })
    }

    // Template-specific customization
    if (template.customization) {
      for (const [key, config] of Object.entries(template.customization)) {
        if (providedOptions[key] !== undefined) continue

        const question = {
          name: key,
          message: config.description || `${key}:`
        }

        switch (config.type) {
          case 'string':
            question.type = 'input'
            question.initial = config.default
            if (config.validation?.pattern) {
              question.validate = (value) => {
                if (config.required && !value) return `${key} is required`
                if (value && !new RegExp(config.validation.pattern).test(value)) {
                  return `${key} does not match required pattern`
                }
                return true
              }
            }
            break

          case 'boolean':
            question.type = 'confirm'
            question.initial = config.default || false
            break

          case 'number':
            question.type = 'numeral'
            question.initial = config.default
            question.validate = (value) => {
              if (config.required && value === undefined) return `${key} is required`
              if (config.validation?.min !== undefined && value < config.validation.min) {
                return `${key} must be >= ${config.validation.min}`
              }
              if (config.validation?.max !== undefined && value > config.validation.max) {
                return `${key} must be <= ${config.validation.max}`
              }
              return true
            }
            break

          case 'enum':
            question.type = 'select'
            question.choices = config.validation?.options || []
            question.initial = config.default
            break
        }

        questions.push(question)
      }
    }

    // Project directory
    if (!providedOptions.projectDirectory) {
      questions.push({
        type: 'input',
        name: 'projectDirectory',
        message: 'Project directory:',
        initial: (answers) => answers.pluginId || providedOptions.pluginId || '.'
      })
    }

    const answers = await prompts(questions)
    
    return {
      ...providedOptions,
      ...answers,
      version: providedOptions.version || '1.0.0',
      license: providedOptions.license || 'MIT'
    }
  }

  /**
   * Validate project directory
   */
  async validateProjectDirectory(directory) {
    try {
      await fs.access(directory)
      
      // Directory exists, check if it's empty
      const files = await fs.readdir(directory)
      if (files.length > 0) {
        const proceed = await prompts({
          type: 'confirm',
          name: 'overwrite',
          message: `Directory "${directory}" is not empty. Continue anyway?`,
          initial: false
        })
        
        if (!proceed.overwrite) {
          return { valid: false, message: 'Operation cancelled by user' }
        }
      }
    } catch (error) {
      // Directory doesn't exist, which is fine
    }

    return { valid: true }
  }

  /**
   * Create project directory structure
   */
  async createProjectStructure(projectPath, structure) {
    // Ensure project directory exists
    await fs.mkdir(projectPath, { recursive: true })

    // Create manifest file
    const manifestPath = path.join(projectPath, 'plugin.json')
    await fs.writeFile(manifestPath, JSON.stringify(structure.manifest, null, 2))

    // Create source files
    for (const [filePath, content] of structure.files) {
      const fullPath = path.join(projectPath, filePath)
      const dir = path.dirname(fullPath)
      
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(fullPath, content)
    }

    // Create documentation files
    if (structure.documentation) {
      for (const [fileName, content] of Object.entries(structure.documentation)) {
        const fullPath = path.join(projectPath, fileName)
        const dir = path.dirname(fullPath)
        
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(fullPath, content)
      }
    }

    // Create build configuration files
    if (structure.buildConfig) {
      for (const [fileName, content] of Object.entries(structure.buildConfig)) {
        const fullPath = path.join(projectPath, fileName)
        await fs.writeFile(fullPath, content)
      }
    }

    // Create metadata file
    const metadataPath = path.join(projectPath, '.lokus-template.json')
    await fs.writeFile(metadataPath, JSON.stringify(structure.metadata, null, 2))
  }

  /**
   * Post-generation setup
   */
  async postGenerationSetup(projectPath, structure, options) {
    // Initialize git repository if requested
    if (options.initGit !== false) {
      try {
        await this.initializeGit(projectPath)
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not initialize git repository'))
      }
    }

    // Install dependencies if package.json was created
    if (structure.buildConfig && structure.buildConfig['package.json']) {
      if (options.installDependencies !== false) {
        await this.installDependencies(projectPath)
      }
    }
  }

  /**
   * Initialize git repository
   */
  async initializeGit(projectPath) {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const exec = promisify(execFile)

    await exec('git', ['init'], { cwd: projectPath })
    await exec('git', ['add', '.'], { cwd: projectPath })
    await exec('git', ['commit', '-m', 'Initial commit from Lokus MCP template'], { cwd: projectPath })
  }

  /**
   * Install dependencies
   */
  async installDependencies(projectPath) {
    const installChoice = await prompts({
      type: 'confirm',
      name: 'install',
      message: 'Install dependencies now?',
      initial: true
    })

    if (!installChoice.install) return

    const packageManager = await this.detectPackageManager(projectPath)
    
    this.spinner = ora(`Installing dependencies with ${packageManager}...`).start()
    
    try {
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const exec = promisify(execFile)

      await exec(packageManager, ['install'], { cwd: projectPath })
      this.spinner.succeed('Dependencies installed successfully')
    } catch (error) {
      this.spinner.fail('Failed to install dependencies')
      console.log(chalk.yellow(`You can install them manually by running: ${packageManager} install`))
    }
  }

  /**
   * Detect preferred package manager
   */
  async detectPackageManager(projectPath) {
    const packageManagers = ['npm', 'yarn', 'pnpm']
    
    for (const pm of packageManagers) {
      try {
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const exec = promisify(execFile)
        
        await exec(pm, ['--version'])
        return pm
      } catch (error) {
        // Package manager not available
      }
    }
    
    return 'npm' // fallback
  }

  /**
   * Display success message
   */
  displaySuccessMessage(projectPath, structure) {
    const projectName = path.basename(projectPath)
    
    console.log()
    console.log(chalk.green('✅ Plugin generated successfully!'))
    console.log()
    console.log(chalk.cyan('📁 Project created at:'), chalk.bold(projectPath))
    console.log(chalk.cyan('🔧 Template used:'), structure.metadata.templateName)
    console.log()
    console.log(chalk.yellow('Next steps:'))
    console.log(`  ${chalk.dim('1.')} cd ${projectName}`)
    
    if (structure.metadata.useTypeScript) {
      console.log(`  ${chalk.dim('2.')} npm run build`)
      console.log(`  ${chalk.dim('3.')} npm run dev`)
    } else {
      console.log(`  ${chalk.dim('2.')} npm run dev`)
    }
    
    console.log(`  ${chalk.dim('4.')} Edit plugin.json to configure your plugin`)
    console.log()
    console.log(chalk.gray('📖 Check README.md for detailed instructions'))
    console.log()
  }

  /**
   * List available templates
   */
  listTemplates(filter = {}) {
    const templates = this.templateGenerator.getAvailableTemplates()
    let filteredTemplates = templates

    if (filter.category) {
      filteredTemplates = filteredTemplates.filter(t => t.category === filter.category)
    }

    if (filter.complexity) {
      filteredTemplates = filteredTemplates.filter(t => t.complexity === filter.complexity)
    }

    if (filter.features && filter.features.length > 0) {
      filteredTemplates = filteredTemplates.filter(t => 
        filter.features.some(feature => t.features?.includes(feature))
      )
    }

    console.log(chalk.cyan('\n📋 Available MCP Plugin Templates\n'))

    const categories = {}
    for (const template of filteredTemplates) {
      if (!categories[template.category]) {
        categories[template.category] = []
      }
      categories[template.category].push(template)
    }

    for (const [category, templates] of Object.entries(categories)) {
      console.log(chalk.yellow(`\n${category.toUpperCase()}:`))
      
      for (const template of templates) {
        const complexity = template.complexity ? chalk.gray(`(${template.complexity})`) : ''
        const features = template.features ? chalk.dim(`[${template.features.slice(0, 3).join(', ')}${template.features.length > 3 ? '...' : ''}]`) : ''
        
        console.log(`  ${chalk.green('●')} ${chalk.bold(template.name)} ${complexity}`)
        console.log(`    ${chalk.gray(template.description)}`)
        console.log(`    ${chalk.cyan('ID:')} ${template.type} ${features}`)
        console.log()
      }
    }

    console.log(chalk.gray(`Total: ${filteredTemplates.length} templates`))
    console.log()
  }

  /**
   * Show template details
   */
  showTemplate(templateType) {
    const template = this.templateGenerator.getTemplate(templateType)
    
    if (!template) {
      console.log(chalk.red(`❌ Template "${templateType}" not found`))
      return
    }

    console.log(chalk.cyan(`\n📋 Template: ${template.name}\n`))
    console.log(chalk.bold('Description:'), template.description)
    console.log(chalk.bold('Category:'), template.category)
    console.log(chalk.bold('Complexity:'), template.complexity || 'not specified')
    console.log(chalk.bold('Version:'), template.version)
    
    if (template.author) {
      console.log(chalk.bold('Author:'), template.author.name)
    }
    
    if (template.features && template.features.length > 0) {
      console.log(chalk.bold('Features:'))
      for (const feature of template.features) {
        console.log(`  ${chalk.green('●')} ${feature}`)
      }
    }

    if (template.customization && Object.keys(template.customization).length > 0) {
      console.log(chalk.bold('\nCustomization Options:'))
      for (const [key, config] of Object.entries(template.customization)) {
        const required = config.required ? chalk.red('*') : ''
        const defaultValue = config.default ? chalk.gray(`(default: ${config.default})`) : ''
        console.log(`  ${chalk.yellow(key)}${required} ${chalk.dim(`[${config.type}]`)} ${defaultValue}`)
        if (config.description) {
          console.log(`    ${chalk.gray(config.description)}`)
        }
      }
    }

    console.log(chalk.bold('\nGenerate this template:'))
    console.log(chalk.gray(`  lokus-plugin create ${templateType} [options]`))
    console.log()
  }

  /**
   * Interactive template selection and generation
   */
  async interactiveGeneration() {
    console.log(chalk.cyan('🎯 Interactive MCP Plugin Generator\n'))

    // Select template category
    const categoryChoice = await prompts({
      type: 'select',
      name: 'category',
      message: 'Select a template category:',
      choices: Object.entries(TEMPLATE_CATEGORIES).map(([key, value]) => ({
        title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value,
        description: this.templateGenerator.config.getCategoryInfo(value)?.description || ''
      }))
    })

    if (!categoryChoice.category) {
      console.log(chalk.yellow('Operation cancelled'))
      return
    }

    // Get templates in selected category
    const templates = this.templateGenerator.getTemplatesByCategory(categoryChoice.category)
    
    if (templates.length === 0) {
      console.log(chalk.red('No templates found in this category'))
      return
    }

    // Select specific template
    const templateChoice = await prompts({
      type: 'select',
      name: 'template',
      message: 'Select a template:',
      choices: templates.map(template => ({
        title: template.name,
        value: template.type,
        description: template.description
      }))
    })

    if (!templateChoice.template) {
      console.log(chalk.yellow('Operation cancelled'))
      return
    }

    // Generate project
    await this.generateProject(templateChoice.template)
  }
}

/**
 * Command definitions for CLI
 */
export const CLICommands = {
  create: {
    name: 'create',
    description: 'Create a new MCP plugin from template',
    options: [
      {
        name: 'template',
        description: 'Template type to use',
        type: 'choice',
        required: true,
        choices: Object.values(TEMPLATE_TYPES)
      },
      {
        name: 'name',
        description: 'Plugin name',
        type: 'string',
        alias: 'n'
      },
      {
        name: 'id',
        description: 'Plugin ID',
        type: 'string',
        alias: 'i'
      },
      {
        name: 'directory',
        description: 'Project directory',
        type: 'string',
        alias: 'd'
      },
      {
        name: 'typescript',
        description: 'Use TypeScript',
        type: 'boolean',
        alias: 't',
        default: true
      },
      {
        name: 'no-tests',
        description: 'Skip test files',
        type: 'boolean'
      },
      {
        name: 'no-docs',
        description: 'Skip documentation',
        type: 'boolean'
      },
      {
        name: 'no-install',
        description: 'Skip dependency installation',
        type: 'boolean'
      },
      {
        name: 'no-git',
        description: 'Skip git initialization',
        type: 'boolean'
      }
    ],
    action: async (options) => {
      const generator = new CLITemplateGenerator()
      await generator.generateProject(options.template, {
        pluginName: options.name,
        pluginId: options.id,
        projectDirectory: options.directory,
        useTypeScript: options.typescript && !options['no-typescript'],
        includeTests: !options['no-tests'],
        includeDocumentation: !options['no-docs'],
        installDependencies: !options['no-install'],
        initGit: !options['no-git']
      })
    }
  },

  list: {
    name: 'list',
    description: 'List available templates',
    options: [
      {
        name: 'category',
        description: 'Filter by category',
        type: 'choice',
        choices: Object.values(TEMPLATE_CATEGORIES),
        alias: 'c'
      },
      {
        name: 'complexity',
        description: 'Filter by complexity',
        type: 'choice',
        choices: Object.values(TEMPLATE_COMPLEXITY),
        alias: 'x'
      }
    ],
    action: async (options) => {
      const generator = new CLITemplateGenerator()
      generator.listTemplates({
        category: options.category,
        complexity: options.complexity
      })
    }
  },

  show: {
    name: 'show',
    description: 'Show template details',
    options: [
      {
        name: 'template',
        description: 'Template type to show',
        type: 'choice',
        required: true,
        choices: Object.values(TEMPLATE_TYPES)
      }
    ],
    action: async (options) => {
      const generator = new CLITemplateGenerator()
      generator.showTemplate(options.template)
    }
  },

  interactive: {
    name: 'interactive',
    description: 'Interactive template selection and generation',
    alias: 'i',
    options: [],
    action: async (options) => {
      const generator = new CLITemplateGenerator()
      await generator.interactiveGeneration()
    }
  }
}

export default CLITemplateGenerator