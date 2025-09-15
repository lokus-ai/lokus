import * as fs from 'fs-extra';
import * as path from 'path';
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
import { logger } from './logger';
import { ErrorHandler } from './error-handler';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  engines: {
    lokus: string;
  };
  permissions?: string[];
  categories?: string[];
  keywords?: string[];
  repository?: string;
  license?: string;
  icon?: string;
  screenshots?: string[];
  contributes?: {
    commands?: any[];
    menus?: any[];
    themes?: any[];
    languages?: any[];
    debuggers?: any[];
  };
}

export class PluginValidator {
  private ajv: any;
  private manifestSchema: object;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    
    this.manifestSchema = {
      type: 'object',
      required: ['name', 'version', 'description', 'author', 'main', 'engines'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z0-9-]+$',
          minLength: 3,
          maxLength: 50
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+(?:-[\\w\\.]+)?$'
        },
        description: {
          type: 'string',
          minLength: 10,
          maxLength: 200
        },
        author: {
          type: 'string',
          minLength: 2,
          maxLength: 100
        },
        main: {
          type: 'string',
          pattern: '\\.(js|ts)$'
        },
        engines: {
          type: 'object',
          required: ['lokus'],
          properties: {
            lokus: {
              type: 'string',
              pattern: '^[>=<~^]?\\d+\\.\\d+\\.\\d+'
            }
          }
        },
        permissions: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'filesystem:read',
              'filesystem:write',
              'network:request',
              'ui:notifications',
              'ui:dialogs',
              'editor:read',
              'editor:write',
              'workspace:read',
              'workspace:write',
              'terminal:access',
              'debug:access'
            ]
          }
        },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'Language',
              'Theme',
              'Debugger',
              'Formatter',
              'Linter',
              'Snippet',
              'Keybinding',
              'Other'
            ]
          }
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10
        },
        repository: {
          type: 'string',
          format: 'uri'
        },
        license: {
          type: 'string'
        },
        icon: {
          type: 'string'
        },
        screenshots: {
          type: 'array',
          items: { type: 'string' }
        },
        contributes: {
          type: 'object',
          properties: {
            commands: { type: 'array' },
            menus: { type: 'array' },
            themes: { type: 'array' },
            languages: { type: 'array' },
            debuggers: { type: 'array' }
          }
        }
      },
      additionalProperties: false
    };
  }

  async validateManifest(manifestPath: string): Promise<PluginManifest> {
    try {
      const manifest = await fs.readJson(manifestPath);
      const validate = this.ajv.compile(this.manifestSchema);
      const valid = validate(manifest);

      if (!valid && validate.errors) {
        const errorMessages = validate.errors.map((error: any) => {
          const field = error.instancePath ? error.instancePath.slice(1) : error.keyword;
          return `${field}: ${error.message}`;
        });
        
        throw ErrorHandler.createError(
          'ValidationError',
          `Invalid plugin manifest:\n${errorMessages.join('\n')}`
        );
      }

      return manifest as PluginManifest;
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Invalid JSON in plugin manifest file'
        );
      }
      throw error;
    }
  }

  async validatePluginStructure(pluginDir: string): Promise<void> {
    const requiredFiles = ['plugin.json', 'package.json'];
    const manifestPath = path.join(pluginDir, 'plugin.json');
    
    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(pluginDir, file);
      if (!await fs.pathExists(filePath)) {
        throw ErrorHandler.createError(
          'FileNotFoundError',
          `Required file missing: ${file}`
        );
      }
    }

    // Validate manifest
    const manifest = await this.validateManifest(manifestPath);

    // Check if main file exists
    const mainFile = path.join(pluginDir, manifest.main);
    if (!await fs.pathExists(mainFile)) {
      throw ErrorHandler.createError(
        'FileNotFoundError',
        `Main file not found: ${manifest.main}`
      );
    }

    // Validate package.json
    await this.validatePackageJson(path.join(pluginDir, 'package.json'), manifest);

    logger.success('Plugin structure validation passed');
  }

  private async validatePackageJson(packagePath: string, manifest: PluginManifest): Promise<void> {
    try {
      const packageJson = await fs.readJson(packagePath);

      // Cross-validate with manifest
      if (packageJson.name !== manifest.name) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Plugin name mismatch between plugin.json and package.json'
        );
      }

      if (packageJson.version !== manifest.version) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Version mismatch between plugin.json and package.json'
        );
      }

      // Check for required dependencies
      const requiredDeps = ['@lokus/plugin-sdk'];
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      };

      for (const dep of requiredDeps) {
        if (!allDeps[dep]) {
          logger.warning(`Recommended dependency missing: ${dep}`);
        }
      }

    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Invalid JSON in package.json file'
        );
      }
      throw error;
    }
  }

  validatePluginName(name: string): boolean {
    const nameRegex = /^[a-z0-9-]+$/;
    const reservedNames = ['lokus', 'plugin', 'core', 'api', 'system'];

    if (!nameRegex.test(name)) {
      return false;
    }

    if (name.length < 3 || name.length > 50) {
      return false;
    }

    if (reservedNames.includes(name.toLowerCase())) {
      return false;
    }

    return true;
  }

  async validateBuildOutput(buildDir: string): Promise<void> {
    const requiredFiles = ['index.js', 'plugin.json'];
    
    for (const file of requiredFiles) {
      const filePath = path.join(buildDir, file);
      if (!await fs.pathExists(filePath)) {
        throw ErrorHandler.createError(
          'FileNotFoundError',
          `Build output missing: ${file}`
        );
      }
    }

    logger.success('Build output validation passed');
  }
}

export const pluginValidator = new PluginValidator();