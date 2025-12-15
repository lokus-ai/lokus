import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class Logger {
  private spinner: Ora | null = null;

  success(message: string): void {
    console.log(chalk.green('✔'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  warning(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  debug(message: string): void {
    if (process.env.DEBUG || process.env.LOKUS_DEBUG) {
      console.log(chalk.gray('🐛'), message);
    }
  }

  log(message: string): void {
    console.log(message);
  }

  startSpinner(text: string): Ora {
    this.spinner = ora({
      text,
      color: 'blue',
      spinner: 'dots',
    }).start();
    return this.spinner;
  }

  stopSpinner(success: boolean = true, text?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(text);
      } else {
        this.spinner.fail(text);
      }
      this.spinner = null;
    }
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  newLine(): void {
    console.log();
  }

  divider(): void {
    console.log(chalk.gray('----------------------------------------'));
  }

  header(title: string): void {
    this.newLine();
    console.log(chalk.bold.cyan(title));
    this.divider();
  }

  table(data: Record<string, string>[]): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const maxWidths = keys.map(key =>
      Math.max(key.length, ...data.map(row => String(row[key] || '').length))
    );

    // Header
    const header = keys.map((key, i) => key.padEnd(maxWidths[i])).join('  ');
    console.log(chalk.bold(header));

    // Rows
    data.forEach(row => {
      const line = keys.map((key, i) =>
        String(row[key] || '').padEnd(maxWidths[i])
      ).join('  ');
      console.log(line);
    });
  }

  json(object: any): void {
    console.log(JSON.stringify(object, null, 2));
  }
}

export const logger = new Logger();