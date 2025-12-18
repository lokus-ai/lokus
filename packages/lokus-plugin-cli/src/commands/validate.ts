import { Command } from 'commander'
import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as path from 'path'

export const validateCommand = new Command('validate')
  .description('Validate a plugin manifest')
  .option('-p, --path <path>', 'Path to plugin directory', '.')
  .action(async (options) => {
    try {
      const pluginPath = path.resolve(options.path)
      const manifestPath = path.join(pluginPath, 'plugin.json')
      
      if (!await fs.pathExists(manifestPath)) {
        console.error(chalk.red('Error: plugin.json not found'))
        process.exit(1)
      }
      
      const manifest = await fs.readJson(manifestPath)
      
      // Basic validation
      const required = ['id', 'name', 'version']
      const missing = required.filter(field => !manifest[field])
      
      if (missing.length > 0) {
        console.error(chalk.red(`Missing required fields: ${missing.join(', ')}`))
        process.exit(1)
      }

      // Validation passed - show success output
      console.log(chalk.green('✓ Plugin manifest is valid'))
      console.log(chalk.dim(`  Name: ${manifest.name}`))
      console.log(chalk.dim(`  Version: ${manifest.version}`))
      if (manifest.description) {
        console.log(chalk.dim(`  Description: ${manifest.description}`))
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })