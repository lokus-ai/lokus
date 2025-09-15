import { Command } from 'commander';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { FileUtils } from '../utils/file-utils';
import { pluginValidator } from '../utils/plugin-validator';

export interface PluginTemplate {
  name: string;
  description: string;
  templateDir: string;
  permissions: string[];
  dependencies: Record<string, string>;
}

export const pluginTemplates: Record<string, PluginTemplate> = {
  basic: {
    name: 'Basic Plugin',
    description: 'A simple plugin with basic functionality',
    templateDir: 'basic-plugin',
    permissions: [],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0'
    }
  },
  'ui-extension': {
    name: 'UI Extension',
    description: 'Extends Lokus UI with custom components and views',
    templateDir: 'ui-extension-plugin',
    permissions: ['ui:notifications', 'ui:dialogs'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'react': '^18.0.0',
      '@types/react': '^18.0.0'
    }
  },
  'language-support': {
    name: 'Language Support',
    description: 'Adds support for a new programming language',
    templateDir: 'language-support-plugin',
    permissions: ['editor:read', 'editor:write'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'vscode-languageserver': '^8.0.0',
      'vscode-languageserver-textdocument': '^1.0.0'
    }
  },
  'theme': {
    name: 'Theme Plugin',
    description: 'Creates custom themes for the editor',
    templateDir: 'theme-plugin',
    permissions: [],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0'
    }
  },
  'debugger': {
    name: 'Debugger Extension',
    description: 'Adds debugging support for a language',
    templateDir: 'debug-adapter-plugin',
    permissions: ['debug:access', 'terminal:access'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'vscode-debugadapter': '^1.50.0'
    }
  },
  'task-provider': {
    name: 'Task Provider',
    description: 'Provides custom task execution capabilities',
    templateDir: 'task-provider-plugin',
    permissions: ['terminal:access', 'filesystem:read'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0'
    }
  },
  'command': {
    name: 'Command Plugin',
    description: 'Adds custom commands to the command palette',
    templateDir: 'command-plugin',
    permissions: ['workspace:read', 'workspace:write'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0'
    }
  }
};

export interface CreateOptions {
  template?: string;
  name?: string;
  author?: string;
  description?: string;
  skipPrompts?: boolean;
  typescript?: boolean;
  git?: boolean;
  install?: boolean;
}

async function promptForPluginDetails(name?: string): Promise<{
  pluginName: string;
  template: string;
  author: string;
  description: string;
  typescript: boolean;
  initGit: boolean;
  installDeps: boolean;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'pluginName',
      message: 'Plugin name:',
      default: name,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Plugin name is required';
        }
        if (!pluginValidator.validatePluginName(input.trim())) {
          return 'Plugin name must be lowercase, alphanumeric with hyphens, 3-50 characters, and not reserved';
        }
        return true;
      },
      filter: (input: string) => input.trim().toLowerCase()
    },
    {
      type: 'list',
      name: 'template',
      message: 'Choose a template:',
      choices: Object.entries(pluginTemplates).map(([key, template]) => ({
        name: `${template.name} - ${template.description}`,
        value: key
      }))
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author name:',
      validate: (input: string) => input.trim() ? true : 'Author name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Plugin description:',
      validate: (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return 'Description is required';
        if (trimmed.length < 10) return 'Description must be at least 10 characters';
        if (trimmed.length > 200) return 'Description must be less than 200 characters';
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true
    },
    {
      type: 'confirm',
      name: 'initGit',
      message: 'Initialize Git repository?',
      default: true
    },
    {
      type: 'confirm',
      name: 'installDeps',
      message: 'Install dependencies after creation?',
      default: true
    }
  ]);

  return answers;
}

async function createPluginFromTemplate(
  pluginName: string,
  targetDir: string,
  template: PluginTemplate,
  options: {
    author: string;
    description: string;
    typescript: boolean;
  }
): Promise<void> {
  const templateDir = path.join(__dirname, '../../templates', template.templateDir);
  
  // Check if template exists
  if (!await fs.pathExists(templateDir)) {
    throw ErrorHandler.createError(
      'FileNotFoundError',
      `Template not found: ${template.templateDir}`
    );
  }

  const templateVars = {
    pluginName,
    pluginNameCamelCase: pluginName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()),
    pluginNamePascalCase: pluginName.replace(/(^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase()),
    author: options.author,
    description: options.description,
    typescript: options.typescript,
    currentYear: new Date().getFullYear(),
    sdkVersion: '^1.0.0'
  };

  const exclude = options.typescript ? ['**/*.js'] : ['**/*.ts', 'tsconfig.json'];

  await FileUtils.copyTemplateDir(templateDir, targetDir, templateVars, { exclude });

  // Create plugin.json
  const pluginManifest = {
    name: pluginName,
    version: '0.1.0',
    description: options.description,
    author: options.author,
    main: options.typescript ? 'dist/index.js' : 'src/index.js',
    engines: {
      lokus: '^1.0.0'
    },
    permissions: template.permissions,
    categories: getPluginCategories(template.name),
    keywords: [pluginName, 'lokus', 'plugin'],
    contributes: getPluginContributions(template.name)
  };

  await FileUtils.writeJsonFile(path.join(targetDir, 'plugin.json'), pluginManifest);

  // Create package.json
  const packageJson = {
    name: pluginName,
    version: '0.1.0',
    description: options.description,
    author: options.author,
    license: 'MIT',
    main: options.typescript ? 'dist/index.js' : 'src/index.js',
    scripts: {
      ...(options.typescript ? {
        'build': 'tsc',
        'build:watch': 'tsc --watch',
        'dev': 'lokus-plugin dev',
        'test': 'jest',
        'lint': 'eslint src/**/*.ts',
        'lint:fix': 'eslint src/**/*.ts --fix'
      } : {
        'dev': 'lokus-plugin dev',
        'test': 'jest',
        'lint': 'eslint src/**/*.js',
        'lint:fix': 'eslint src/**/*.js --fix'
      })
    },
    dependencies: template.dependencies,
    devDependencies: {
      '@types/jest': '^29.5.5',
      'jest': '^29.7.0',
      'eslint': '^8.50.0',
      ...(options.typescript ? {
        'typescript': '^5.2.2',
        '@types/node': '^20.8.0',
        '@typescript-eslint/eslint-plugin': '^6.7.0',
        '@typescript-eslint/parser': '^6.7.0'
      } : {})
    },
    engines: {
      node: '>=16.0.0'
    }
  };

  await FileUtils.writeJsonFile(path.join(targetDir, 'package.json'), packageJson);
}

function getPluginCategories(templateName: string): string[] {
  const categoryMap: Record<string, string[]> = {
    'Basic Plugin': ['Other'],
    'UI Extension': ['Other'],
    'Language Support': ['Language'],
    'Theme Plugin': ['Theme'],
    'Debugger Extension': ['Debugger'],
    'Task Provider': ['Other'],
    'Command Plugin': ['Other']
  };
  
  return categoryMap[templateName] || ['Other'];
}

function getPluginContributions(templateName: string): any {
  const contributionMap: Record<string, any> = {
    'Language Support': {
      languages: [{
        id: 'my-language',
        aliases: ['My Language'],
        extensions: ['.mylang']
      }]
    },
    'Theme Plugin': {
      themes: [{
        label: 'My Theme',
        uiTheme: 'vs-dark',
        path: './themes/my-theme.json'
      }]
    },
    'Debugger Extension': {
      debuggers: [{
        type: 'my-debugger',
        label: 'My Debugger'
      }]
    },
    'Command Plugin': {
      commands: [{
        command: 'myPlugin.helloWorld',
        title: 'Hello World'
      }]
    }
  };
  
  return contributionMap[templateName] || {};
}

async function initializeGit(targetDir: string): Promise<void> {
  const { execSync } = require('child_process');
  
  try {
    execSync('git init', { cwd: targetDir, stdio: 'pipe' });
    
    // Create .gitignore
    const gitignore = `
# Dependencies
node_modules/
npm-debug.log*

# Build output
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Coverage
coverage/

# Temporary files
.tmp/
temp/
`;
    
    await fs.writeFile(path.join(targetDir, '.gitignore'), gitignore.trim());
    
    execSync('git add .', { cwd: targetDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: targetDir, stdio: 'pipe' });
    
    logger.success('Git repository initialized');
  } catch (error) {
    logger.warning('Failed to initialize Git repository');
  }
}

async function installDependencies(targetDir: string): Promise<void> {
  const { execSync } = require('child_process');
  
  try {
    logger.info('Installing dependencies...');
    const spinner = logger.startSpinner('Installing packages');
    
    execSync('npm install', { 
      cwd: targetDir, 
      stdio: 'pipe',
      timeout: 300000 // 5 minutes timeout
    });
    
    spinner.succeed('Dependencies installed successfully');
  } catch (error) {
    logger.stopSpinner(false, 'Failed to install dependencies');
    logger.warning('You can install dependencies manually by running: npm install');
  }
}

export const createCommand = new Command('create')
  .description('Create a new Lokus plugin')
  .argument('[name]', 'plugin name')
  .option('-t, --template <template>', 'plugin template to use')
  .option('-a, --author <author>', 'plugin author')
  .option('-d, --description <description>', 'plugin description')
  .option('--skip-prompts', 'skip interactive prompts and use defaults')
  .option('--no-typescript', 'create JavaScript plugin instead of TypeScript')
  .option('--no-git', 'skip Git repository initialization')
  .option('--no-install', 'skip dependency installation')
  .action(async (name: string | undefined, options: CreateOptions) => {
    try {
      await ErrorHandler.validateNodeEnvironment();

      logger.header('🚀 Create Lokus Plugin');

      let pluginDetails;
      
      if (options.skipPrompts) {
        if (!name) {
          throw ErrorHandler.createError('ValidationError', 'Plugin name is required when skipping prompts');
        }
        
        pluginDetails = {
          pluginName: name,
          template: options.template || 'basic',
          author: options.author || 'Unknown',
          description: options.description || 'A Lokus plugin',
          typescript: options.typescript !== false,
          initGit: options.git !== false,
          installDeps: options.install !== false
        };
      } else {
        pluginDetails = await promptForPluginDetails(name);
      }

      const { pluginName, template, author, description, typescript, initGit, installDeps } = pluginDetails;
      
      // Validate plugin name
      if (!pluginValidator.validatePluginName(pluginName)) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Invalid plugin name. Must be lowercase, alphanumeric with hyphens, 3-50 characters.'
        );
      }

      // Check if template exists
      if (!pluginTemplates[template]) {
        throw ErrorHandler.createError(
          'ValidationError',
          `Unknown template: ${template}. Available templates: ${Object.keys(pluginTemplates).join(', ')}`
        );
      }

      const targetDir = path.resolve(process.cwd(), pluginName);
      
      // Check if directory already exists
      if (await fs.pathExists(targetDir)) {
        const { overwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: `Directory ${pluginName} already exists. Overwrite?`,
          default: false
        }]);
        
        if (!overwrite) {
          logger.info('Plugin creation cancelled');
          return;
        }
        
        await fs.remove(targetDir);
      }

      logger.info(`Creating plugin: ${chalk.cyan(pluginName)}`);
      logger.info(`Template: ${chalk.cyan(pluginTemplates[template].name)}`);
      logger.info(`Location: ${chalk.cyan(targetDir)}`);
      logger.newLine();

      const spinner = logger.startSpinner('Creating plugin structure...');
      
      // Create plugin from template
      await createPluginFromTemplate(
        pluginName,
        targetDir,
        pluginTemplates[template],
        { author, description, typescript }
      );
      
      spinner.succeed('Plugin structure created');

      // Initialize Git if requested
      if (initGit) {
        await initializeGit(targetDir);
      }

      // Install dependencies if requested
      if (installDeps) {
        await installDependencies(targetDir);
      }

      // Validate the created plugin
      await pluginValidator.validatePluginStructure(targetDir);

      logger.newLine();
      logger.success(`Plugin ${chalk.cyan(pluginName)} created successfully!`);
      logger.newLine();
      
      logger.info('Next steps:');
      logger.info(`  cd ${pluginName}`);
      if (!installDeps) {
        logger.info('  npm install');
      }
      logger.info('  lokus-plugin dev');
      logger.newLine();
      
      logger.info('Documentation:');
      logger.info('  📖 Plugin Development: https://lokus.dev/docs/plugin-development');
      logger.info('  🔌 Plugin API: https://lokus.dev/docs/plugin-api');
      logger.info('  💬 Community: https://discord.gg/lokus');

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });