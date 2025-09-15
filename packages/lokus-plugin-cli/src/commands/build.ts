import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator, PluginManifest } from '../utils/plugin-validator';
import { FileUtils } from '../utils/file-utils';

export interface BuildOptions {
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean;
  target?: 'production' | 'development';
  watch?: boolean;
  clean?: boolean;
  bundle?: boolean;
  external?: string[];
  define?: Record<string, string>;
}

export async function buildPlugin(pluginDir: string, options: BuildOptions = {}): Promise<void> {
  const {
    outDir = 'dist',
    minify = options.target === 'production',
    sourcemap = options.target !== 'production',
    target = 'production',
    clean = true,
    bundle = true,
    external = ['@lokus/plugin-sdk'],
    define = {}
  } = options;

  const buildDir = path.resolve(pluginDir, outDir);
  const manifestPath = path.join(pluginDir, 'plugin.json');
  const packagePath = path.join(pluginDir, 'package.json');

  // Read and validate manifest
  const manifest = await pluginValidator.validateManifest(manifestPath);
  const packageJson = await FileUtils.readJsonFile(packagePath);

  // Clean build directory
  if (clean && await fs.pathExists(buildDir)) {
    await fs.remove(buildDir);
  }
  await fs.ensureDir(buildDir);

  // Determine entry point
  const entryPoint = await findEntryPoint(pluginDir, manifest);
  
  if (!entryPoint) {
    throw ErrorHandler.createError(
      'FileNotFoundError',
      `Entry point not found. Expected: ${manifest.main}`
    );
  }

  // Build configuration
  const buildConfig: esbuild.BuildOptions = {
    entryPoints: [entryPoint],
    outfile: path.join(buildDir, 'index.js'),
    bundle,
    minify,
    sourcemap,
    target: 'es2020',
    format: 'cjs',
    platform: 'node',
    external: external.concat([
      // Common Node.js modules that should be external
      'fs', 'path', 'os', 'crypto', 'util', 'events', 'stream',
      // Lokus-specific externals
      'lokus', 'electron'
    ]),
    define: {
      'process.env.NODE_ENV': JSON.stringify(target),
      'process.env.PLUGIN_NAME': JSON.stringify(manifest.name),
      'process.env.PLUGIN_VERSION': JSON.stringify(manifest.version),
      ...define
    },
    metafile: true,
    logLevel: 'silent', // We'll handle logging ourselves
    plugins: [
      {
        name: 'external-dependencies',
        setup(build) {
          // Mark all dependencies as external unless explicitly bundled
          build.onResolve({ filter: /^[^.\/]/ }, (args) => {
            if (external.includes(args.path)) {
              return { path: args.path, external: true };
            }
            return null;
          });
        }
      },
      {
        name: 'build-logger',
        setup(build) {
          build.onStart(() => {
            logger.debug('esbuild: Starting build...');
          });

          build.onEnd((result) => {
            if (result.errors.length > 0) {
              logger.debug(`esbuild: Build failed with ${result.errors.length} errors`);
            } else {
              logger.debug('esbuild: Build completed successfully');
            }
          });
        }
      }
    ]
  };

  try {
    // Run esbuild
    const result = await esbuild.build(buildConfig);

    // Handle build errors
    if (result.errors.length > 0) {
      const errorMessages = result.errors.map(error => {
        const location = error.location 
          ? `${error.location.file}:${error.location.line}:${error.location.column}`
          : 'unknown location';
        return `${location}: ${error.text}`;
      }).join('\n');
      
      throw ErrorHandler.createError('ValidationError', `Build errors:\n${errorMessages}`);
    }

    // Handle build warnings
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        const location = warning.location 
          ? `${warning.location.file}:${warning.location.line}:${warning.location.column}`
          : 'unknown location';
        logger.warning(`${location}: ${warning.text}`);
      });
    }

    // Copy additional assets
    await copyAssets(pluginDir, buildDir, manifest);

    // Copy and update plugin manifest
    await copyManifest(manifestPath, buildDir, target);

    // Generate build info
    await generateBuildInfo(buildDir, {
      buildTime: new Date().toISOString(),
      target,
      version: manifest.version,
      entryPoint: path.relative(pluginDir, entryPoint),
      bundleSize: result.metafile ? getBundleSize(result.metafile) : 0
    });

    // Validate build output
    await pluginValidator.validateBuildOutput(buildDir);

    // Log build summary
    const bundleSize = result.metafile ? getBundleSize(result.metafile) : 0;
    logger.info(`Bundle size: ${FileUtils.formatFileSize(bundleSize)}`);
    
    if (result.metafile) {
      logBuildAnalysis(result.metafile);
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('esbuild')) {
      throw ErrorHandler.createError('ValidationError', `Build failed: ${error.message}`);
    }
    throw error;
  }
}

async function findEntryPoint(pluginDir: string, manifest: PluginManifest): Promise<string | null> {
  const possibleEntries = [
    manifest.main,
    'src/index.ts',
    'src/index.js',
    'src/main.ts',
    'src/main.js',
    'index.ts',
    'index.js'
  ];

  for (const entry of possibleEntries) {
    const entryPath = path.resolve(pluginDir, entry);
    if (await fs.pathExists(entryPath)) {
      return entryPath;
    }
  }

  return null;
}

async function copyAssets(pluginDir: string, buildDir: string, manifest: PluginManifest): Promise<void> {
  const assetPatterns = [
    'assets/**/*',
    'themes/**/*',
    'languages/**/*',
    'snippets/**/*',
    'icons/**/*',
    '*.md',
    'LICENSE*'
  ];

  // Add icon if specified
  if (manifest.icon) {
    assetPatterns.push(manifest.icon);
  }

  // Add screenshots if specified
  if (manifest.screenshots) {
    assetPatterns.push(...manifest.screenshots);
  }

  for (const pattern of assetPatterns) {
    const files = await glob(pattern, { cwd: pluginDir });
    
    for (const file of files) {
      const srcPath = path.join(pluginDir, file);
      const destPath = path.join(buildDir, file);
      
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(srcPath, destPath);
    }
  }
}

async function copyManifest(manifestPath: string, buildDir: string, target: string): Promise<void> {
  const manifest = await FileUtils.readJsonFile(manifestPath);
  
  // Update manifest for build
  const buildManifest = {
    ...manifest,
    main: 'index.js', // Always point to built file
    build: {
      target,
      buildTime: new Date().toISOString()
    }
  };

  // Remove development-only fields in production
  if (target === 'production') {
    delete buildManifest.devDependencies;
  }

  await FileUtils.writeJsonFile(path.join(buildDir, 'plugin.json'), buildManifest);
}

async function generateBuildInfo(buildDir: string, info: any): Promise<void> {
  await FileUtils.writeJsonFile(path.join(buildDir, '.build-info.json'), info);
}

function getBundleSize(metafile: esbuild.Metafile): number {
  return Object.values(metafile.outputs).reduce((total, output) => total + output.bytes, 0);
}

function logBuildAnalysis(metafile: esbuild.Metafile): void {
  const outputs = Object.entries(metafile.outputs);
  
  if (outputs.length === 0) return;

  logger.debug('Build analysis:');
  
  outputs.forEach(([file, output]) => {
    const size = FileUtils.formatFileSize(output.bytes);
    logger.debug(`  ${path.basename(file)}: ${size}`);
  });

  // Show largest dependencies
  const inputs = Object.entries(metafile.inputs)
    .filter(([file]) => !file.includes('node_modules'))
    .sort(([, a], [, b]) => b.bytes - a.bytes)
    .slice(0, 5);

  if (inputs.length > 0) {
    logger.debug('Largest source files:');
    inputs.forEach(([file, input]) => {
      const size = FileUtils.formatFileSize(input.bytes);
      logger.debug(`  ${path.basename(file)}: ${size}`);
    });
  }
}

export const buildCommand = new Command('build')
  .description('Build plugin for production')
  .option('-o, --out-dir <dir>', 'output directory', 'dist')
  .option('--no-minify', 'disable code minification')
  .option('--no-sourcemap', 'disable source map generation')
  .option('--target <target>', 'build target (production|development)', 'production')
  .option('-w, --watch', 'watch for changes and rebuild')
  .option('--no-clean', 'do not clean output directory before build')
  .option('--no-bundle', 'disable bundling (keep imports)')
  .option('--external <modules...>', 'external modules to exclude from bundle')
  .option('--define <key=value...>', 'define global constants')
  .action(async (options: BuildOptions & { define?: string[] }) => {
    try {
      const pluginDir = process.cwd();
      
      // Validate plugin directory
      ErrorHandler.validatePluginDirectory(pluginDir);

      logger.header('🔨 Building Plugin');

      // Parse define options
      const define: Record<string, string> = {};
      if (options.define) {
        options.define.forEach(def => {
          const [key, value] = def.split('=');
          if (key && value) {
            define[key] = value;
          }
        });
      }

      const buildOptions: BuildOptions = {
        ...options,
        define
      };

      if (options.watch) {
        logger.info('Starting build in watch mode...');
        
        const chokidar = require('chokidar');
        const watcher = chokidar.watch(['src/**/*', 'plugin.json'], {
          ignored: /(^|[\/\\])\../,
          persistent: true,
          ignoreInitial: true
        });

        let isBuilding = false;

        const doBuild = async () => {
          if (isBuilding) return;
          
          isBuilding = true;
          try {
            const spinner = logger.startSpinner('Building...');
            await buildPlugin(pluginDir, buildOptions);
            spinner.succeed(`Built successfully at ${new Date().toLocaleTimeString()}`);
          } catch (error) {
            logger.stopSpinner(false, 'Build failed');
            ErrorHandler.handleError(error);
          } finally {
            isBuilding = false;
          }
        };

        // Initial build
        await doBuild();

        // Watch for changes
        watcher.on('change', (path: string) => {
          logger.info(`File changed: ${chalk.cyan(path)}`);
          doBuild();
        });

        logger.info('Watching for changes... Press Ctrl+C to stop');

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          logger.info('\nStopping watch mode...');
          watcher.close();
          process.exit(0);
        });

      } else {
        const spinner = logger.startSpinner('Building plugin...');
        
        await buildPlugin(pluginDir, buildOptions);
        
        spinner.succeed('Plugin built successfully');
        
        const buildDir = path.resolve(pluginDir, options.outDir || 'dist');
        const buildSize = await FileUtils.calculateDirSize(buildDir);
        
        logger.newLine();
        logger.info(`Output: ${chalk.cyan(buildDir)}`);
        logger.info(`Total size: ${FileUtils.formatFileSize(buildSize)}`);
        
        // Show next steps
        logger.newLine();
        logger.info('Next steps:');
        logger.info('  lokus-plugin test     # Run tests');
        logger.info('  lokus-plugin package  # Package for distribution');
      }

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });