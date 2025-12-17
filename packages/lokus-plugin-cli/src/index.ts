#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import figlet from 'figlet'
import gradient from 'gradient-string'
import boxen from 'boxen'
import { createEnhancedCommand } from './commands/create-enhanced.js'
import { linkCommand } from './commands/link.js'
import { loginCommand } from './commands/login.js'
import { buildCommand } from './commands/build.js'
import { packageEnhancedCommand } from './commands/package-enhanced.js'
import { publishCommand } from './commands/publish.js'
import { testEnhancedCommand } from './commands/test-enhanced.js'
import { devEnhancedCommand } from './commands/dev-enhanced.js'
import { validateCommand } from './commands/validate.js'
import { docsEnhancedCommand } from './commands/docs-enhanced.js'

const program = new Command()

// Show fancy header for help command
// Note: beforeAll is not in the Help type definition, but works at runtime
program.configureHelp({} as any);

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
program
  .addCommand(validateCommand)
  .addCommand(linkCommand)
  .addCommand(loginCommand);

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

// Run CLI if executed directly
CLI.run(process.argv).catch(error => {
  console.error(chalk.red('Fatal error:'), error)
  process.exit(1)
})