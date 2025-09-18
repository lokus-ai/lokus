import { Command } from 'commander';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { Listr } from 'listr2';
import { execa } from 'execa';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';
import { TemplateManager } from '../utils/template-manager';
import { ProjectScaffolder } from '../utils/project-scaffolder';
import { DependencyManager } from '../utils/dependency-manager';

export interface AdvancedPluginTemplate {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: 'Editor' | 'UI' | 'Language' | 'Theme' | 'Integration' | 'Tool' | 'Data';
  complexity: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  features: string[];
  technologies: string[];
  permissions: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  templatePath: string;
  exampleUrl?: string;
  documentationUrl?: string;
  iconEmoji: string;
}

export const advancedPluginTemplates: Record<string, AdvancedPluginTemplate> = {
  'basic-typescript': {
    id: 'basic-typescript',
    name: 'Basic TypeScript Plugin',
    description: 'A minimal plugin with TypeScript and modern tooling',
    longDescription: 'Perfect starting point for new plugin developers. Includes TypeScript, ESLint, Prettier, Jest testing, and comprehensive documentation templates.',
    category: 'Editor',
    complexity: 'Beginner',
    estimatedTime: '30 minutes',
    features: ['TypeScript support', 'Unit testing', 'Linting & formatting', 'CI/CD ready', 'Documentation'],
    technologies: ['TypeScript', 'Jest', 'ESLint', 'Prettier'],
    permissions: [],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0'
    },
    devDependencies: {
      'typescript': '^5.2.2',
      '@types/node': '^20.8.0',
      'jest': '^29.7.0',
      '@types/jest': '^29.5.5',
      'eslint': '^8.50.0',
      'prettier': '^3.0.3'
    },
    templatePath: 'templates/basic-typescript',
    iconEmoji: '🚀'
  },
  'react-ui-panel': {
    id: 'react-ui-panel',
    name: 'React UI Panel Extension',
    description: 'Create custom UI panels with React components',
    longDescription: 'Build sophisticated user interfaces with React. Includes modern React patterns, styled-components, state management, and comprehensive testing with React Testing Library.',
    category: 'UI',
    complexity: 'Intermediate',
    estimatedTime: '2-3 hours',
    features: ['React 18', 'Styled Components', 'State Management', 'Component Testing', 'Storybook', 'Hot Reload'],
    technologies: ['React', 'TypeScript', 'Styled Components', 'React Testing Library', 'Storybook'],
    permissions: ['ui:panels', 'ui:notifications', 'ui:dialogs'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'styled-components': '^6.0.8',
      'zustand': '^4.4.3'
    },
    devDependencies: {
      '@types/react': '^18.2.25',
      '@types/react-dom': '^18.2.11',
      '@types/styled-components': '^5.1.28',
      '@storybook/react': '^7.4.6',
      '@testing-library/react': '^13.4.0',
      '@testing-library/jest-dom': '^6.1.4'
    },
    templatePath: 'templates/react-ui-panel',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/react-ui-panel',
    documentationUrl: 'https://lokus.dev/docs/ui-extensions',
    iconEmoji: '⚛️'
  },
  'language-server': {
    id: 'language-server',
    name: 'Language Server Protocol',
    description: 'Full language support with LSP integration',
    longDescription: 'Implement comprehensive language support including syntax highlighting, code completion, diagnostics, formatting, and more using the Language Server Protocol.',
    category: 'Language',
    complexity: 'Advanced',
    estimatedTime: '1-2 days',
    features: ['LSP Integration', 'Syntax Highlighting', 'Code Completion', 'Diagnostics', 'Formatting', 'Go to Definition'],
    technologies: ['TypeScript', 'Language Server Protocol', 'Tree-sitter', 'Monaco Editor'],
    permissions: ['editor:read', 'editor:write', 'editor:decorations', 'filesystem:read'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'vscode-languageserver': '^8.1.0',
      'vscode-languageserver-textdocument': '^1.0.11',
      'vscode-uri': '^3.0.7'
    },
    devDependencies: {
      'vscode-languageserver-protocol': '^3.17.3',
      '@types/vscode': '^1.83.0'
    },
    templatePath: 'templates/language-server',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/language-server',
    documentationUrl: 'https://lokus.dev/docs/language-support',
    iconEmoji: '🔤'
  },
  'custom-theme': {
    id: 'custom-theme',
    name: 'Custom Theme Creator',
    description: 'Create beautiful themes with live preview',
    longDescription: 'Design stunning themes for Lokus with a comprehensive theme development kit. Includes color palette generator, live preview, and theme validation.',
    category: 'Theme',
    complexity: 'Beginner',
    estimatedTime: '1-2 hours',
    features: ['Color Palette Generator', 'Live Preview', 'Theme Validation', 'Export Tools', 'Dark/Light Variants'],
    technologies: ['CSS Variables', 'PostCSS', 'Color Theory', 'Design Tokens'],
    permissions: ['ui:themes'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'chroma-js': '^2.4.2'
    },
    devDependencies: {
      'postcss': '^8.4.31',
      'autoprefixer': '^10.4.16',
      '@types/chroma-js': '^2.4.2'
    },
    templatePath: 'templates/custom-theme',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/custom-theme',
    documentationUrl: 'https://lokus.dev/docs/themes',
    iconEmoji: '🎨'
  },
  'api-integration': {
    id: 'api-integration',
    name: 'API Integration Plugin',
    description: 'Connect external APIs and services',
    longDescription: 'Integrate with external APIs, webhooks, and services. Includes authentication, request/response handling, error management, and offline support.',
    category: 'Integration',
    complexity: 'Intermediate',
    estimatedTime: '3-4 hours',
    features: ['HTTP Client', 'Authentication', 'WebSocket Support', 'Offline Caching', 'Rate Limiting', 'Error Handling'],
    technologies: ['Axios', 'WebSocket', 'JWT', 'IndexedDB', 'Service Workers'],
    permissions: ['network:http', 'storage:local', 'notifications:show'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'axios': '^1.5.1',
      'ws': '^8.14.2',
      'idb': '^7.1.1',
      'jsonwebtoken': '^9.0.2'
    },
    devDependencies: {
      '@types/ws': '^8.5.7',
      '@types/jsonwebtoken': '^9.0.3',
      'msw': '^1.3.2'
    },
    templatePath: 'templates/api-integration',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/api-integration',
    documentationUrl: 'https://lokus.dev/docs/integrations',
    iconEmoji: '🔌'
  },
  'data-visualization': {
    id: 'data-visualization',
    name: 'Data Visualization',
    description: 'Interactive charts and data displays',
    longDescription: 'Create stunning data visualizations and interactive charts. Includes D3.js, Chart.js, and custom visualization components with real-time data support.',
    category: 'Data',
    complexity: 'Advanced',
    estimatedTime: '4-6 hours',
    features: ['D3.js Integration', 'Interactive Charts', 'Real-time Updates', 'Export Options', 'Custom Visualizations'],
    technologies: ['D3.js', 'Chart.js', 'Canvas API', 'SVG', 'WebGL'],
    permissions: ['ui:panels', 'data:read', 'filesystem:write'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'd3': '^7.8.5',
      'chart.js': '^4.4.0',
      'chartjs-adapter-date-fns': '^3.0.0'
    },
    devDependencies: {
      '@types/d3': '^7.4.2',
      'canvas': '^2.11.2'
    },
    templatePath: 'templates/data-visualization',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/data-visualization',
    documentationUrl: 'https://lokus.dev/docs/data-visualization',
    iconEmoji: '📊'
  },
  'git-integration': {
    id: 'git-integration',
    name: 'Git Integration Tool',
    description: 'Advanced Git workflow management',
    longDescription: 'Enhance Git workflows with visual diff, branch management, merge conflict resolution, and integration with popular Git hosting services.',
    category: 'Tool',
    complexity: 'Advanced',
    estimatedTime: '1-2 days',
    features: ['Visual Diff', 'Branch Management', 'Merge Conflicts', 'GitHub/GitLab Integration', 'Commit Templates'],
    technologies: ['isomorphic-git', 'diff2html', 'GitLab/GitHub APIs'],
    permissions: ['filesystem:read', 'filesystem:write', 'network:http', 'terminal:access'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'isomorphic-git': '^1.24.5',
      'diff2html': '^3.4.42',
      '@octokit/rest': '^20.0.2'
    },
    devDependencies: {
      '@types/diff2html': '^3.4.3'
    },
    templatePath: 'templates/git-integration',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/git-integration',
    documentationUrl: 'https://lokus.dev/docs/git-tools',
    iconEmoji: '🌿'
  },
  'ai-assistant': {
    id: 'ai-assistant',
    name: 'AI Assistant Plugin',
    description: 'AI-powered coding assistant',
    longDescription: 'Build AI-powered features like code completion, documentation generation, code review, and intelligent refactoring using modern AI APIs.',
    category: 'Tool',
    complexity: 'Advanced',
    estimatedTime: '2-3 days',
    features: ['Code Completion', 'Documentation Generation', 'Code Review', 'Refactoring', 'Natural Language Processing'],
    technologies: ['OpenAI API', 'Transformers.js', 'TensorFlow.js', 'Hugging Face'],
    permissions: ['editor:read', 'editor:write', 'network:http', 'ai:inference'],
    dependencies: {
      '@lokus/plugin-sdk': '^1.0.0',
      'openai': '^4.11.1',
      '@huggingface/inference': '^2.6.4',
      '@tensorflow/tfjs': '^4.10.0'
    },
    devDependencies: {
      '@types/tensorflow__tfjs': '^4.0.1'
    },
    templatePath: 'templates/ai-assistant',
    exampleUrl: 'https://github.com/lokus/plugin-examples/tree/main/ai-assistant',
    documentationUrl: 'https://lokus.dev/docs/ai-plugins',
    iconEmoji: '🤖'
  }
};

export interface AdvancedCreateOptions {
  template?: string;
  name?: string;
  author?: string;
  description?: string;
  category?: string;
  complexity?: string;
  skipPrompts?: boolean;
  typescript?: boolean;
  git?: boolean;
  install?: boolean;
  testing?: 'jest' | 'vitest' | 'none';
  linting?: 'eslint' | 'biome' | 'none';
  formatting?: 'prettier' | 'biome' | 'none';
  bundler?: 'esbuild' | 'webpack' | 'rollup' | 'vite';
  cicd?: 'github' | 'gitlab' | 'none';
  documentation?: 'typedoc' | 'jsdoc' | 'none';
  examples?: boolean;
  storybook?: boolean;
  workspace?: boolean;
}

async function showWelcomeScreen(): Promise<void> {
  console.clear();
  
  const lokusTitle = figlet.textSync('LOKUS PLUGIN', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  const gradientTitle = gradient(['#ff6b6b', '#4ecdc4', '#45b7d1'])(lokusTitle);
  console.log(gradientTitle);
  
  const welcomeMessage = boxen(
    chalk.white.bold('🚀 Advanced Plugin Generator\n\n') +
    chalk.gray('Create professional-grade Lokus plugins with modern tooling,\n') +
    chalk.gray('best practices, and comprehensive templates.\n\n') +
    chalk.cyan('✨ TypeScript-first development\n') +
    chalk.cyan('🔧 Modern build tools & testing\n') +
    chalk.cyan('📚 Auto-generated documentation\n') +
    chalk.cyan('🎨 Beautiful UI components\n') +
    chalk.cyan('🤖 AI-powered assistance\n\n') +
    chalk.yellow('Ready to build something amazing?'),
    {
      title: chalk.green.bold('Welcome'),
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
      backgroundColor: '#1e1e1e'
    }
  );
  
  console.log(welcomeMessage);
  console.log('');
}

async function promptForAdvancedPluginDetails(name?: string): Promise<{
  pluginName: string;
  template: AdvancedPluginTemplate;
  author: string;
  description: string;
  category: string;
  complexity: string;
  typescript: boolean;
  testing: string;
  linting: string;
  formatting: string;
  bundler: string;
  cicd: string;
  documentation: string;
  examples: boolean;
  storybook: boolean;
  initGit: boolean;
  installDeps: boolean;
  workspace: boolean;
}> {
  
  // First, let user browse templates by category
  const categoryChoices = [
    { name: '🚀 Editor Extensions - Enhance the core editing experience', value: 'Editor' },
    { name: '⚛️ UI Components - Create custom user interfaces', value: 'UI' },
    { name: '🔤 Language Support - Add programming language features', value: 'Language' },
    { name: '🎨 Themes - Design beautiful color schemes', value: 'Theme' },
    { name: '🔌 Integrations - Connect external services', value: 'Integration' },
    { name: '🛠️ Tools - Build developer productivity tools', value: 'Tool' },
    { name: '📊 Data - Visualize and analyze data', value: 'Data' }
  ];

  const { selectedCategory } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedCategory',
    message: 'What type of plugin would you like to create?',
    choices: categoryChoices,
    pageSize: 10
  }]);

  // Filter templates by category
  const categoryTemplates = Object.values(advancedPluginTemplates)
    .filter(template => template.category === selectedCategory);

  const templateChoices = categoryTemplates.map(template => ({
    name: `${template.iconEmoji} ${chalk.bold(template.name)} ${chalk.gray(`(${template.complexity})`)}
    ${chalk.dim(template.description)}
    ${chalk.yellow(`⏱️ ${template.estimatedTime}`)} | ${chalk.blue(template.features.slice(0, 3).join(', '))}`,
    value: template.id,
    short: template.name
  }));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateId',
      message: `Choose a ${selectedCategory.toLowerCase()} template:`,
      choices: templateChoices,
      pageSize: 8
    },
    {
      type: 'input',
      name: 'pluginName',
      message: 'Plugin name:',
      default: name,
      validate: (input: string) => {
        if (!input.trim()) return 'Plugin name is required';
        if (!pluginValidator.validatePluginName(input.trim())) {
          return 'Plugin name must be lowercase, alphanumeric with hyphens, 3-50 characters';
        }
        return true;
      },
      filter: (input: string) => input.trim().toLowerCase(),
      transformer: (input: string) => chalk.cyan(input)
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author name:',
      validate: (input: string) => input.trim() ? true : 'Author name is required',
      transformer: (input: string) => chalk.green(input)
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
      },
      transformer: (input: string) => chalk.yellow(input)
    }
  ]);

  const selectedTemplate = advancedPluginTemplates[answers.templateId];

  // Show template details and confirm
  const templateInfo = boxen(
    `${selectedTemplate.iconEmoji} ${chalk.bold.white(selectedTemplate.name)}\n\n` +
    `${chalk.gray(selectedTemplate.longDescription)}\n\n` +
    `${chalk.bold('Features:')}\n${selectedTemplate.features.map(f => `• ${f}`).join('\n')}\n\n` +
    `${chalk.bold('Technologies:')}\n${selectedTemplate.technologies.map(t => `• ${t}`).join('\n')}\n\n` +
    `${chalk.bold('Complexity:')} ${selectedTemplate.complexity}\n` +
    `${chalk.bold('Estimated Time:')} ${selectedTemplate.estimatedTime}`,
    {
      title: 'Template Details',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'blue'
    }
  );

  console.log('\n' + templateInfo + '\n');

  const { confirmTemplate } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmTemplate',
    message: 'Continue with this template?',
    default: true
  }]);

  if (!confirmTemplate) {
    console.log(chalk.yellow('Template selection cancelled.'));
    process.exit(0);
  }

  // Advanced configuration options
  const advancedOptions = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true
    },
    {
      type: 'list',
      name: 'testing',
      message: 'Choose testing framework:',
      choices: [
        { name: '🃏 Jest - Popular testing framework with great TypeScript support', value: 'jest' },
        { name: '⚡ Vitest - Fast Vite-native testing framework', value: 'vitest' },
        { name: '❌ None - Skip testing setup', value: 'none' }
      ],
      default: 'jest'
    },
    {
      type: 'list',
      name: 'linting',
      message: 'Choose linting tool:',
      choices: [
        { name: '📏 ESLint - Industry standard JavaScript linter', value: 'eslint' },
        { name: '🚀 Biome - Fast all-in-one toolchain', value: 'biome' },
        { name: '❌ None - Skip linting setup', value: 'none' }
      ],
      default: 'eslint'
    },
    {
      type: 'list',
      name: 'formatting',
      message: 'Choose code formatter:',
      choices: [
        { name: '✨ Prettier - Opinionated code formatter', value: 'prettier' },
        { name: '🚀 Biome - Fast all-in-one formatter', value: 'biome' },
        { name: '❌ None - Skip formatting setup', value: 'none' }
      ],
      default: 'prettier'
    },
    {
      type: 'list',
      name: 'bundler',
      message: 'Choose build tool:',
      choices: [
        { name: '⚡ esbuild - Extremely fast JavaScript bundler', value: 'esbuild' },
        { name: '📦 Webpack - Feature-rich bundler with plugins', value: 'webpack' },
        { name: '🎯 Rollup - Optimized ES module bundler', value: 'rollup' },
        { name: '🔥 Vite - Next generation frontend tooling', value: 'vite' }
      ],
      default: 'esbuild'
    },
    {
      type: 'list',
      name: 'cicd',
      message: 'Setup CI/CD pipeline:',
      choices: [
        { name: '🐙 GitHub Actions - Integrated with GitHub', value: 'github' },
        { name: '🦊 GitLab CI - GitLab integrated pipelines', value: 'gitlab' },
        { name: '❌ None - Skip CI/CD setup', value: 'none' }
      ],
      default: 'github'
    },
    {
      type: 'list',
      name: 'documentation',
      message: 'Choose documentation generator:',
      choices: [
        { name: '📖 TypeDoc - Generate docs from TypeScript', value: 'typedoc' },
        { name: '📝 JSDoc - JavaScript documentation generator', value: 'jsdoc' },
        { name: '❌ None - Skip documentation setup', value: 'none' }
      ],
      default: 'typedoc'
    }
  ]);

  // Conditional prompts based on template
  let conditionalOptions: any = {};
  
  if (selectedTemplate.category === 'UI') {
    conditionalOptions = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'storybook',
        message: 'Include Storybook for component development?',
        default: true
      }
    ]);
  }

  const finalOptions = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'examples',
      message: 'Include example code and demos?',
      default: true
    },
    {
      type: 'confirm',
      name: 'workspace',
      message: 'Setup as monorepo workspace (for multi-package plugins)?',
      default: false
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

  return {
    pluginName: answers.pluginName,
    template: selectedTemplate,
    author: answers.author,
    description: answers.description,
    category: selectedCategory,
    complexity: selectedTemplate.complexity,
    ...advancedOptions,
    ...conditionalOptions,
    ...finalOptions
  };
}

async function createAdvancedPlugin(
  pluginName: string,
  targetDir: string,
  template: AdvancedPluginTemplate,
  options: any
): Promise<void> {
  const tasks = new Listr([
    {
      title: 'Creating project structure',
      task: async (ctx, task) => {
        const scaffolder = new ProjectScaffolder(targetDir, template, options);
        await scaffolder.createProjectStructure();
        task.output = `Created ${chalk.cyan(pluginName)} project structure`;
      }
    },
    {
      title: 'Generating configuration files',
      task: async (ctx, task) => {
        const scaffolder = new ProjectScaffolder(targetDir, template, options);
        await scaffolder.generateConfigFiles();
        task.output = 'Generated TypeScript, ESLint, and other config files';
      }
    },
    {
      title: 'Creating template files',
      task: async (ctx, task) => {
        const templateManager = new TemplateManager();
        await templateManager.processTemplate(template.templatePath, targetDir, {
          pluginName,
          ...options
        });
        task.output = 'Generated plugin source code from template';
      }
    },
    {
      title: 'Setting up build system',
      task: async (ctx, task) => {
        const scaffolder = new ProjectScaffolder(targetDir, template, options);
        await scaffolder.setupBuildSystem();
        task.output = `Configured ${options.bundler} build system`;
      }
    },
    {
      title: 'Configuring testing framework',
      task: async (ctx, task) => {
        if (options.testing !== 'none') {
          const scaffolder = new ProjectScaffolder(targetDir, template, options);
          await scaffolder.setupTesting();
          task.output = `Configured ${options.testing} testing framework`;
        } else {
          task.skip('Testing framework not selected');
        }
      }
    },
    {
      title: 'Setting up CI/CD pipeline',
      task: async (ctx, task) => {
        if (options.cicd !== 'none') {
          const scaffolder = new ProjectScaffolder(targetDir, template, options);
          await scaffolder.setupCICD();
          task.output = `Configured ${options.cicd} CI/CD pipeline`;
        } else {
          task.skip('CI/CD not selected');
        }
      }
    },
    {
      title: 'Generating documentation',
      task: async (ctx, task) => {
        if (options.documentation !== 'none') {
          const scaffolder = new ProjectScaffolder(targetDir, template, options);
          await scaffolder.setupDocumentation();
          task.output = `Configured ${options.documentation} documentation`;
        } else {
          task.skip('Documentation generator not selected');
        }
      }
    },
    {
      title: 'Creating example code',
      task: async (ctx, task) => {
        if (options.examples) {
          const scaffolder = new ProjectScaffolder(targetDir, template, options);
          await scaffolder.createExamples();
          task.output = 'Generated example code and demos';
        } else {
          task.skip('Examples not requested');
        }
      }
    }
  ], {
    concurrent: false,
    rendererOptions: {
      collapse: false,
      clearOutput: true
    }
  });

  await tasks.run();
}

async function setupGitRepository(targetDir: string, options: any): Promise<void> {
  const tasks = new Listr([
    {
      title: 'Initializing Git repository',
      task: async () => {
        await execa('git', ['init'], { cwd: targetDir });
      }
    },
    {
      title: 'Creating .gitignore',
      task: async () => {
        const gitignoreContent = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Build output
dist/
build/
lib/
.next/
.nuxt/
.vuepress/dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*.sublime-*

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Coverage
coverage/
*.lcov
.nyc_output/

# Temporary files
.tmp/
temp/
.cache/

# Storybook
storybook-static/

# TypeScript
*.tsbuildinfo

# Testing
.jest-cache/

# Bundle analysis
bundle-analyzer-report.html
`.trim();
        
        await fs.writeFile(path.join(targetDir, '.gitignore'), gitignoreContent);
      }
    },
    {
      title: 'Adding files to Git',
      task: async () => {
        await execa('git', ['add', '.'], { cwd: targetDir });
      }
    },
    {
      title: 'Creating initial commit',
      task: async () => {
        await execa('git', ['commit', '-m', '🎉 Initial commit: Generated with Lokus Plugin CLI'], { cwd: targetDir });
      }
    }
  ], {
    concurrent: false
  });

  await tasks.run();
}

async function installDependencies(targetDir: string, options: any): Promise<void> {
  const dependencyManager = new DependencyManager(targetDir);
  
  const tasks = new Listr([
    {
      title: 'Installing dependencies',
      task: async (ctx, task) => {
        const packageManager = await dependencyManager.detectPackageManager();
        task.output = `Using ${packageManager}`;
        
        await dependencyManager.install();
        
        task.output = 'Dependencies installed successfully';
      }
    },
    {
      title: 'Running initial build',
      task: async () => {
        await dependencyManager.runScript('build');
      }
    },
    {
      title: 'Running tests',
      task: async (ctx, task) => {
        if (options.testing !== 'none') {
          await dependencyManager.runScript('test');
          task.output = 'All tests passed';
        } else {
          task.skip('No testing framework configured');
        }
      }
    }
  ], {
    concurrent: false
  });

  await tasks.run();
}

export const createEnhancedCommand = new Command('create')
  .description('Create a new Lokus plugin with advanced tooling and templates')
  .argument('[name]', 'plugin name')
  .option('-t, --template <template>', 'plugin template to use')
  .option('-a, --author <author>', 'plugin author')
  .option('-d, --description <description>', 'plugin description')
  .option('--category <category>', 'plugin category')
  .option('--complexity <complexity>', 'template complexity level')
  .option('--skip-prompts', 'skip interactive prompts and use defaults')
  .option('--no-typescript', 'use JavaScript instead of TypeScript')
  .option('--no-git', 'skip Git repository initialization')
  .option('--no-install', 'skip dependency installation')
  .option('--testing <framework>', 'testing framework (jest, vitest, none)')
  .option('--linting <tool>', 'linting tool (eslint, biome, none)')
  .option('--formatting <tool>', 'formatting tool (prettier, biome, none)')
  .option('--bundler <tool>', 'build tool (esbuild, webpack, rollup, vite)')
  .option('--cicd <platform>', 'CI/CD platform (github, gitlab, none)')
  .option('--documentation <tool>', 'documentation generator (typedoc, jsdoc, none)')
  .option('--examples', 'include example code')
  .option('--storybook', 'include Storybook for UI components')
  .option('--workspace', 'setup as monorepo workspace')
  .action(async (name: string | undefined, options: AdvancedCreateOptions) => {
    try {
      await ErrorHandler.validateNodeEnvironment();

      // Show welcome screen
      await showWelcomeScreen();

      let pluginDetails;
      
      if (options.skipPrompts) {
        if (!name) {
          throw ErrorHandler.createError('ValidationError', 'Plugin name is required when skipping prompts');
        }
        
        const template = advancedPluginTemplates[options.template || 'basic-typescript'];
        if (!template) {
          throw ErrorHandler.createError('ValidationError', `Unknown template: ${options.template}`);
        }
        
        pluginDetails = {
          pluginName: name,
          template,
          author: options.author || 'Unknown',
          description: options.description || 'A Lokus plugin',
          category: template.category,
          complexity: template.complexity,
          typescript: options.typescript !== false,
          testing: options.testing || 'jest',
          linting: options.linting || 'eslint',
          formatting: options.formatting || 'prettier',
          bundler: options.bundler || 'esbuild',
          cicd: options.cicd || 'github',
          documentation: options.documentation || 'typedoc',
          examples: options.examples || false,
          storybook: options.storybook || false,
          initGit: options.git !== false,
          installDeps: options.install !== false,
          workspace: options.workspace || false
        };
      } else {
        pluginDetails = await promptForAdvancedPluginDetails(name);
      }

      const { pluginName, template } = pluginDetails;
      
      // Validate plugin name
      if (!pluginValidator.validatePluginName(pluginName)) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Invalid plugin name. Must be lowercase, alphanumeric with hyphens, 3-50 characters.'
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

      // Show creation summary
      const summaryBox = boxen(
        `${template.iconEmoji} ${chalk.bold.white(template.name)}\n\n` +
        `${chalk.bold('Name:')} ${chalk.cyan(pluginName)}\n` +
        `${chalk.bold('Author:')} ${chalk.green(pluginDetails.author)}\n` +
        `${chalk.bold('Description:')} ${chalk.yellow(pluginDetails.description)}\n` +
        `${chalk.bold('Category:')} ${pluginDetails.category}\n` +
        `${chalk.bold('Complexity:')} ${pluginDetails.complexity}\n` +
        `${chalk.bold('TypeScript:')} ${pluginDetails.typescript ? '✅' : '❌'}\n` +
        `${chalk.bold('Testing:')} ${pluginDetails.testing}\n` +
        `${chalk.bold('Build Tool:')} ${pluginDetails.bundler}\n` +
        `${chalk.bold('CI/CD:')} ${pluginDetails.cicd}`,
        {
          title: 'Plugin Configuration',
          padding: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      );

      console.log('\n' + summaryBox + '\n');

      const { confirmCreate } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmCreate',
        message: 'Create plugin with this configuration?',
        default: true
      }]);

      if (!confirmCreate) {
        logger.info('Plugin creation cancelled');
        return;
      }

      console.log('\n' + chalk.bold.blue('🚀 Creating your plugin...\n'));

      // Create the plugin
      await createAdvancedPlugin(pluginName, targetDir, template, pluginDetails);

      // Initialize Git if requested
      if (pluginDetails.initGit) {
        console.log('\n' + chalk.bold.blue('📁 Setting up Git repository...\n'));
        await setupGitRepository(targetDir, pluginDetails);
      }

      // Install dependencies if requested
      if (pluginDetails.installDeps) {
        console.log('\n' + chalk.bold.blue('📦 Installing dependencies...\n'));
        await installDependencies(targetDir, pluginDetails);
      }

      // Validate the created plugin
      await pluginValidator.validatePluginStructure(targetDir);

      // Success message
      console.log('\n' + gradient(['#ff6b6b', '#4ecdc4', '#45b7d1'])('🎉 Plugin created successfully!') + '\n');
      
      const nextStepsBox = boxen(
        `${chalk.bold('Next Steps:')}\n\n` +
        `${chalk.cyan('1.')} ${chalk.white('cd ' + pluginName)}\n` +
        (pluginDetails.installDeps ? '' : `${chalk.cyan('2.')} ${chalk.white('npm install')}\n`) +
        `${chalk.cyan(pluginDetails.installDeps ? '2.' : '3.')} ${chalk.white('lokus-plugin dev')} ${chalk.gray('# Start development server')}\n` +
        `${chalk.cyan(pluginDetails.installDeps ? '3.' : '4.')} ${chalk.white('npm test')} ${chalk.gray('# Run tests')}\n` +
        `${chalk.cyan(pluginDetails.installDeps ? '4.' : '5.')} ${chalk.white('npm run build')} ${chalk.gray('# Build for production')}\n\n` +
        `${chalk.bold('Resources:')}\n` +
        `${chalk.blue('📖 Documentation:')} https://lokus.dev/docs/plugin-development\n` +
        `${chalk.blue('🔌 Plugin API:')} https://lokus.dev/docs/plugin-api\n` +
        `${chalk.blue('💬 Community:')} https://discord.gg/lokus\n` +
        (template.exampleUrl ? `${chalk.blue('🌟 Examples:')} ${template.exampleUrl}\n` : '') +
        (template.documentationUrl ? `${chalk.blue('📚 Template Docs:')} ${template.documentationUrl}` : ''),
        {
          title: chalk.green.bold('Success!'),
          titleAlignment: 'center',
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      );
      
      console.log(nextStepsBox);

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });