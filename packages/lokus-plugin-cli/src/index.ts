import { Command } from 'commander'
import chalk from 'chalk'
import figlet from 'figlet'
import gradient from 'gradient-string'
import boxen from 'boxen'
import { createEnhancedCommand } from './commands/create-enhanced.js'
import { buildCommand } from './commands/build.js'
import { packageEnhancedCommand } from './commands/package-enhanced.js'
import { publishCommand } from './commands/publish.js'
import { testEnhancedCommand } from './commands/test-enhanced.js'
import { devEnhancedCommand } from './commands/dev-enhanced.js'
import { validateCommand } from './commands/validate.js'
import { docsEnhancedCommand } from './commands/docs-enhanced.js'

const program = new Command()

// Show fancy header for help command
program.configureHelp({
  beforeAll: () => {
    const title = figlet.textSync('LOKUS', {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted'
    });
    
    const gradientTitle = gradient(['#ff6b6b', '#4ecdc4', '#45b7d1'])(title);
    
    const welcome = boxen(
      gradientTitle + '\n\n' +
      chalk.white.bold('Advanced Plugin Development CLI') + '\n\n' +
      chalk.gray('Create, build, test, and publish professional Lokus plugins\n') +
      chalk.gray('with modern tooling and best practices.\n\n') +
      chalk.cyan('🚀 TypeScript-first development\n') +
      chalk.cyan('⚡ Hot reload and debugging\n') +
      chalk.cyan('📦 Professional packaging\n') +
      chalk.cyan('🧪 Comprehensive testing\n') +
      chalk.cyan('📚 Auto-generated docs'),
      {
        title: 'Welcome',
        titleAlignment: 'center',
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    );
    
    return welcome + '\n';
  }
});

program
  .name('lokus-plugin')
  .description('Official CLI tool for developing Lokus plugins')
  .version('2.0.0')
  .configureOutput({
    writeOut: (str) => process.stdout.write(chalk.cyan(str)),
    writeErr: (str) => process.stderr.write(chalk.red(str))
  });

// Add enhanced commands
program.addCommand(createEnhancedCommand)
program.addCommand(buildCommand)
program.addCommand(packageEnhancedCommand)
program.addCommand(publishCommand)
program.addCommand(testEnhancedCommand)
program.addCommand(devEnhancedCommand)
program.addCommand(docsEnhancedCommand)
program.addCommand(validateCommand)

// Add global options
program
  .option('--verbose', 'enable verbose logging')
  .option('--silent', 'suppress all output except errors')
  .option('--no-color', 'disable colored output')
  .hook('preAction', (thisCommand, actionCommand) => {
    // Set global options
    const opts = thisCommand.opts();
    
    if (opts.noColor) {
      process.env.FORCE_COLOR = '0';
    }
    
    if (opts.silent) {
      process.env.LOKUS_CLI_SILENT = 'true';
    }
    
    if (opts.verbose) {
      process.env.LOKUS_CLI_VERBOSE = 'true';
    }
  });

// Global error handler
program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0)
  }
  
  if (err.code === 'commander.version') {
    process.exit(0)
  }
  
  console.error(chalk.red('Error:'), err.message)
  
  if (process.env.LOKUS_CLI_VERBOSE === 'true' && err.stack) {
    console.error(chalk.gray('Stack trace:'))
    console.error(chalk.gray(err.stack))
  }
  
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message)
  if (process.env.LOKUS_CLI_VERBOSE === 'true') {
    console.error(chalk.gray(error.stack))
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection:'), reason)
  if (process.env.LOKUS_CLI_VERBOSE === 'true') {
    console.error(chalk.gray('Promise:'), promise)
  }
  process.exit(1)
})

export class CLI {
  static async run(argv: string[]) {
    try {
      await program.parseAsync(argv)
    } catch (error) {
      console.error(chalk.red('Unexpected error:'), error)
      process.exit(1)
    }
  }
}

export default CLI