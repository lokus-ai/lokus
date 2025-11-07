#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk').default || require('chalk');
const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer').default || require('inquirer');
const figlet = require('figlet');
const gradient = require('gradient-string');
const boxen = require('boxen').default || require('boxen');

const program = new Command();

// ASCII Art welcome
function showWelcome() {
  console.clear();
  const title = figlet.textSync('LOKUS', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted'
  });
  
  console.log(gradient.rainbow(title));
  console.log(chalk.cyan.bold('\n🚀 Plugin Development Toolkit\n'));
  
  const welcomeBox = boxen(
    chalk.white('Welcome to the Lokus Plugin CLI!\n\n') +
    chalk.gray('Create powerful plugins for the Lokus editor with\n') +
    chalk.gray('interactive templates and modern tooling.'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  );
  
  console.log(welcomeBox);
}

// Main interactive menu
async function showMainMenu() {
  const choices = [
    { name: '🆕 Create new plugin', value: 'create' },
    { name: '📖 View plugin examples', value: 'examples' },
    { name: '🔧 Development tools', value: 'dev-tools' },
    { name: '📚 Documentation', value: 'docs' },
    { name: '❌ Exit', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: choices,
      pageSize: 10
    }
  ]);

  return action;
}

// Interactive mode (default when no arguments)
async function runInteractiveMode() {
  showWelcome();
  
  while (true) {
    const action = await showMainMenu();
    
    switch (action) {
      case 'create':
        await createPluginInteractive();
        break;
      case 'examples':
        await showExamples();
        break;
      case 'dev-tools':
        await showDevTools();
        break;
      case 'docs':
        await showDocs();
        break;
      case 'exit':
        console.log(chalk.green('\n👋 Happy coding with Lokus!\n'));
        process.exit(0);
        break;
    }
    
    // Wait for user to continue
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }
}

// Enhanced plugin creation
async function createPluginInteractive(pluginName = null) {
  console.log(chalk.blue.bold('\n🎯 Plugin Creation Wizard\n'));
  
  // Get plugin name if not provided
  let name = pluginName;
  if (!name) {
    const { pluginName: inputName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'pluginName',
        message: 'What\'s your plugin name?',
        validate: (input) => {
          if (!input) return 'Please enter a plugin name';
          if (!/^[a-z][a-z0-9-]*$/.test(input)) {
            return 'Plugin name must start with a letter and contain only lowercase letters, numbers, and dashes';
          }
          return true;
        },
        transformer: (input) => input.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      }
    ]);
    name = inputName;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'What type of plugin are you building?',
      choices: [
        { 
          name: '📝 Editor Extension - Add custom functionality to the editor', 
          value: 'editor',
          short: 'Editor Extension'
        },
        { 
          name: '🎨 UI Panel - Create custom sidebar or bottom panels', 
          value: 'panel',
          short: 'UI Panel'
        },
        { 
          name: '🔗 Data Provider - Extend kanban/graph/search functionality', 
          value: 'data',
          short: 'Data Provider'
        },
        { 
          name: '🎭 Theme Plugin - Create custom themes and styling', 
          value: 'theme',
          short: 'Theme Plugin'
        },
        { 
          name: '🔌 Integration - Connect with external services', 
          value: 'integration',
          short: 'Integration'
        }
      ],
      pageSize: 10
    },
    {
      type: 'input',
      name: 'description',
      message: 'Brief description of your plugin:',
      default: (answers) => `A ${answers.type} plugin for Lokus`,
      validate: (input) => input.length > 0 || 'Please provide a description'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Your name or organization:',
      default: 'Plugin Developer'
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true
    },
    {
      type: 'confirm',
      name: 'examples',
      message: 'Include example code and comments?',
      default: true
    }
  ]);

  await createPlugin(name, answers);
}

async function createPlugin(name, options) {
    console.log(chalk.blue.bold('\n⚡ Generating your plugin...\n'));
    
    const ora = require('ora').default || require('ora');
    const spinner = ora('Setting up project structure...').start();

    try {
      const pluginDir = path.join(process.cwd(), name);
      
      // Create plugin directory
      await fs.ensureDir(pluginDir);
      spinner.text = 'Creating files...';
      
      // Enhanced plugin structure with better templates
      const pluginFiles = {
        'package.json': JSON.stringify({
          name: name,
          version: '1.0.0',
          description: options.description,
          main: options.typescript ? 'dist/index.js' : 'src/index.js',
          scripts: {
            build: options.typescript ? 'tsc' : 'echo "No build needed"',
            dev: 'lokus-plugin dev',
            test: 'jest',
            lint: 'eslint src/',
            format: 'prettier --write src/'
          },
          keywords: ['lokus', 'plugin', options.type],
          author: options.author,
          license: 'MIT',
          dependencies: {
            '@lokus/plugin-api': '^2.0.0'
          },
          devDependencies: options.typescript ? {
            'typescript': '^5.0.0',
            '@types/node': '^20.0.0',
            'eslint': '^8.50.0',
            'prettier': '^3.0.0'
          } : {
            'eslint': '^8.50.0',
            'prettier': '^3.0.0'
          }
        }, null, 2),
        
        'manifest.json': JSON.stringify({
          id: name,
          name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
          version: '1.0.0',
          description: options.description,
          author: options.author,
          type: options.type,
          permissions: getPermissions(options.type),
          main: options.typescript ? 'dist/index.js' : 'src/index.js',
          icon: 'icon.svg',
          homepage: `https://github.com/${options.author.toLowerCase().replace(/\s+/g, '-')}/${name}`,
          repository: `https://github.com/${options.author.toLowerCase().replace(/\s+/g, '-')}/${name}`
        }, null, 2),
        
        'README.md': generateReadme(name, options),
        
        [`src/index.${options.typescript ? 'ts' : 'js'}`]: generateMainFile(name, options),
        
        '.gitignore': `node_modules/
dist/
*.log
.DS_Store
.env
.env.local`,
        
        'icon.svg': generateIcon(),
        
        'CHANGELOG.md': `# Changelog

## [1.0.0] - ${new Date().toISOString().split('T')[0]}
### Added
- Initial release of ${name}
- ${options.description}
`
      };

      if (options.typescript) {
        pluginFiles['tsconfig.json'] = JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
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
        }, null, 2);
      }

      // Add example files if requested
      if (options.examples) {
        pluginFiles[`examples/${options.type}-example.${options.typescript ? 'ts' : 'js'}`] = 
          generateExampleFile(options.type, options.typescript);
        pluginFiles['examples/README.md'] = generateExampleReadme(options.type);
      }

      spinner.text = 'Writing files...';
      
      // Write all files
      for (const [filePath, content] of Object.entries(pluginFiles)) {
        const fullPath = path.join(pluginDir, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
      }

      spinner.succeed(chalk.green('Plugin created successfully!'));
      
      // Success message with next steps
      console.log(boxen(
        chalk.white.bold(`🎉 ${name} is ready!\n\n`) +
        chalk.cyan('Next steps:\n') +
        chalk.white(`  cd ${name}\n`) +
        chalk.white('  npm install\n') +
        chalk.white('  npm run dev\n\n') +
        chalk.gray('Happy coding! 🚀'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      ));
      
    } catch (error) {
      spinner.fail(chalk.red('Failed to create plugin'));
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }

//============================
// HELPER FUNCTIONS
//============================

function getPermissions(type) {
  const permissions = {
    editor: ['editor', 'filesystem'],
    panel: ['ui', 'editor'],
    data: ['data', 'filesystem', 'network'],
    theme: ['ui', 'themes'],
    integration: ['commands', 'network', 'notifications']
  };
  return permissions[type] || ['editor'];
}

function generateReadme(name, options) {
  return `# ${name}

${options.description}

## Features

- 🚀 Built for Lokus Editor
- ⚡ ${options.typescript ? 'TypeScript' : 'JavaScript'} support
- 🎯 ${options.type} plugin type
- 📦 Professional project structure

## Installation

\`\`\`bash
# Clone or download this plugin
# Place in your Lokus plugins directory
\`\`\`

## Development

\`\`\`bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Usage

${getUsageInstructions(options.type)}

## API Reference

This plugin uses the Lokus Plugin API v2.0. See the [official documentation](https://lokus.app/docs/plugins) for more details.

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

MIT © ${options.author}
`;
}

function generateMainFile(name, options) {
  const className = name.replace(/-/g, '').replace(/^\w/, c => c.toUpperCase()) + 'Plugin';
  
  if (options.typescript) {
    return `import { PluginAPI } from '@lokus/plugin-api';

/**
 * ${name} - ${options.description}
 * 
 * This plugin demonstrates ${options.type} functionality in Lokus.
 * ${options.examples ? 'Check the examples/ folder for more detailed examples.' : ''}
 */
export default class ${className} {
  private api: PluginAPI;

  constructor(api: PluginAPI) {
    this.api = api;
  }

  /**
   * Called when the plugin is activated
   */
  async activate(): Promise<void> {
    console.log('🎉 ${name} plugin activated!');
    
    ${getPluginTemplate(options.type, true, options.examples)}
  }

  /**
   * Called when the plugin is deactivated
   */
  async deactivate(): Promise<void> {
    console.log('👋 ${name} plugin deactivated');
    
    // Clean up any resources here
    ${getDeactivationTemplate(options.type, true)}
  }
}`;
  } else {
    return `/**
 * ${name} - ${options.description}
 * 
 * This plugin demonstrates ${options.type} functionality in Lokus.
 * ${options.examples ? 'Check the examples/ folder for more detailed examples.' : ''}
 */
class ${className} {
  constructor(api) {
    this.api = api;
  }

  /**
   * Called when the plugin is activated
   */
  async activate() {
    console.log('🎉 ${name} plugin activated!');
    
    ${getPluginTemplate(options.type, false, options.examples)}
  }

  /**
   * Called when the plugin is deactivated
   */
  async deactivate() {
    console.log('👋 ${name} plugin deactivated');
    
    // Clean up any resources here
    ${getDeactivationTemplate(options.type, false)}
  }
}

module.exports = ${className};`;
  }
}

function generateIcon() {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#007acc"/>
  <path d="M12 6L17 12L12 18H7L12 12L7 6H12Z" fill="white"/>
</svg>`;
}

function getPluginTemplate(type, typescript, includeExamples = false) {
  const examples = {
    editor: `// Add custom editor functionality
    ${includeExamples ? '// See examples/editor-example.js for detailed examples' : ''}
    this.api.editor.addExtension({
      name: 'custom-${type}',
      type: 'node',
      schema: {
        // Define your custom node schema
        group: 'block',
        content: 'text*',
        parseDOM: [{ tag: 'div.custom-node' }],
        toDOM: () => ['div', { class: 'custom-node' }, 0]
      },
      view: (node) => {
        // Custom node view implementation
        const dom = document.createElement('div');
        dom.className = 'custom-node';
        return { dom };
      }
    });`,
    
    panel: `// Add UI panel
    ${includeExamples ? '// See examples/panel-example.js for detailed examples' : ''}
    this.api.ui.addPanel({
      id: '${type}-panel',
      title: 'My Panel',
      position: 'sidebar-right',
      icon: '🔧',
      component: {
        render: (container) => {
          container.innerHTML = \`
            <div class="panel-content">
              <h3>Welcome to ${type}!</h3>
              <p>This is your custom panel.</p>
            </div>
          \`;
        }
      }
    });`,
    
    data: `// Register data provider
    ${includeExamples ? '// See examples/data-example.js for detailed examples' : ''}
    this.api.data.registerProvider({
      id: '${type}-provider',
      type: 'search',
      provider: {
        search: async (query) => {
          // Implement your search logic
          return [
            { title: 'Result 1', content: 'Sample content', score: 1.0 },
            { title: 'Result 2', content: 'Another result', score: 0.8 }
          ];
        }
      }
    });`,
    
    theme: `// Register custom theme
    ${includeExamples ? '// See examples/theme-example.js for detailed examples' : ''}
    this.api.themes.register({
      id: 'my-${type}',
      name: 'My Custom Theme',
      colors: {
        primary: '#007acc',
        secondary: '#f0f0f0',
        background: '#ffffff',
        text: '#333333'
      },
      styles: {
        editor: {
          fontFamily: 'Monaco, monospace',
          fontSize: '14px'
        }
      }
    });`,
    
    integration: `// Add integration commands
    ${includeExamples ? '// See examples/integration-example.js for detailed examples' : ''}
    this.api.commands.register({
      id: 'my-${type}-command',
      name: 'Execute Integration',
      shortcut: 'Ctrl+Shift+I',
      execute: async () => {
        // Your integration logic here
        const result = await this.callExternalAPI();
        this.api.notifications.show({
          type: 'success',
          message: \`Integration executed: \${result}\`
        });
      }
    });`
  };
  
  return examples[type] || '// Add your plugin logic here';
}

function getDeactivationTemplate(type, typescript) {
  const examples = {
    editor: '// Remove editor extensions if needed',
    panel: '// Remove UI panels\n    // this.api.ui.removePanel(\'panel-id\');',
    data: '// Unregister data providers\n    // this.api.data.unregisterProvider(\'provider-id\');',
    theme: '// Clean up theme resources',
    integration: '// Unregister commands\n    // this.api.commands.unregister(\'command-id\');'
  };
  
  return examples[type] || '// Clean up resources';
}

function getUsageInstructions(type) {
  const instructions = {
    editor: `This editor extension adds custom functionality to the Lokus editor. Once activated, you can:

- Use the new custom nodes in your documents
- Access additional formatting options
- Utilize enhanced editing features`,
    
    panel: `This UI panel plugin adds a new panel to your Lokus interface. You can:

- Access the panel from the sidebar
- Interact with custom controls
- View additional information and tools`,
    
    data: `This data provider extends Lokus's data capabilities. Features include:

- Enhanced search functionality
- Custom data sources
- Improved content discovery`,
    
    theme: `This theme plugin customizes the appearance of Lokus. It provides:

- Custom color schemes
- Typography settings
- Visual enhancements`,
    
    integration: `This integration plugin connects Lokus with external services. It offers:

- Custom commands and shortcuts
- External API connectivity
- Workflow automation`
  };
  
  return instructions[type] || 'Plugin usage instructions will be provided here.';
}

function generateExampleFile(type, typescript) {
  // This would be a more comprehensive example file
  return `// Example implementation for ${type} plugin
// This file shows advanced usage patterns and best practices

${typescript ? '// TypeScript example' : '// JavaScript example'}
// See the main index file for basic implementation
`;
}

function generateExampleReadme(type) {
  return `# Examples

This directory contains example implementations and usage patterns for ${type} plugins.

## Files

- \`${type}-example.js\` - Advanced implementation examples
- \`README.md\` - This file

## Usage

Study these examples to understand advanced plugin development patterns and best practices.
`;
}

//============================
// MENU FUNCTIONS
//============================

async function showExamples() {
  console.log(chalk.blue.bold('\n📖 Plugin Examples\n'));
  
  const examples = [
    '📝 Editor Extension - Custom text formatting and nodes',
    '🎨 UI Panel - Interactive sidebar components', 
    '🔗 Data Provider - Search and content indexing',
    '🎭 Theme Plugin - Custom styling and colors',
    '🔌 Integration - External service connections'
  ];
  
  console.log(chalk.white('Available plugin types:\n'));
  examples.forEach(example => {
    console.log(chalk.cyan(`  ${example}`));
  });
  
  console.log(chalk.gray('\nFor detailed examples, create a plugin with the --examples flag.'));
}

async function showDevTools() {
  console.log(chalk.blue.bold('\n🔧 Development Tools\n'));
  
  const tools = [
    'lokus-plugin dev     - Hot-reload development server (coming soon)',
    'lokus-plugin build   - Production build and optimization', 
    'lokus-plugin test    - Run plugin tests',
    'lokus-plugin lint    - Code linting and formatting',
    'lokus-plugin deploy  - Deploy to plugin marketplace (coming soon)'
  ];
  
  console.log(chalk.white('Available development commands:\n'));
  tools.forEach(tool => {
    console.log(chalk.cyan(`  ${tool}`));
  });
  
  console.log(chalk.yellow('\n⚡ Many tools are coming in the next update!'));
}

async function showDocs() {
  console.log(chalk.blue.bold('\n📚 Documentation & Resources\n'));
  
  const docs = [
    '🌐 Official Docs    - https://lokus.app/docs/plugins',
    '📖 API Reference   - https://lokus.app/api/plugins',
    '💡 Examples        - https://github.com/lokus-editor/plugin-examples',
    '💬 Community       - https://discord.gg/lokus',
    '🐛 Report Issues   - https://github.com/lokus-editor/lokus/issues'
  ];
  
  console.log(chalk.white('Documentation and resources:\n'));
  docs.forEach(doc => {
    console.log(chalk.cyan(`  ${doc}`));
  });
}

//============================
// COMMANDER SETUP
//============================

program
  .name('lokus-plugin')
  .description('Advanced CLI toolkit for developing Lokus plugins')
  .version('2.1.0');

// Legacy command support (for backwards compatibility)
program
  .command('create')
  .description('Create a new Lokus plugin')
  .argument('[name]', 'plugin name')
  .option('--template <template>', 'template to use', 'basic')
  .action(async (name, options) => {
    if (name) {
      // Quick create mode with minimal prompts
      const quickAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Plugin type:',
          choices: [
            { name: '📝 Editor Extension', value: 'editor' },
            { name: '🎨 UI Panel', value: 'panel' },
            { name: '🔗 Data Provider', value: 'data' },
            { name: '🎭 Theme Plugin', value: 'theme' },
            { name: '🔌 Integration', value: 'integration' }
          ]
        }
      ]);
      
      await createPlugin(name, {
        type: quickAnswers.type,
        description: `A ${quickAnswers.type} plugin for Lokus`,
        author: 'Plugin Developer',
        typescript: true,
        examples: false
      });
    } else {
      await createPluginInteractive();
    }
  });

program
  .command('dev')
  .description('Start development server')
  .action(() => {
    console.log(chalk.blue.bold('🔧 Starting development server...'));
    console.log(chalk.yellow('Development server functionality coming soon!'));
    console.log(chalk.gray('For now, you can modify your plugin files and test manually.'));
  });

program
  .command('build')
  .description('Build plugin for production')
  .action(() => {
    console.log(chalk.blue.bold('📦 Building plugin...'));
    console.log(chalk.yellow('Build functionality coming soon!'));
  });

// Main execution
async function main() {
  // If no arguments provided, run interactive mode
  if (process.argv.length === 2) {
    await runInteractiveMode();
  } else {
    // Parse command line arguments
    program.parse();
  }
}

// Run the CLI
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});