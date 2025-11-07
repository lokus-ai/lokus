import * as path from 'path';
import * as fs from 'fs-extra';
import { execa } from 'execa';
import { logger } from './logger';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export class DependencyManager {
  private packageManager: PackageManager | null = null;

  constructor(private projectDir: string) {}

  /**
   * Detect the package manager being used
   */
  async detectPackageManager(): Promise<PackageManager> {
    if (this.packageManager) {
      return this.packageManager;
    }

    // Check for lock files
    const lockFiles = [
      { file: 'bun.lockb', manager: 'bun' as PackageManager },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' as PackageManager },
      { file: 'yarn.lock', manager: 'yarn' as PackageManager },
      { file: 'package-lock.json', manager: 'npm' as PackageManager }
    ];

    for (const { file, manager } of lockFiles) {
      if (await fs.pathExists(path.join(this.projectDir, file))) {
        this.packageManager = manager;
        return manager;
      }
    }

    // Check global installation
    const managers = ['bun', 'pnpm', 'yarn', 'npm'] as PackageManager[];
    
    for (const manager of managers) {
      try {
        await execa(manager, ['--version'], { timeout: 5000 });
        this.packageManager = manager;
        return manager;
      } catch {
        // Continue to next manager
      }
    }

    // Default to npm
    this.packageManager = 'npm';
    return 'npm';
  }

  /**
   * Install dependencies
   */
  async install(): Promise<void> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: ['install'],
      yarn: ['install'],
      pnpm: ['install'],
      bun: ['install']
    };

    const command = commands[pm];
    
    try {
      await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      
      logger.success(`Dependencies installed with ${pm}`);
    } catch (error) {
      throw new Error(`Failed to install dependencies with ${pm}: ${(error as Error).message}`);
    }
  }

  /**
   * Add dependencies
   */
  async addDependencies(packages: string[], dev = false): Promise<void> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: dev ? ['install', '--save-dev', ...packages] : ['install', '--save', ...packages],
      yarn: dev ? ['add', '--dev', ...packages] : ['add', ...packages],
      pnpm: dev ? ['add', '--save-dev', ...packages] : ['add', ...packages],
      bun: dev ? ['add', '--dev', ...packages] : ['add', ...packages]
    };

    const command = commands[pm];
    
    try {
      await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      
      logger.success(`Added ${packages.join(', ')} with ${pm}`);
    } catch (error) {
      throw new Error(`Failed to add dependencies with ${pm}: ${(error as Error).message}`);
    }
  }

  /**
   * Remove dependencies
   */
  async removeDependencies(packages: string[]): Promise<void> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: ['uninstall', ...packages],
      yarn: ['remove', ...packages],
      pnpm: ['remove', ...packages],
      bun: ['remove', ...packages]
    };

    const command = commands[pm];
    
    try {
      await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      
      logger.success(`Removed ${packages.join(', ')} with ${pm}`);
    } catch (error) {
      throw new Error(`Failed to remove dependencies with ${pm}: ${(error as Error).message}`);
    }
  }

  /**
   * Run a script
   */
  async runScript(script: string, args: string[] = []): Promise<void> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: ['run', script, ...args],
      yarn: [script, ...args],
      pnpm: ['run', script, ...args],
      bun: ['run', script, ...args]
    };

    const command = commands[pm];
    
    try {
      await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to run script "${script}" with ${pm}: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a package is installed
   */
  async isPackageInstalled(packageName: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(this.projectDir, 'package.json');
      
      if (!await fs.pathExists(packageJsonPath)) {
        return false;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      
      return !!(
        packageJson.dependencies?.[packageName] ||
        packageJson.devDependencies?.[packageName] ||
        packageJson.peerDependencies?.[packageName]
      );
    } catch {
      return false;
    }
  }

  /**
   * Get installed package version
   */
  async getPackageVersion(packageName: string): Promise<string | null> {
    try {
      const packageJsonPath = path.join(this.projectDir, 'node_modules', packageName, 'package.json');
      
      if (!await fs.pathExists(packageJsonPath)) {
        return null;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      return packageJson.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Update dependencies
   */
  async updateDependencies(): Promise<void> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: ['update'],
      yarn: ['upgrade'],
      pnpm: ['update'],
      bun: ['update']
    };

    const command = commands[pm];
    
    try {
      await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      
      logger.success(`Dependencies updated with ${pm}`);
    } catch (error) {
      throw new Error(`Failed to update dependencies with ${pm}: ${(error as Error).message}`);
    }
  }

  /**
   * Check for outdated packages
   */
  async checkOutdated(): Promise<{ [key: string]: any }> {
    const pm = await this.detectPackageManager();
    
    try {
      const result = await execa(pm, ['outdated', '--json'], {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      
      return JSON.parse(result.stdout);
    } catch (error) {
      // npm outdated returns exit code 1 when there are outdated packages
      if ((error as any).stdout) {
        try {
          return JSON.parse((error as any).stdout);
        } catch {
          return {};
        }
      }
      return {};
    }
  }

  /**
   * Audit dependencies for security vulnerabilities
   */
  async auditDependencies(): Promise<any> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: ['audit', '--json'],
      yarn: ['audit', '--json'],
      pnpm: ['audit', '--json'],
      bun: ['audit'] // Bun doesn't support --json yet
    };

    const command = commands[pm];
    
    try {
      const result = await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      
      return pm === 'bun' ? result.stdout : JSON.parse(result.stdout);
    } catch (error) {
      if ((error as any).stdout && pm !== 'bun') {
        try {
          return JSON.parse((error as any).stdout);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Fix security vulnerabilities
   */
  async fixVulnerabilities(): Promise<void> {
    const pm = await this.detectPackageManager();
    
    const commands = {
      npm: ['audit', 'fix'],
      yarn: ['audit', 'fix'],
      pnpm: ['audit', '--fix'],
      bun: ['audit'] // Bun doesn't have fix option yet
    };

    const command = commands[pm];
    
    try {
      await execa(pm, command, {
        cwd: this.projectDir,
        stdio: 'inherit'
      });
      
      logger.success(`Security vulnerabilities fixed with ${pm}`);
    } catch (error) {
      logger.warning(`Failed to fix vulnerabilities with ${pm}: ${(error as Error).message}`);
    }
  }

  /**
   * Clean cache and node_modules
   */
  async clean(): Promise<void> {
    const pm = await this.detectPackageManager();
    
    // Remove node_modules
    const nodeModulesPath = path.join(this.projectDir, 'node_modules');
    if (await fs.pathExists(nodeModulesPath)) {
      await fs.remove(nodeModulesPath);
      logger.info('Removed node_modules directory');
    }

    // Remove lock file
    const lockFiles = {
      npm: 'package-lock.json',
      yarn: 'yarn.lock',
      pnpm: 'pnpm-lock.yaml',
      bun: 'bun.lockb'
    };

    const lockFile = path.join(this.projectDir, lockFiles[pm]);
    if (await fs.pathExists(lockFile)) {
      await fs.remove(lockFile);
      logger.info(`Removed ${lockFiles[pm]}`);
    }

    // Clean package manager cache
    try {
      const cleanCommands = {
        npm: ['cache', 'clean', '--force'],
        yarn: ['cache', 'clean'],
        pnpm: ['store', 'prune'],
        bun: ['pm', 'cache', 'rm']
      };

      await execa(pm, cleanCommands[pm], { stdio: 'pipe' });
      logger.success(`Cleaned ${pm} cache`);
    } catch (error) {
      logger.warning(`Failed to clean ${pm} cache: ${(error as Error).message}`);
    }
  }

  /**
   * Get package manager info
   */
  async getPackageManagerInfo(): Promise<{
    name: PackageManager;
    version: string;
    location: string;
  }> {
    const pm = await this.detectPackageManager();
    
    try {
      const versionResult = await execa(pm, ['--version'], { stdio: 'pipe' });
      const whichResult = await execa('which', [pm], { stdio: 'pipe' });
      
      return {
        name: pm,
        version: versionResult.stdout.trim(),
        location: whichResult.stdout.trim()
      };
    } catch (error) {
      throw new Error(`Failed to get ${pm} info: ${(error as Error).message}`);
    }
  }

  /**
   * Check if project needs dependencies installed
   */
  async needsInstall(): Promise<boolean> {
    const nodeModulesPath = path.join(this.projectDir, 'node_modules');
    const packageJsonPath = path.join(this.projectDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      return false;
    }

    if (!await fs.pathExists(nodeModulesPath)) {
      return true;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check if all dependencies are installed
      for (const dep of Object.keys(dependencies)) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!await fs.pathExists(depPath)) {
          return true;
        }
      }

      return false;
    } catch {
      return true;
    }
  }

  /**
   * Validate package.json
   */
  async validatePackageJson(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    const packageJsonPath = path.join(this.projectDir, 'package.json');
    
    try {
      if (!await fs.pathExists(packageJsonPath)) {
        errors.push('package.json not found');
        return { valid: false, errors };
      }

      const packageJson = await fs.readJson(packageJsonPath);
      
      // Check required fields
      const requiredFields = ['name', 'version'];
      for (const field of requiredFields) {
        if (!packageJson[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate name
      if (packageJson.name && !/^[a-z0-9-_@\/]+$/.test(packageJson.name)) {
        errors.push('Invalid package name format');
      }

      // Validate version
      if (packageJson.version && !/^\d+\.\d+\.\d+/.test(packageJson.version)) {
        errors.push('Invalid version format (should be semver)');
      }

      // Check for conflicting dependencies
      const deps = packageJson.dependencies || {};
      const devDeps = packageJson.devDependencies || {};
      
      for (const dep of Object.keys(deps)) {
        if (devDeps[dep]) {
          errors.push(`Dependency ${dep} exists in both dependencies and devDependencies`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Failed to parse package.json: ${(error as Error).message}`);
      return { valid: false, errors };
    }
  }
}