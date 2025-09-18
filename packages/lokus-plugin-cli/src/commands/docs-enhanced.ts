import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execa } from 'execa';
import chalk from 'chalk';
import { Listr } from 'listr2';
import Mustache from 'mustache';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { DependencyManager } from '../utils/dependency-manager';

export interface DocsOptions {
  generator?: 'typedoc' | 'jsdoc' | 'custom';
  output?: string;
  watch?: boolean;
  serve?: boolean;
  port?: number;
  includeSource?: boolean;
  includeExamples?: boolean;
  includeApi?: boolean;
  theme?: string;
  format?: 'html' | 'markdown' | 'json';
  coverage?: boolean;
  verbose?: boolean;
}

interface DocGenerator {
  name: string;
  command: string[];
  configFile?: string;
  outputDir: string;
  isInstalled: boolean;
}

export class DocumentationGenerator {
  private pluginDir: string;
  private options: DocsOptions;
  private dependencyManager: DependencyManager;
  private generator: DocGenerator | null = null;

  constructor(pluginDir: string, options: DocsOptions) {
    this.pluginDir = pluginDir;
    this.options = options;
    this.dependencyManager = new DependencyManager(pluginDir);
  }

  async generate(): Promise<void> {
    const tasks = new Listr([
      {
        title: 'Detecting documentation generator',
        task: async () => {
          await this.detectGenerator();
        }
      },
      {
        title: 'Validating setup',
        task: async () => {
          await this.validateSetup();
        }
      },
      {
        title: 'Preparing documentation files',
        task: async () => {
          await this.prepareFiles();
        }
      },
      {
        title: 'Generating documentation',
        task: async () => {
          await this.runGenerator();
        }
      },
      {
        title: 'Post-processing documentation',
        task: async () => {
          await this.postProcess();
        }
      },
      {
        title: 'Starting development server',
        task: async (ctx, task) => {
          if (this.options.serve) {
            await this.startServer();
          } else {
            task.skip('Server not requested');
          }
        }
      }
    ], {
      rendererOptions: { collapse: false }
    });

    await tasks.run();
  }

  private async detectGenerator(): Promise<void> {
    const packageJsonPath = path.join(this.pluginDir, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (this.options.generator) {
      // Use specified generator
      switch (this.options.generator) {
        case 'typedoc':
          this.generator = await this.createTypedocGenerator();
          break;
        case 'jsdoc':
          this.generator = await this.createJSDocGenerator();
          break;
        case 'custom':
          this.generator = await this.createCustomGenerator();
          break;
      }
    } else {
      // Auto-detect based on dependencies and project structure
      if (allDeps.typedoc || await this.hasTypescriptFiles()) {
        this.generator = await this.createTypedocGenerator();
      } else if (allDeps.jsdoc) {
        this.generator = await this.createJSDocGenerator();
      } else {
        this.generator = await this.createCustomGenerator();
      }
    }

    if (!this.generator) {
      throw new Error('Could not determine documentation generator');
    }
  }

  private async createTypedocGenerator(): Promise<DocGenerator> {
    const isInstalled = await this.dependencyManager.isPackageInstalled('typedoc');
    const configFile = await this.findConfigFile(['typedoc.json', 'typedoc.js']);
    
    return {
      name: 'TypeDoc',
      command: this.buildTypedocCommand(),
      configFile,
      outputDir: this.options.output || 'docs',
      isInstalled
    };
  }

  private async createJSDocGenerator(): Promise<DocGenerator> {
    const isInstalled = await this.dependencyManager.isPackageInstalled('jsdoc');
    const configFile = await this.findConfigFile(['.jsdoc.json', 'jsdoc.conf.json']);
    
    return {
      name: 'JSDoc',
      command: this.buildJSDocCommand(),
      configFile,
      outputDir: this.options.output || 'docs',
      isInstalled
    };
  }

  private async createCustomGenerator(): Promise<DocGenerator> {
    return {
      name: 'Custom',
      command: [],
      outputDir: this.options.output || 'docs',
      isInstalled: true
    };
  }

  private buildTypedocCommand(): string[] {
    const cmd = ['npx', 'typedoc'];
    
    cmd.push('--out', this.options.output || 'docs');
    
    if (this.options.theme) {
      cmd.push('--theme', this.options.theme);
    }
    
    if (this.options.includeSource) {
      cmd.push('--excludeInternal', 'false');
    }
    
    if (this.options.format === 'json') {
      cmd.push('--json', path.join(this.options.output || 'docs', 'documentation.json'));
    }
    
    // Add source files
    cmd.push('src');
    
    return cmd;
  }

  private buildJSDocCommand(): string[] {
    const cmd = ['npx', 'jsdoc'];
    
    cmd.push('-d', this.options.output || 'docs');
    cmd.push('-r', 'src');
    
    if (this.options.includeSource) {
      cmd.push('-P', 'package.json');
    }
    
    return cmd;
  }

  private async hasTypescriptFiles(): Promise<boolean> {
    const { glob } = await import('glob');
    const tsFiles = await glob('src/**/*.ts', { cwd: this.pluginDir });
    return tsFiles.length > 0;
  }

  private async findConfigFile(fileNames: string[]): Promise<string | undefined> {
    for (const fileName of fileNames) {
      const configPath = path.join(this.pluginDir, fileName);
      if (await fs.pathExists(configPath)) {
        return configPath;
      }
    }
    return undefined;
  }

  private async validateSetup(): Promise<void> {
    if (!this.generator) {
      throw new Error('No documentation generator configured');
    }

    if (!this.generator.isInstalled && this.generator.name !== 'Custom') {
      const packageName = this.generator.name.toLowerCase();
      throw new Error(`${this.generator.name} is not installed. Run: npm install --save-dev ${packageName}`);
    }

    // Check for source files
    const srcDir = path.join(this.pluginDir, 'src');
    if (!await fs.pathExists(srcDir)) {
      throw new Error('Source directory not found. Make sure you have a src/ directory.');
    }
  }

  private async prepareFiles(): Promise<void> {
    const outputDir = path.join(this.pluginDir, this.generator!.outputDir);
    await fs.ensureDir(outputDir);

    // Create documentation configuration if not exists
    await this.createConfigFiles();

    // Prepare custom templates and assets
    await this.prepareAssets();
  }

  private async createConfigFiles(): Promise<void> {
    const generator = this.generator!;
    
    if (generator.name === 'TypeDoc' && !generator.configFile) {
      const config = {
        entryPoints: ['src/index.ts'],
        out: generator.outputDir,
        theme: this.options.theme || 'default',
        excludePrivate: true,
        excludeProtected: true,
        excludeExternals: true,
        includeVersion: true,
        name: await this.getPluginName(),
        readme: 'README.md'
      };
      
      await fs.writeJson(path.join(this.pluginDir, 'typedoc.json'), config, { spaces: 2 });
    }
    
    if (generator.name === 'JSDoc' && !generator.configFile) {
      const config = {
        source: {
          include: ['./src/'],
          includePattern: '\\.(js|ts)$',
          exclude: ['node_modules/']
        },
        opts: {
          destination: generator.outputDir,
          recurse: true
        },
        plugins: ['plugins/markdown'],
        templates: {
          cleverLinks: false,
          monospaceLinks: false
        }
      };
      
      await fs.writeJson(path.join(this.pluginDir, '.jsdoc.json'), config, { spaces: 2 });
    }
  }

  private async prepareAssets(): Promise<void> {
    const outputDir = path.join(this.pluginDir, this.generator!.outputDir);
    const assetsDir = path.join(outputDir, 'assets');
    await fs.ensureDir(assetsDir);

    // Copy plugin-specific assets
    const logoPath = path.join(this.pluginDir, 'assets', 'logo.png');
    if (await fs.pathExists(logoPath)) {
      await fs.copy(logoPath, path.join(assetsDir, 'logo.png'));
    }

    // Create custom CSS
    const customCSS = await this.generateCustomCSS();
    await fs.writeFile(path.join(assetsDir, 'custom.css'), customCSS);
  }

  private async generateCustomCSS(): Promise<string> {
    return `
/* Custom documentation styles for Lokus plugins */
:root {
  --lokus-primary: #0066cc;
  --lokus-secondary: #4ecdc4;
  --lokus-accent: #ff6b6b;
  --lokus-background: #ffffff;
  --lokus-surface: #f8fafc;
  --lokus-text: #1e293b;
  --lokus-text-muted: #64748b;
}

.plugin-header {
  background: linear-gradient(135deg, var(--lokus-primary), var(--lokus-secondary));
  color: white;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.plugin-header h1 {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.plugin-header p {
  margin: 0.5rem 0 0 0;
  font-size: 1.2rem;
  opacity: 0.9;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.feature-card {
  background: var(--lokus-surface);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.feature-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--lokus-primary);
}

.api-section {
  border-left: 4px solid var(--lokus-primary);
  padding-left: 1rem;
  margin: 1.5rem 0;
}

.example-code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  overflow-x: auto;
}

@media (prefers-color-scheme: dark) {
  :root {
    --lokus-background: #0f172a;
    --lokus-surface: #1e293b;
    --lokus-text: #f8fafc;
    --lokus-text-muted: #cbd5e1;
  }
}
`;
  }

  private async runGenerator(): Promise<void> {
    const generator = this.generator!;
    
    if (generator.name === 'Custom') {
      await this.runCustomGenerator();
    } else {
      await execa(generator.command[0], generator.command.slice(1), {
        cwd: this.pluginDir,
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
    }
  }

  private async runCustomGenerator(): Promise<void> {
    const outputDir = path.join(this.pluginDir, this.generator!.outputDir);
    
    // Generate custom documentation
    await this.generateReadme();
    await this.generateApiDocs();
    
    if (this.options.includeExamples) {
      await this.generateExamples();
    }
    
    await this.generateIndex();
  }

  private async generateReadme(): Promise<void> {
    const pluginJson = await fs.readJson(path.join(this.pluginDir, 'plugin.json'));
    const packageJson = await fs.readJson(path.join(this.pluginDir, 'package.json'));
    
    const template = `# {{name}}

{{description}}

## Installation

\`\`\`bash
lokus-plugin install {{name}}
\`\`\`

## Features

{{#features}}
- {{.}}
{{/features}}

## API Reference

### Plugin Class

The main plugin class that handles initialization and lifecycle.

\`\`\`typescript
class {{pluginClass}} {
  constructor(context: PluginContext);
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}
\`\`\`

### Configuration

{{#permissions}}
- **{{.}}**: Required permission for plugin functionality
{{/permissions}}

## Development

\`\`\`bash
# Clone the repository
git clone {{repository.url}}

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Build for production
npm run build
\`\`\`

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

{{license}}

---

Generated with [Lokus Plugin CLI](https://lokus.dev/cli)
`;

    const context = {
      name: pluginJson.name,
      description: pluginJson.description,
      features: this.extractFeatures(pluginJson),
      pluginClass: this.toPascalCase(pluginJson.name),
      permissions: pluginJson.permissions || [],
      repository: packageJson.repository || { url: '#' },
      license: packageJson.license || 'MIT'
    };

    const readme = Mustache.render(template, context);
    await fs.writeFile(path.join(this.generator!.outputDir, 'README.md'), readme);
  }

  private async generateApiDocs(): Promise<void> {
    // Generate API documentation from source files
    const srcDir = path.join(this.pluginDir, 'src');
    const apiDocs = await this.extractApiFromSource(srcDir);
    
    const template = `# API Reference

## Classes

{{#classes}}
### {{name}}

{{description}}

#### Constructor

\`\`\`typescript
{{constructor}}
\`\`\`

#### Methods

{{#methods}}
##### {{name}}

{{description}}

\`\`\`typescript
{{signature}}
\`\`\`

{{#parameters}}
- **{{name}}** ({{type}}): {{description}}
{{/parameters}}

{{#returns}}
**Returns:** {{type}} - {{description}}
{{/returns}}

{{/methods}}

{{/classes}}

## Interfaces

{{#interfaces}}
### {{name}}

{{description}}

\`\`\`typescript
{{definition}}
\`\`\`

{{/interfaces}}
`;

    const apiDoc = Mustache.render(template, apiDocs);
    await fs.writeFile(path.join(this.generator!.outputDir, 'api.md'), apiDoc);
  }

  private async generateExamples(): Promise<void> {
    const examplesDir = path.join(this.pluginDir, 'examples');
    const outputDir = path.join(this.generator!.outputDir, 'examples');
    
    if (await fs.pathExists(examplesDir)) {
      await fs.copy(examplesDir, outputDir);
    } else {
      // Generate basic examples
      await fs.ensureDir(outputDir);
      
      const basicExample = `# Basic Example

\`\`\`typescript
import { PluginContext } from '@lokus/plugin-sdk';
import { ${this.toPascalCase(await this.getPluginName())} } from '${await this.getPluginName()}';

// Initialize the plugin
const plugin = new ${this.toPascalCase(await this.getPluginName())}(context);

// Activate the plugin
await plugin.activate();
\`\`\`
`;
      
      await fs.writeFile(path.join(outputDir, 'basic.md'), basicExample);
    }
  }

  private async generateIndex(): Promise<void> {
    const pluginJson = await fs.readJson(path.join(this.pluginDir, 'plugin.json'));
    
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}} Documentation</title>
  <link rel="stylesheet" href="assets/custom.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    .nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .nav a { color: var(--lokus-primary); text-decoration: none; padding: 0.5rem 1rem; border-radius: 4px; }
    .nav a:hover { background: var(--lokus-surface); }
  </style>
</head>
<body>
  <div class="container">
    <div class="plugin-header">
      <h1>{{name}}</h1>
      <p>{{description}}</p>
    </div>
    
    <nav class="nav">
      <a href="README.md">Getting Started</a>
      <a href="api.md">API Reference</a>
      {{#hasExamples}}<a href="examples/">Examples</a>{{/hasExamples}}
    </nav>
    
    <div class="feature-grid">
      {{#features}}
      <div class="feature-card">
        <h3>{{title}}</h3>
        <p>{{description}}</p>
      </div>
      {{/features}}
    </div>
  </div>
</body>
</html>`;

    const context = {
      name: pluginJson.name,
      description: pluginJson.description,
      hasExamples: this.options.includeExamples,
      features: [
        { title: 'Modern Development', description: 'Built with TypeScript and modern tooling' },
        { title: 'Hot Reload', description: 'Fast development with instant feedback' },
        { title: 'Comprehensive Testing', description: 'Full test coverage and quality assurance' },
        { title: 'Documentation', description: 'Auto-generated docs and examples' }
      ]
    };

    const indexHtml = Mustache.render(template, context);
    await fs.writeFile(path.join(this.generator!.outputDir, 'index.html'), indexHtml);
  }

  private async postProcess(): Promise<void> {
    const outputDir = path.join(this.pluginDir, this.generator!.outputDir);
    
    // Add search functionality
    if (this.options.format === 'html') {
      await this.addSearchFunctionality(outputDir);
    }
    
    // Generate sitemap
    await this.generateSitemap(outputDir);
    
    // Optimize images
    await this.optimizeImages(outputDir);
  }

  private async addSearchFunctionality(outputDir: string): Promise<void> {
    const searchScript = `
// Simple client-side search functionality
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  if (!searchInput || !searchResults) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    
    // Simple search implementation
    const results = searchContent(query);
    displayResults(results);
  });
}

function searchContent(query) {
  // This would be enhanced with a proper search index
  return [];
}

function displayResults(results) {
  const searchResults = document.getElementById('search-results');
  searchResults.innerHTML = results.map(result => 
    \`<div class="search-result">
      <h4><a href="\${result.url}">\${result.title}</a></h4>
      <p>\${result.excerpt}</p>
    </div>\`
  ).join('');
}

document.addEventListener('DOMContentLoaded', initSearch);
`;

    await fs.writeFile(path.join(outputDir, 'assets', 'search.js'), searchScript);
  }

  private async generateSitemap(outputDir: string): Promise<void> {
    // Generate a simple sitemap for documentation
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>index.html</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>README.md</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>api.md</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

    await fs.writeFile(path.join(outputDir, 'sitemap.xml'), sitemap);
  }

  private async optimizeImages(outputDir: string): Promise<void> {
    // Basic image optimization would go here
    // For now, just ensure the assets directory exists
    await fs.ensureDir(path.join(outputDir, 'assets'));
  }

  private async startServer(): Promise<void> {
    const outputDir = path.join(this.pluginDir, this.generator!.outputDir);
    const port = this.options.port || 8080;
    
    try {
      await execa('npx', ['http-server', outputDir, '-p', port.toString(), '-o'], {
        stdio: 'inherit'
      });
    } catch (error) {
      logger.warning(`Failed to start server: ${error.message}`);
      logger.info(`Serve manually with: npx http-server ${outputDir} -p ${port}`);
    }
  }

  private async getPluginName(): Promise<string> {
    const pluginJson = await fs.readJson(path.join(this.pluginDir, 'plugin.json'));
    return pluginJson.name;
  }

  private extractFeatures(pluginJson: any): string[] {
    // Extract features from plugin.json or package.json
    return pluginJson.features || [
      'Modern TypeScript development',
      'Hot reload development server',
      'Comprehensive testing framework',
      'Auto-generated documentation'
    ];
  }

  private async extractApiFromSource(srcDir: string): Promise<any> {
    // Basic API extraction - would be enhanced with AST parsing
    return {
      classes: [],
      interfaces: []
    };
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|-)[a-z]/g, (match) => 
      match.replace('-', '').toUpperCase()
    );
  }
}

export const docsEnhancedCommand = new Command('docs')
  .description('Generate comprehensive documentation for your plugin')
  .option('-g, --generator <type>', 'documentation generator (typedoc, jsdoc, custom)', 'auto')
  .option('-o, --output <dir>', 'output directory', 'docs')
  .option('-w, --watch', 'watch files for changes')
  .option('-s, --serve', 'start development server after generation')
  .option('-p, --port <port>', 'server port', '8080')
  .option('--include-source', 'include source code in documentation')
  .option('--include-examples', 'include examples in documentation')
  .option('--include-api', 'include detailed API documentation')
  .option('--theme <theme>', 'documentation theme')
  .option('-f, --format <format>', 'output format (html, markdown, json)', 'html')
  .option('--coverage', 'generate documentation coverage report')
  .option('-v, --verbose', 'verbose output')
  .action(async (options: DocsOptions) => {
    try {
      const cwd = process.cwd();
      
      // Validate plugin directory
      const manifestPath = path.join(cwd, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No plugin.json found. Make sure you\'re in a plugin directory.');
      }

      logger.header('📚 Generate Documentation');

      const docGenerator = new DocumentationGenerator(cwd, options);
      await docGenerator.generate();

      logger.newLine();
      logger.success('Documentation generated successfully!');
      logger.newLine();
      
      const outputDir = options.output || 'docs';
      logger.info(`Documentation available at: ${chalk.cyan(path.resolve(cwd, outputDir))}`);
      
      if (options.serve) {
        const port = parseInt(options.port || '8080');
        logger.info(`Server running at: ${chalk.cyan(`http://localhost:${port}`)}`);
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });