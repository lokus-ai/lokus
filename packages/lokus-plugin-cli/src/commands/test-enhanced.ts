import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execa } from 'execa';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { DependencyManager } from '../utils/dependency-manager';

export interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  pattern?: string;
  testNamePattern?: string;
  timeout?: number;
  maxWorkers?: number;
  bail?: boolean;
  silent?: boolean;
  reporter?: string;
  updateSnapshot?: boolean;
  detectOpenHandles?: boolean;
  forceExit?: boolean;
  passWithNoTests?: boolean;
  ci?: boolean;
  runInBand?: boolean;
  onlyChanged?: boolean;
  onlyFailures?: boolean;
  clearCache?: boolean;
  debug?: boolean;
}

interface TestSuite {
  name: string;
  framework: 'jest' | 'vitest' | 'mocha' | 'ava';
  configFile?: string;
  command: string[];
  env?: Record<string, string>;
}

interface TestResult {
  success: boolean;
  framework: string;
  duration: number;
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  output: string;
}

export class TestRunner {
  private pluginDir: string;
  private options: TestOptions;
  private dependencyManager: DependencyManager;
  private detectedFrameworks: TestSuite[] = [];

  constructor(pluginDir: string, options: TestOptions) {
    this.pluginDir = pluginDir;
    this.options = options;
    this.dependencyManager = new DependencyManager(pluginDir);
  }

  async run(): Promise<TestResult[]> {
    const tasks = new Listr([
      {
        title: 'Detecting test frameworks',
        task: async () => {
          await this.detectTestFrameworks();
        }
      },
      {
        title: 'Validating test setup',
        task: async () => {
          await this.validateTestSetup();
        }
      },
      {
        title: 'Preparing test environment',
        task: async () => {
          await this.prepareTestEnvironment();
        }
      },
      {
        title: 'Running tests',
        task: async (ctx, task) => {
          return this.runTests(task);
        }
      }
    ], {
      rendererOptions: {}
    });

    await tasks.run();
    
    return this.getTestResults();
  }

  private async detectTestFrameworks(): Promise<void> {
    const packageJsonPath = path.join(this.pluginDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Jest detection
    if (allDeps.jest || await this.hasConfigFile('jest.config')) {
      this.detectedFrameworks.push({
        name: 'Jest',
        framework: 'jest',
        configFile: await this.findConfigFile([
          'jest.config.js',
          'jest.config.ts',
          'jest.config.json',
          'jest.config.mjs'
        ]),
        command: this.buildJestCommand(),
        env: this.buildJestEnv()
      });
    }

    // Vitest detection
    if (allDeps.vitest || await this.hasConfigFile('vitest.config')) {
      this.detectedFrameworks.push({
        name: 'Vitest',
        framework: 'vitest',
        configFile: await this.findConfigFile([
          'vitest.config.ts',
          'vitest.config.js',
          'vite.config.ts',
          'vite.config.js'
        ]),
        command: this.buildVitestCommand(),
        env: this.buildVitestEnv()
      });
    }

    // Mocha detection
    if (allDeps.mocha || await this.hasConfigFile('.mocharc')) {
      this.detectedFrameworks.push({
        name: 'Mocha',
        framework: 'mocha',
        configFile: await this.findConfigFile([
          '.mocharc.js',
          '.mocharc.json',
          '.mocharc.yaml',
          '.mocharc.yml'
        ]),
        command: this.buildMochaCommand(),
        env: this.buildMochaEnv()
      });
    }

    // AVA detection
    if (allDeps.ava) {
      this.detectedFrameworks.push({
        name: 'AVA',
        framework: 'ava',
        command: this.buildAvaCommand(),
        env: this.buildAvaEnv()
      });
    }

    if (this.detectedFrameworks.length === 0) {
      throw new Error('No test frameworks detected. Please install Jest, Vitest, Mocha, or AVA.');
    }
  }

  private async hasConfigFile(baseName: string): Promise<boolean> {
    const extensions = ['', '.js', '.ts', '.json', '.mjs', '.yaml', '.yml'];
    for (const ext of extensions) {
      const configPath = path.join(this.pluginDir, `${baseName}${ext}`);
      if (await fs.pathExists(configPath)) {
        return true;
      }
    }
    return false;
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

  private buildJestCommand(): string[] {
    const cmd = ['npx', 'jest'];
    
    if (this.options.watch) cmd.push('--watch');
    if (this.options.coverage) cmd.push('--coverage');
    if (this.options.verbose) cmd.push('--verbose');
    if (this.options.pattern) cmd.push(this.options.pattern);
    if (this.options.testNamePattern) cmd.push('--testNamePattern', this.options.testNamePattern);
    if (this.options.timeout) cmd.push('--testTimeout', this.options.timeout.toString());
    if (this.options.maxWorkers) cmd.push('--maxWorkers', this.options.maxWorkers.toString());
    if (this.options.bail) cmd.push('--bail');
    if (this.options.silent) cmd.push('--silent');
    if (this.options.reporter) cmd.push('--reporters', this.options.reporter);
    if (this.options.updateSnapshot) cmd.push('--updateSnapshot');
    if (this.options.detectOpenHandles) cmd.push('--detectOpenHandles');
    if (this.options.forceExit) cmd.push('--forceExit');
    if (this.options.passWithNoTests) cmd.push('--passWithNoTests');
    if (this.options.ci) cmd.push('--ci');
    if (this.options.runInBand) cmd.push('--runInBand');
    if (this.options.onlyChanged) cmd.push('--onlyChanged');
    if (this.options.onlyFailures) cmd.push('--onlyFailures');
    if (this.options.clearCache) cmd.push('--clearCache');
    
    return cmd;
  }

  private buildJestEnv(): Record<string, string> {
    const env: Record<string, string> = {
      NODE_ENV: 'test',
      FORCE_COLOR: '1'
    };
    
    if (this.options.debug) {
      env.DEBUG = '*';
    }
    
    return env;
  }

  private buildVitestCommand(): string[] {
    const cmd = ['npx', 'vitest'];
    
    if (!this.options.watch) cmd.push('run');
    if (this.options.coverage) cmd.push('--coverage');
    if (this.options.reporter) cmd.push('--reporter', this.options.reporter);
    if (this.options.testNamePattern) cmd.push('--testNamePattern', this.options.testNamePattern);
    if (this.options.bail) cmd.push('--bail', '1');
    if (this.options.maxWorkers) cmd.push('--maxWorkers', this.options.maxWorkers.toString());
    if (this.options.passWithNoTests) cmd.push('--passWithNoTests');
    
    return cmd;
  }

  private buildVitestEnv(): Record<string, string> {
    return {
      NODE_ENV: 'test',
      VITEST: 'true'
    };
  }

  private buildMochaCommand(): string[] {
    const cmd = ['npx', 'mocha'];
    
    if (this.options.watch) cmd.push('--watch');
    if (this.options.timeout) cmd.push('--timeout', this.options.timeout.toString());
    if (this.options.bail) cmd.push('--bail');
    if (this.options.reporter) cmd.push('--reporter', this.options.reporter);
    if (this.options.pattern) cmd.push(this.options.pattern);
    
    return cmd;
  }

  private buildMochaEnv(): Record<string, string> {
    return {
      NODE_ENV: 'test'
    };
  }

  private buildAvaCommand(): string[] {
    const cmd = ['npx', 'ava'];
    
    if (this.options.watch) cmd.push('--watch');
    if (this.options.verbose) cmd.push('--verbose');
    if (this.options.bail) cmd.push('--fail-fast');
    if (this.options.pattern) cmd.push('--match', this.options.pattern);
    if (this.options.timeout) cmd.push('--timeout', `${this.options.timeout}ms`);
    
    return cmd;
  }

  private buildAvaEnv(): Record<string, string> {
    return {
      NODE_ENV: 'test',
      AVA_FORCE_CI: this.options.ci ? 'true' : 'false'
    };
  }

  private async validateTestSetup(): Promise<void> {
    // Check if test frameworks are installed
    for (const framework of this.detectedFrameworks) {
      const isInstalled = await this.dependencyManager.isPackageInstalled(framework.framework);
      if (!isInstalled) {
        throw new Error(`${framework.name} is not installed. Run: npm install --save-dev ${framework.framework}`);
      }
    }

    // Check for test files
    const testPatterns = [
      'test/**/*.{js,ts}',
      'tests/**/*.{js,ts}',
      'src/**/*.test.{js,ts}',
      'src/**/*.spec.{js,ts}',
      '__tests__/**/*.{js,ts}'
    ];

    let hasTestFiles = false;
    for (const pattern of testPatterns) {
      const { glob } = await import('glob');
      const files = await glob(pattern, { cwd: this.pluginDir });
      if (files.length > 0) {
        hasTestFiles = true;
        break;
      }
    }

    if (!hasTestFiles && !this.options.passWithNoTests) {
      logger.warning('No test files found. Consider adding --passWithNoTests if this is intentional.');
    }
  }

  private async prepareTestEnvironment(): Promise<void> {
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PLUGIN_TEST_MODE = 'true';
    
    // Create test output directory
    const testOutputDir = path.join(this.pluginDir, 'test-results');
    await fs.ensureDir(testOutputDir);
    
    // Clear previous test cache if requested
    if (this.options.clearCache) {
      const cacheDirectories = [
        path.join(this.pluginDir, 'node_modules', '.cache'),
        path.join(this.pluginDir, '.nyc_output'),
        path.join(this.pluginDir, 'coverage')
      ];
      
      for (const cacheDir of cacheDirectories) {
        if (await fs.pathExists(cacheDir)) {
          await fs.remove(cacheDir);
        }
      }
    }
  }

  private async runTests(parentTask: any): Promise<void> {
    const results: TestResult[] = [];
    
    for (const framework of this.detectedFrameworks) {
      const subtask = parentTask.newListr([
        {
          title: `Running ${framework.name} tests`,
          task: async (ctx: any, task: any) => {
            const startTime = Date.now();
            
            try {
              const result = await execa(framework.command[0], framework.command.slice(1), {
                cwd: this.pluginDir,
                env: { ...process.env, ...framework.env },
                stdio: this.options.verbose ? 'inherit' : 'pipe'
              });
              
              const duration = Date.now() - startTime;
              const testResult = this.parseTestOutput(framework.framework, result.stdout, duration);
              results.push(testResult);
              
              task.output = `Completed in ${duration}ms`;
              
            } catch (error) {
              const duration = Date.now() - startTime;
              const testResult: TestResult = {
                success: false,
                framework: framework.name,
                duration,
                tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
                output: (error as any).stdout || (error as Error).message
              };
              results.push(testResult);
              
              if (!this.options.bail) {
                task.skip(`Failed after ${duration}ms`);
              } else {
                throw error;
              }
            }
          }
        }
      ], { concurrent: false });
      
      await subtask.run();
    }
    
    (this as any).testResults = results;
  }

  private parseTestOutput(framework: string, output: string, duration: number): TestResult {
    const result: TestResult = {
      success: true,
      framework,
      duration,
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      output
    };

    try {
      switch (framework) {
        case 'jest':
          result.tests = this.parseJestOutput(output);
          result.coverage = this.parseJestCoverage(output);
          break;
        case 'vitest':
          result.tests = this.parseVitestOutput(output);
          break;
        case 'mocha':
          result.tests = this.parseMochaOutput(output);
          break;
        case 'ava':
          result.tests = this.parseAvaOutput(output);
          break;
      }
    } catch (error) {
      logger.warning(`Failed to parse test output for ${framework}: ${(error as Error).message}`);
    }

    result.success = result.tests.failed === 0;
    return result;
  }

  private parseJestOutput(output: string): TestResult['tests'] {
    const lines = output.split('\n');
    const summary = lines.find(line => line.includes('Tests:'))?.trim();
    
    if (!summary) {
      return { total: 0, passed: 0, failed: 0, skipped: 0 };
    }

    const passedMatch = summary.match(/(\d+) passed/);
    const failedMatch = summary.match(/(\d+) failed/);
    const skippedMatch = summary.match(/(\d+) skipped/);
    const totalMatch = summary.match(/(\d+) total/);

    return {
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0
    };
  }

  private parseJestCoverage(output: string): TestResult['coverage'] | undefined {
    const lines = output.split('\n');
    const coverageLine = lines.find(line => line.includes('All files'));
    
    if (!coverageLine) return undefined;

    const parts = coverageLine.split('|').map(p => p.trim());
    if (parts.length < 5) return undefined;

    return {
      statements: parseFloat(parts[1]) || 0,
      branches: parseFloat(parts[2]) || 0,
      functions: parseFloat(parts[3]) || 0,
      lines: parseFloat(parts[4]) || 0
    };
  }

  private parseVitestOutput(output: string): TestResult['tests'] {
    // Vitest output parsing logic
    const testMatch = output.match(/Test Files\s+(\d+) passed/);
    const passed = testMatch ? parseInt(testMatch[1]) : 0;
    
    return {
      total: passed,
      passed,
      failed: 0,
      skipped: 0
    };
  }

  private parseMochaOutput(output: string): TestResult['tests'] {
    const passedMatch = output.match(/(\d+) passing/);
    const failedMatch = output.match(/(\d+) failing/);
    const skippedMatch = output.match(/(\d+) pending/);

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped
    };
  }

  private parseAvaOutput(output: string): TestResult['tests'] {
    const passedMatch = output.match(/(\d+) tests passed/);
    const failedMatch = output.match(/(\d+) tests failed/);
    const skippedMatch = output.match(/(\d+) tests skipped/);

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped
    };
  }

  private getTestResults(): TestResult[] {
    return (this as any).testResults || [];
  }
}

export const testEnhancedCommand = new Command('test')
  .description('Run tests with enhanced framework support and reporting')
  .option('-w, --watch', 'watch files for changes and rerun tests')
  .option('-c, --coverage', 'generate code coverage report')
  .option('-v, --verbose', 'verbose output')
  .option('-p, --pattern <pattern>', 'test file pattern')
  .option('-t, --testNamePattern <pattern>', 'test name pattern')
  .option('--timeout <ms>', 'test timeout in milliseconds', parseInt)
  .option('--maxWorkers <num>', 'maximum number of worker processes', parseInt)
  .option('--bail', 'stop after first test failure')
  .option('--silent', 'prevent tests from printing messages through console')
  .option('--reporter <name>', 'test reporter to use')
  .option('--updateSnapshot', 'update snapshots')
  .option('--detectOpenHandles', 'detect open handles preventing Jest from exiting')
  .option('--forceExit', 'force Jest to exit after tests complete')
  .option('--passWithNoTests', 'allow the test suite to pass when no files are found')
  .option('--ci', 'run in CI mode')
  .option('--runInBand', 'run tests serially in the current process')
  .option('--onlyChanged', 'only run tests for changed files')
  .option('--onlyFailures', 'only run tests for files with failures')
  .option('--clearCache', 'clear test cache before running')
  .option('--debug', 'enable debug mode')
  .action(async (options: TestOptions) => {
    try {
      const cwd = process.cwd();
      
      // Validate plugin directory
      const manifestPath = path.join(cwd, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No plugin.json found. Make sure you\'re in a plugin directory.');
      }

      logger.header('🧪 Running Tests');

      const testRunner = new TestRunner(cwd, options);
      const results = await testRunner.run();

      // Display results
      logger.newLine();
      logger.info('Test Results:');
      logger.newLine();

      let allPassed = true;
      let totalTests = 0;
      let totalPassed = 0;
      let totalFailed = 0;
      let totalSkipped = 0;

      for (const result of results) {
        const status = result.success ? chalk.green('✓') : chalk.red('✗');
        const duration = chalk.gray(`(${result.duration}ms)`);
        
        logger.info(`${status} ${result.framework} ${duration}`);
        
        if (result.tests.total > 0) {
          const testsSummary = [
            `${result.tests.total} total`,
            result.tests.passed > 0 ? chalk.green(`${result.tests.passed} passed`) : null,
            result.tests.failed > 0 ? chalk.red(`${result.tests.failed} failed`) : null,
            result.tests.skipped > 0 ? chalk.yellow(`${result.tests.skipped} skipped`) : null
          ].filter(Boolean).join(', ');
          
          logger.info(`    ${testsSummary}`);
        }

        if (result.coverage) {
          logger.info(`    Coverage: ${result.coverage.lines}% lines, ${result.coverage.functions}% functions`);
        }

        if (!result.success) {
          allPassed = false;
        }

        totalTests += result.tests.total;
        totalPassed += result.tests.passed;
        totalFailed += result.tests.failed;
        totalSkipped += result.tests.skipped;
      }

      logger.newLine();
      
      if (results.length > 1) {
        logger.info('Overall Summary:');
        const overallStatus = allPassed ? chalk.green('✓ All tests passed') : chalk.red('✗ Some tests failed');
        logger.info(`${overallStatus}`);
        
        if (totalTests > 0) {
          const overallSummary = [
            `${totalTests} total`,
            totalPassed > 0 ? chalk.green(`${totalPassed} passed`) : null,
            totalFailed > 0 ? chalk.red(`${totalFailed} failed`) : null,
            totalSkipped > 0 ? chalk.yellow(`${totalSkipped} skipped`) : null
          ].filter(Boolean).join(', ');
          
          logger.info(`${overallSummary}`);
        }
      }

      if (!allPassed) {
        process.exit(1);
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });