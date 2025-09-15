import { Command } from 'commander'
import chalk from 'chalk'
import { createCommand } from './commands/create.js'
import { buildCommand } from './commands/build.js'
import { packageCommand } from './commands/package.js'
import { publishCommand } from './commands/publish.js'
import { testCommand } from './commands/test.js'
import { devCommand } from './commands/dev.js'
import { validateCommand } from './commands/validate.js'

const program = new Command()

program
  .name('lokus-plugin')
  .description('Official CLI tool for developing Lokus plugins')
  .version('1.0.0')

// Add commands
program.addCommand(createCommand)
program.addCommand(buildCommand)
program.addCommand(packageCommand)
program.addCommand(publishCommand)
program.addCommand(testCommand)
program.addCommand(devCommand)
program.addCommand(validateCommand)

// Global error handler
program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0)
  }
  console.error(chalk.red('Error:'), err.message)
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