import * as fs from 'fs-extra';
import * as path from 'path';
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
import { logger } from './logger';
import { ErrorHandler } from './error-handler';

export interface PluginManifest {
  manifest?: string;
  id: string;
  name: string;
  displayName?: string;
  version: string;
  publisher?: string;
  description: string;
  author: string;
  main: string;
  engines: {
    lokus: string;
  };
  permissions?: string[];
  capabilities?: {
    untrustedWorkspaces?: { supported: boolean };
    virtualWorkspaces?: { supported: boolean };
  };
  categories?: string[];
  keywords?: string[];
  repository?: string | { type: string; url: string };
  bugs?: string | { url: string; email?: string };
  homepage?: string;
  license?: string;
  galleryBanner?: {
    color?: string;
    theme?: 'dark' | 'light';
  };
  icon?: string;
  screenshots?: string[];
  activationEvents?: string[];
  contributes?: {
    commands?: any[];
    menus?: any[];
    themes?: any[];
    languages?: any[];
    debuggers?: any[];
    [key: string]: any;
  };
}

export class PluginValidator {
  private ajv: any;
  private manifestSchema: object;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);

    this.manifestSchema = {
      type: 'object',
      required: ['name', 'version', 'description', 'author', 'main', 'engines'],
      properties: {
        manifest: {
          type: 'string',
          const: '2.0'
        },
        id: {
          type: 'string',
          pattern: '^[a-z0-9-]+$',
          minLength: 3,
          maxLength: 50
        },
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 50
        },
        displayName: {
          type: 'string',
          minLength: 1,
          maxLength: 100
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+(?:-[\\w\\.]+)?$'
        },
        publisher: {
          type: 'string',
          pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
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
        lokusVersion: {
          type: 'string',
          pattern: '^[\\^~>=<]*\\d+\\.\\d+\\.\\d+'
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
        capabilities: {
          type: 'object',
          properties: {
            untrustedWorkspaces: {
              type: 'object',
              properties: {
                supported: { type: 'boolean' }
              }
            },
            virtualWorkspaces: {
              type: 'object',
              properties: {
                supported: { type: 'boolean' }
              }
            }
          }
        },
        permissions: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        categories: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10
        },
        repository: {
          type: ['string', 'object']
        },
        bugs: {
          type: ['string', 'object']
        },
        homepage: {
          type: 'string'
        },
        license: {
          type: 'string'
        },
        galleryBanner: {
          type: 'object',
          properties: {
            color: { type: 'string' },
            theme: { enum: ['dark', 'light'] }
          }
        },
        icon: {
          type: 'string'
        },
        screenshots: {
          type: 'array',
          items: { type: 'string' }
        },
        contributes: {
          type: 'object'
        },
        activationEvents: {
          type: 'array',
          items: { type: 'string' }
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

    // Validate assets
    if (manifest.icon) {
      const iconPath = path.join(pluginDir, manifest.icon);
      if (!await fs.pathExists(iconPath)) {
        logger.warning(`Icon file not found: ${manifest.icon}`);
      }
    }

    if (manifest.screenshots) {
      for (const screenshot of manifest.screenshots) {
        const screenshotPath = path.join(pluginDir, screenshot);
        if (!await fs.pathExists(screenshotPath)) {
          logger.warning(`Screenshot file not found: ${screenshot}`);
        }
      }
    }

    // Validate package.json
    await this.validatePackageJson(path.join(pluginDir, 'package.json'), manifest);

    logger.success('Plugin structure validation passed');
  }

  private async validatePackageJson(packagePath: string, manifest: PluginManifest): Promise<void> {
    try {
      const packageJson = await fs.readJson(packagePath);

      // Cross-validate with manifest
      if (packageJson.name !== manifest.id) {
        // Note: package.json name usually matches plugin ID
        logger.warning(`Package name (${packageJson.name}) does not match plugin ID (${manifest.id})`);
      }

      if (packageJson.version !== manifest.version) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Version mismatch between plugin.json and package.json'
        );
      }

      // Check for required dependencies
      const requiredDeps = ['lokus-plugin-sdk'];
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