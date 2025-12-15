import * as path from 'path';
import * as fs from 'fs-extra';
import { glob } from 'glob';
import Mustache from 'mustache';
import chalk from 'chalk';
import { logger } from './logger';

export interface TemplateContext {
  pluginName: string;
  pluginNameCamelCase: string;
  pluginNamePascalCase: string;
  pluginNameKebabCase: string;
  pluginNameConstantCase: string;
  author: string;
  description: string;
  typescript: boolean;
  currentYear: number;
  currentDate: string;
  sdkVersion: string;
  testing: string;
  linting: string;
  formatting: string;
  bundler: string;
  cicd: string;
  documentation: string;
  examples: boolean;
  storybook: boolean;
  workspace: boolean;
  moduleType: 'esm' | 'cjs';
  [key: string]: any;
}

export class TemplateManager {
  private templateBaseDir: string;

  constructor(templateBaseDir?: string) {
    this.templateBaseDir = templateBaseDir || path.join(__dirname, '../../templates');
  }

  /**
   * Process a template directory, replacing template variables in all files
   */
  async processTemplate(
    templatePath: string,
    targetDir: string,
    context: Partial<TemplateContext>
  ): Promise<void> {
    const fullTemplatePath = path.join(this.templateBaseDir, templatePath);
    console.log('DEBUG: fullTemplatePath =', fullTemplatePath);

    if (!await fs.pathExists(fullTemplatePath)) {
      throw new Error(`Template not found: ${fullTemplatePath}`);
    }

    // Create enhanced context with derived values
    const enhancedContext = this.createEnhancedContext(context);
    console.log('DEBUG: enhancedContext =', JSON.stringify(enhancedContext, null, 2));

    // Process all files in the template
    await this.processDirectory(fullTemplatePath, targetDir, enhancedContext);
  }

  /**
   * Create enhanced context with derived naming conventions
   */
  private createEnhancedContext(context: Partial<TemplateContext>): TemplateContext {
    const pluginName = context.pluginName || 'my-plugin';

    return {
      pluginName,
      pluginNameCamelCase: this.toCamelCase(pluginName),
      pluginNamePascalCase: this.toPascalCase(pluginName),
      pluginNameKebabCase: this.toKebabCase(pluginName),
      pluginNameConstantCase: this.toConstantCase(pluginName),
      author: context.author || 'Unknown',
      description: context.description || 'A Lokus plugin',
      typescript: context.typescript ?? true,
      currentYear: new Date().getFullYear(),
      currentDate: new Date().toISOString().split('T')[0],
      sdkVersion: '^1.0.3',
      testing: context.testing || 'jest',
      linting: context.linting || 'eslint',
      formatting: context.formatting || 'prettier',
      bundler: context.bundler || 'esbuild',
      cicd: context.cicd || 'github',
      documentation: context.documentation || 'typedoc',
      examples: context.examples ?? true,
      storybook: context.storybook ?? false,
      workspace: context.workspace ?? false,
      moduleType: context.moduleType || 'esm',
      ...context
    };
  }

  /**
   * Process a directory recursively
   */
  private async processDirectory(
    sourceDir: string,
    targetDir: string,
    context: TemplateContext
  ): Promise<void> {
    await fs.ensureDir(targetDir);

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, this.processFileName(entry.name, context));

      if (entry.isDirectory()) {
        await this.processDirectory(sourcePath, targetPath, context);
      } else {
        await this.processFile(sourcePath, targetPath, context);
      }
    }
  }

  /**
   * Process a single file
   */
  private async processFile(
    sourcePath: string,
    targetPath: string,
    context: TemplateContext
  ): Promise<void> {
    const content = await fs.readFile(sourcePath, 'utf-8');

    // Check if file should be processed as template
    if (this.shouldProcessAsTemplate(sourcePath)) {
      const processedContent = this.processTemplateContent(content, context);
      await fs.writeFile(targetPath, processedContent);
    } else {
      // Copy binary files as-is
      await fs.copy(sourcePath, targetPath);
    }
  }

  /**
   * Process template content with Mustache
   */
  private processTemplateContent(content: string, context: TemplateContext): string {
    try {
      return Mustache.render(content, context);
    } catch (error) {
      logger.warning(`Failed to process template content: ${(error as Error).message}`);
      return content;
    }
  }

  /**
   * Process file names that might contain template variables
   */
  private processFileName(fileName: string, context: TemplateContext): string {
    return fileName
      .replace(/{{pluginName}}/g, context.pluginName)
      .replace(/{{pluginNameCamelCase}}/g, context.pluginNameCamelCase)
      .replace(/{{pluginNamePascalCase}}/g, context.pluginNamePascalCase)
      .replace(/{{pluginNameKebabCase}}/g, context.pluginNameKebabCase);
  }

  /**
   * Determine if a file should be processed as a template
   */
  private shouldProcessAsTemplate(filePath: string): boolean {
    const textExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml',
      '.toml', '.xml', '.html', '.css', '.scss', '.less', '.svg', '.env',
      '.gitignore', '.eslintrc', '.prettierrc', '.editorconfig'
    ];

    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);

    // Check by extension
    if (textExtensions.includes(ext)) {
      return true;
    }

    // Check by filename (for files without extensions)
    const textFiles = [
      'dockerfile', 'makefile', 'license', 'readme', 'changelog',
      'contributing', 'code_of_conduct'
    ];

    return textFiles.includes(basename.toLowerCase());
  }

  /**
   * Create conditional template files based on context
   */
  async createConditionalFiles(
    targetDir: string,
    context: TemplateContext
  ): Promise<void> {
    const conditionalFiles: Array<{
      condition: (ctx: TemplateContext) => boolean;
      files: Array<{ path: string; content: string }>;
    }> = [
        {
          condition: (ctx) => ctx.typescript,
          files: [
            {
              path: 'tsconfig.json',
              content: await this.generateTsConfig(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.testing === 'jest',
          files: [
            {
              path: 'jest.config.js',
              content: await this.generateJestConfig(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.testing === 'vitest',
          files: [
            {
              path: 'vitest.config.ts',
              content: await this.generateVitestConfig(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.linting === 'eslint',
          files: [
            {
              path: '.eslintrc.js',
              content: await this.generateESLintConfig(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.formatting === 'prettier',
          files: [
            {
              path: '.prettierrc',
              content: await this.generatePrettierConfig(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.cicd === 'github',
          files: [
            {
              path: '.github/workflows/ci.yml',
              content: await this.generateGitHubWorkflow(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.cicd === 'gitlab',
          files: [
            {
              path: '.gitlab-ci.yml',
              content: await this.generateGitLabCI(context)
            }
          ]
        },
        {
          condition: (ctx) => ctx.storybook,
          files: [
            {
              path: '.storybook/main.js',
              content: await this.generateStorybookConfig(context)
            }
          ]
        }
      ];

    for (const { condition, files } of conditionalFiles) {
      if (condition(context)) {
        for (const file of files) {
          const filePath = path.join(targetDir, file.path);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, file.content);
        }
      }
    }
  }

  // Configuration generators
  private async generateTsConfig(context: TemplateContext): Promise<string> {
    const isUI = context.category === 'UI' || (context.template && (context.template as any).category === 'UI');

    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: context.moduleType === 'esm' ? 'ESNext' : 'CommonJS',
        lib: isUI ? ['ES2020', 'DOM'] : ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: context.moduleType === 'esm' ? 'bundler' : 'node',
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        ...(isUI ? { jsx: 'react' } : {}),
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        types: context.testing === 'jest' ? ['jest'] : []
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts']
    }, null, 2);
  }

  private async generateJestConfig(context: TemplateContext): Promise<string> {
    return `module.exports = {
  preset: '${context.typescript ? 'ts-jest' : 'jest'}',
  testEnvironment: '${context.category === 'UI' ? 'jsdom' : 'node'}',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.${context.typescript ? 'ts' : 'js'}', '**/*.(test|spec).${context.typescript ? 'ts' : 'js'}'],
  collectCoverageFrom: [
    'src/**/*.${context.typescript ? 'ts' : 'js'}',
    '!src/**/*.d.ts',
    '!src/**/*.test.${context.typescript ? 'ts' : 'js'}',
    '!src/**/*.spec.${context.typescript ? 'ts' : 'js'}'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.${context.typescript ? 'ts' : 'js'}']
};`;
  }

  private async generateVitestConfig(context: TemplateContext): Promise<string> {
    return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts']
    },
    setupFiles: ['./src/test/setup.ts']
  }
});`;
  }

  private async generateESLintConfig(context: TemplateContext): Promise<string> {
    const config: any = {
      env: {
        es2021: true,
        node: true
      },
      extends: [
        'eslint:recommended'
      ],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'error',
        'prefer-const': 'error'
      }
    };

    if (context.typescript) {
      config.extends.push('@typescript-eslint/recommended');
      config.parser = '@typescript-eslint/parser';
      config.plugins = ['@typescript-eslint'];
      config.rules['@typescript-eslint/no-unused-vars'] = 'error';
      config.rules['no-unused-vars'] = undefined;
    }

    return `module.exports = ${JSON.stringify(config, null, 2)};`;
  }

  private async generatePrettierConfig(context: TemplateContext): Promise<string> {
    return JSON.stringify({
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 80,
      tabWidth: 2,
      useTabs: false
    }, null, 2);
  }

  private async generateGitHubWorkflow(context: TemplateContext): Promise<string> {
    return `name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
    
    - name: Upload coverage to Codecov
      if: matrix.node-version == '18.x'
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v4
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Package plugin
      run: npm run package
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: plugin-package
        path: dist/`;
  }

  private async generateGitLabCI(context: TemplateContext): Promise<string> {
    return `stages:
  - test
  - build
  - package

variables:
  NODE_VERSION: "18"

before_script:
  - npm ci

test:
  stage: test
  image: node:\${NODE_VERSION}
  script:
    - npm run lint
    - npm test
    - npm run build
  coverage: '/Lines\\s*:\\s*(\\d+\\.?\\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/

build:
  stage: build
  image: node:\${NODE_VERSION}
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour
  only:
    - main
    - develop

package:
  stage: package
  image: node:\${NODE_VERSION}
  script:
    - npm run package
  artifacts:
    paths:
      - "*.tgz"
    expire_in: 1 week
  only:
    - tags`;
  }

  private async generateStorybookConfig(context: TemplateContext): Promise<string> {
    return `module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-actions',
    '@storybook/addon-controls',
    '@storybook/addon-docs'
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true)
    }
  }
};`;
  }

  // Naming convention utilities
  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|-)[a-z]/g, (match) =>
      match.replace('-', '').toUpperCase()
    );
  }

  private toKebabCase(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  private toConstantCase(str: string): string {
    return str.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  }
}