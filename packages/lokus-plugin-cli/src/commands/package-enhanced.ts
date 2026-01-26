import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import archiver from 'archiver';
import * as tar from 'tar';
import chalk from 'chalk';
import { Listr } from 'listr2';
import semver from 'semver';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';
import { buildPlugin } from './build';
import { DependencyManager } from '../utils/dependency-manager';
// Import version from package.json (single source of truth)
import pkg from '../../package.json';

export interface PackageOptions {
  outDir?: string;
  format?: 'zip' | 'tar' | 'both';
  minify?: boolean;
  sourcemap?: boolean;
  target?: 'production' | 'development';
  sign?: boolean;
  verify?: boolean;
  includeSource?: boolean;
  includeDocs?: boolean;
  includeTests?: boolean;
  marketplace?: string;
  prerelease?: boolean;
  dryRun?: boolean;
}

interface PackageManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  engines: Record<string, string>;
  permissions: string[];
  categories: string[];
  keywords: string[];
  repository?: {
    type: string;
    url: string;
  };
  bugs?: {
    url: string;
  };
  homepage?: string;
  license: string;
  files: string[];
  checksums: Record<string, string>;
  packageInfo: {
    size: number;
    fileCount: number;
    createdAt: string;
    buildTarget: string;
    toolVersion: string;
  };
}

export class PluginPackager {
  private pluginDir: string;
  private options: PackageOptions;
  private dependencyManager: DependencyManager;
  private manifest: any;
  private packageManifest: PackageManifest | null = null;

  constructor(pluginDir: string, options: PackageOptions) {
    this.pluginDir = pluginDir;
    this.options = options;
    this.dependencyManager = new DependencyManager(pluginDir);
  }

  async package(): Promise<{ files: string[]; manifest: PackageManifest }> {
    const tasks = new Listr([
      {
        title: 'Validating plugin structure',
        task: async () => {
          await this.validatePlugin();
        }
      },
      {
        title: 'Reading plugin manifest',
        task: async () => {
          await this.readManifest();
        }
      },
      {
        title: 'Building plugin for production',
        task: async (ctx, task) => {
          if (this.options.dryRun) {
            task.skip('Dry run - skipping build');
            return;
          }
          
          await this.buildForProduction();
        }
      },
      {
        title: 'Preparing package files',
        task: async () => {
          await this.prepareFiles();
        }
      },
      {
        title: 'Generating package manifest',
        task: async () => {
          await this.generatePackageManifest();
        }
      },
      {
        title: 'Creating package archives',
        task: async (ctx, task) => {
          if (this.options.dryRun) {
            task.skip('Dry run - skipping archive creation');
            return;
          }
          
          await this.createArchives();
        }
      },
      {
        title: 'Verifying package integrity',
        task: async (ctx, task) => {
          if (!this.options.verify) {
            task.skip('Verification disabled');
            return;
          }
          
          await this.verifyPackage();
        }
      },
      {
        title: 'Signing package',
        task: async (ctx, task) => {
          if (!this.options.sign) {
            task.skip('Signing disabled');
            return;
          }
          
          await this.signPackage();
        }
      }
    ], {
      rendererOptions: {}
    });

    await tasks.run();

    const outDir = this.options.outDir || 'dist';
    const files = await this.getCreatedFiles(outDir);

    return {
      files,
      manifest: this.packageManifest!
    };
  }

  private async validatePlugin(): Promise<void> {
    await pluginValidator.validatePluginStructure(this.pluginDir);
    
    // Additional packaging validations
    const requiredFiles = ['plugin.json', 'package.json'];
    for (const file of requiredFiles) {
      const filePath = path.join(this.pluginDir, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Validate package.json
    const packageValidation = await this.dependencyManager.validatePackageJson();
    if (!packageValidation.valid) {
      throw new Error(`Invalid package.json: ${packageValidation.errors.join(', ')}`);
    }
  }

  private async readManifest(): Promise<void> {
    const manifestPath = path.join(this.pluginDir, 'plugin.json');
    this.manifest = await fs.readJson(manifestPath);
    
    // Validate semantic version
    if (!semver.valid(this.manifest.version)) {
      throw new Error(`Invalid version in plugin.json: ${this.manifest.version}`);
    }
  }

  private async buildForProduction(): Promise<void> {
    await buildPlugin(this.pluginDir, {
      outDir: 'dist',
      target: this.options.target || 'production',
      minify: this.options.minify !== false,
      sourcemap: this.options.sourcemap === true,
      clean: true
    });
  }

  private async prepareFiles(): Promise<void> {
    const tempDir = path.join(this.pluginDir, '.package-temp');
    await fs.ensureDir(tempDir);
    
    // Copy essential files
    const essentialFiles = [
      'plugin.json',
      'package.json',
      'README.md',
      'LICENSE',
      'CHANGELOG.md'
    ];

    for (const file of essentialFiles) {
      const srcPath = path.join(this.pluginDir, file);
      const destPath = path.join(tempDir, file);
      
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, destPath);
      }
    }

    // Copy built files
    const distPath = path.join(this.pluginDir, 'dist');
    if (await fs.pathExists(distPath)) {
      await fs.copy(distPath, path.join(tempDir, 'dist'));
    }

    // Copy additional files based on options
    if (this.options.includeSource) {
      const srcPath = path.join(this.pluginDir, 'src');
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, path.join(tempDir, 'src'));
      }
    }

    if (this.options.includeDocs) {
      const docsPath = path.join(this.pluginDir, 'docs');
      if (await fs.pathExists(docsPath)) {
        await fs.copy(docsPath, path.join(tempDir, 'docs'));
      }
    }

    if (this.options.includeTests) {
      const testPaths = ['test', 'tests', '__tests__'];
      for (const testPath of testPaths) {
        const srcTestPath = path.join(this.pluginDir, testPath);
        if (await fs.pathExists(srcTestPath)) {
          await fs.copy(srcTestPath, path.join(tempDir, testPath));
          break;
        }
      }
    }
  }

  private async generatePackageManifest(): Promise<void> {
    const tempDir = path.join(this.pluginDir, '.package-temp');
    const packageJsonPath = path.join(this.pluginDir, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    // Calculate file checksums
    const checksums = await this.calculateChecksums(tempDir);
    
    // Get package statistics
    const stats = await this.getPackageStats(tempDir);
    
    this.packageManifest = {
      name: this.manifest.name,
      version: this.manifest.version,
      description: this.manifest.description,
      author: this.manifest.author,
      main: this.manifest.main,
      engines: this.manifest.engines || { lokus: '^1.0.0' },
      permissions: this.manifest.permissions || [],
      categories: this.manifest.categories || ['Other'],
      keywords: this.manifest.keywords || [],
      repository: packageJson.repository,
      bugs: packageJson.bugs,
      homepage: packageJson.homepage,
      license: packageJson.license || 'MIT',
      files: Object.keys(checksums),
      checksums,
      packageInfo: {
        size: stats.size,
        fileCount: stats.fileCount,
        createdAt: new Date().toISOString(),
        buildTarget: this.options.target || 'production',
        toolVersion: pkg.version // CLI version from package.json
      }
    };

    // Write package manifest
    const manifestPath = path.join(tempDir, 'package-manifest.json');
    await fs.writeJson(manifestPath, this.packageManifest, { spaces: 2 });
  }

  private async calculateChecksums(dir: string): Promise<Record<string, string>> {
    const checksums: Record<string, string> = {};
    
    const walk = async (currentDir: string, basePath = ''): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath, relativePath);
        } else {
          const content = await fs.readFile(fullPath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          checksums[relativePath] = hash;
        }
      }
    };
    
    await walk(dir);
    return checksums;
  }

  private async getPackageStats(dir: string): Promise<{ size: number; fileCount: number }> {
    let size = 0;
    let fileCount = 0;
    
    const walk = async (currentDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
          fileCount++;
        }
      }
    };
    
    await walk(dir);
    return { size, fileCount };
  }

  private async createArchives(): Promise<void> {
    const tempDir = path.join(this.pluginDir, '.package-temp');
    const outDir = path.join(this.pluginDir, this.options.outDir || 'dist');
    await fs.ensureDir(outDir);
    
    const baseName = `${this.manifest.name}-${this.manifest.version}`;
    const formats = this.options.format === 'both' ? ['zip', 'tar'] : [this.options.format || 'zip'];
    
    for (const format of formats) {
      if (format === 'zip') {
        await this.createZipArchive(tempDir, outDir, baseName);
      } else if (format === 'tar') {
        await this.createTarArchive(tempDir, outDir, baseName);
      }
    }
    
    // Cleanup temp directory
    await fs.remove(tempDir);
  }

  private async createZipArchive(sourceDir: string, outDir: string, baseName: string): Promise<void> {
    const archivePath = path.join(outDir, `${baseName}.zip`);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        logger.info(`Created ZIP package: ${archivePath} (${archive.pointer()} bytes)`);
        resolve();
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private async createTarArchive(sourceDir: string, outDir: string, baseName: string): Promise<void> {
    const archivePath = path.join(outDir, `${baseName}.tar.gz`);
    
    await tar.create({
      gzip: true,
      file: archivePath,
      cwd: sourceDir
    }, await fs.readdir(sourceDir));
    
    const stats = await fs.stat(archivePath);
    logger.info(`Created TAR package: ${archivePath} (${stats.size} bytes)`);
  }

  private async verifyPackage(): Promise<void> {
    const outDir = path.join(this.pluginDir, this.options.outDir || 'dist');
    const baseName = `${this.manifest.name}-${this.manifest.version}`;
    
    // Verify archives exist and are valid
    const formats = this.options.format === 'both' ? ['zip', 'tar'] : [this.options.format || 'zip'];
    
    for (const format of formats) {
      const extension = format === 'zip' ? '.zip' : '.tar.gz';
      const archivePath = path.join(outDir, `${baseName}${extension}`);
      
      if (!await fs.pathExists(archivePath)) {
        throw new Error(`Package file not found: ${archivePath}`);
      }
      
      const stats = await fs.stat(archivePath);
      if (stats.size === 0) {
        throw new Error(`Package file is empty: ${archivePath}`);
      }
    }
    
    logger.info('Package verification completed successfully');
  }

  private async signPackage(): Promise<void> {
    // TODO: Implement package signing
    // This would involve creating digital signatures for the packages
    // using private keys and storing public keys for verification
    logger.info('Package signing would be implemented here');
  }

  private async getCreatedFiles(outDir: string): Promise<string[]> {
    const files: string[] = [];
    const baseName = `${this.manifest.name}-${this.manifest.version}`;
    const formats = this.options.format === 'both' ? ['zip', 'tar'] : [this.options.format || 'zip'];
    
    for (const format of formats) {
      const extension = format === 'zip' ? '.zip' : '.tar.gz';
      const fileName = `${baseName}${extension}`;
      const filePath = path.join(outDir, fileName);
      
      if (await fs.pathExists(filePath)) {
        files.push(filePath);
      }
    }
    
    return files;
  }
}

export const packageEnhancedCommand = new Command('package')
  .description('Package plugin for distribution with enhanced features')
  .option('-o, --out-dir <dir>', 'output directory', 'dist')
  .option('-f, --format <format>', 'package format (zip, tar, both)', 'zip')
  .option('--no-minify', 'disable code minification')
  .option('--sourcemap', 'include source maps')
  .option('-t, --target <target>', 'build target (production, development)', 'production')
  .option('--sign', 'sign the package')
  .option('--verify', 'verify package integrity', true)
  .option('--include-source', 'include source code in package')
  .option('--include-docs', 'include documentation in package')
  .option('--include-tests', 'include tests in package')
  .option('--marketplace <name>', 'target marketplace (lokus, vscode, chrome)')
  .option('--prerelease', 'mark as prerelease version')
  .option('--dry-run', 'perform a dry run without creating files')
  .action(async (options: PackageOptions) => {
    try {
      const cwd = process.cwd();
      
      // Validate plugin directory
      const manifestPath = path.join(cwd, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No plugin.json found. Make sure you\'re in a plugin directory.');
      }

      logger.header('📦 Package Plugin');
      
      if (options.dryRun) {
        logger.info(chalk.yellow('Running in dry-run mode - no files will be created'));
      }

      const packager = new PluginPackager(cwd, options);
      const result = await packager.package();
      
      logger.newLine();
      logger.success('Plugin packaged successfully!');
      logger.newLine();
      
      if (!options.dryRun) {
        logger.info('Created files:');
        result.files.forEach(file => {
          const stats = fs.statSync(file);
          const size = (stats.size / 1024).toFixed(1);
          logger.info(`  ${chalk.cyan(path.basename(file))} (${size} KB)`);
        });
        logger.newLine();
      }
      
      logger.info('Package Details:');
      logger.info(`  Name: ${chalk.cyan(result.manifest.name)}`);
      logger.info(`  Version: ${chalk.cyan(result.manifest.version)}`);
      logger.info(`  Files: ${chalk.cyan(result.manifest.packageInfo.fileCount.toString())}`);
      logger.info(`  Size: ${chalk.cyan((result.manifest.packageInfo.size / 1024).toFixed(1))} KB`);
      logger.info(`  Target: ${chalk.cyan(result.manifest.packageInfo.buildTarget)}`);
      logger.newLine();
      
      if (options.marketplace) {
        logger.info('Next steps for marketplace deployment:');
        switch (options.marketplace) {
          case 'lokus':
            logger.info('  1. Visit https://marketplace.lokus.dev');
            logger.info('  2. Sign in with your account');
            logger.info('  3. Upload the package file');
            break;
          case 'vscode':
            logger.info('  1. Install vsce: npm install -g vsce');
            logger.info('  2. Run: vsce publish');
            break;
          case 'chrome':
            logger.info('  1. Visit Chrome Web Store Developer Dashboard');
            logger.info('  2. Upload the package as a new item');
            break;
        }
        logger.newLine();
      }
      
    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });