/**
 * MCP Theme Management Tools
 *
 * Provides comprehensive theme creation, management, and customization
 * through MCP protocol for AI assistants.
 */

import * as themeManager from '../../core/theme/manager.js';

/**
 * All 24 required theme tokens with descriptions
 */
const THEME_TOKENS = {
  // Core colors
  "--bg": "Background color (hex or RGB)",
  "--text": "Primary text color",
  "--panel": "Panel/sidebar background",
  "--border": "Border color",
  "--muted": "Muted/secondary text",
  "--accent": "Accent/highlight color",
  "--accent-fg": "Foreground color for accent (text on accent background)",

  // Tab colors
  "--tab-active": "Active tab background",

  // Task status colors
  "--task-todo": "Todo task color",
  "--task-progress": "In-progress task color",
  "--task-urgent": "Urgent task color",
  "--task-question": "Question task color",
  "--task-completed": "Completed task color",
  "--task-cancelled": "Cancelled task color",
  "--task-delegated": "Delegated task color",

  // Semantic colors
  "--danger": "Danger/error color",
  "--success": "Success color",
  "--warning": "Warning color",
  "--info": "Info color",

  // Editor colors
  "--editor-placeholder": "Editor placeholder text color"
};

/**
 * List all available themes (built-in + custom)
 */
export async function listThemes() {
  try {
    const themes = await themeManager.listAvailableThemes();
    return {
      themes: themes,
      count: themes.length,
      builtIn: ["dracula", "nord", "one-dark-pro", "minimal-light", "neon-dark"]
    };
  } catch (error) {
    throw new Error(`Failed to list themes: ${error.message}`);
  }
}

/**
 * Get theme details including all tokens
 */
export async function getTheme(themeId) {
  try {
    const manifest = await themeManager.loadThemeManifestById(themeId);
    if (!manifest) {
      throw new Error(`Theme "${themeId}" not found`);
    }

    return {
      id: themeId,
      name: manifest.name || themeId,
      tokens: manifest.tokens,
      tokenDescriptions: THEME_TOKENS
    };
  } catch (error) {
    throw new Error(`Failed to get theme: ${error.message}`);
  }
}

/**
 * Create a new custom theme
 *
 * @param {string} name - Theme name (will be converted to safe ID)
 * @param {Object} tokens - Token values (hex or RGB format)
 * @returns {Object} Created theme details
 */
export async function createTheme(name, tokens) {
  if (!name || typeof name !== 'string') {
    throw new Error('Theme name is required');
  }

  if (!tokens || typeof tokens !== 'object') {
    throw new Error('Theme tokens object is required');
  }

  // Validate required core tokens
  const requiredTokens = ["--bg", "--text", "--panel", "--border", "--muted", "--accent", "--accent-fg"];
  const missingTokens = requiredTokens.filter(token => !tokens[token]);

  if (missingTokens.length > 0) {
    throw new Error(`Missing required tokens: ${missingTokens.join(", ")}`);
  }

  // Validate color formats
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid token value for ${key}: must be a string`);
    }

    // Check if hex color or RGB space-separated
    const isHex = /^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(value.trim());
    const isRGB = /^\d+\s+\d+\s+\d+$/.test(value.trim());

    if (!isHex && !isRGB) {
      throw new Error(`Invalid color format for ${key}: "${value}". Use hex (#282a36) or RGB (40 42 54)`);
    }
  }

  // Generate theme ID from name (same as Rust backend)
  const themeId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  try {
    // Save theme tokens
    await themeManager.saveThemeTokens(themeId, tokens);

    return {
      id: themeId,
      name: name,
      tokens: tokens,
      message: `Theme "${name}" created successfully`
    };
  } catch (error) {
    throw new Error(`Failed to create theme: ${error.message}`);
  }
}

/**
 * Update an existing theme's tokens
 */
export async function updateTheme(themeId, tokens) {
  if (!themeId || typeof themeId !== 'string') {
    throw new Error('Theme ID is required');
  }

  if (!tokens || typeof tokens !== 'object') {
    throw new Error('Theme tokens object is required');
  }

  // Check if theme exists
  const existing = await themeManager.loadThemeManifestById(themeId);
  if (!existing) {
    throw new Error(`Theme "${themeId}" not found`);
  }

  // Merge with existing tokens (partial updates allowed)
  const mergedTokens = { ...existing.tokens, ...tokens };

  try {
    await themeManager.saveThemeTokens(themeId, mergedTokens);

    return {
      id: themeId,
      tokens: mergedTokens,
      message: `Theme "${themeId}" updated successfully`
    };
  } catch (error) {
    throw new Error(`Failed to update theme: ${error.message}`);
  }
}

/**
 * Delete a custom theme
 */
export async function deleteTheme(themeId) {
  if (!themeId || typeof themeId !== 'string') {
    throw new Error('Theme ID is required');
  }

  // Prevent deleting built-in themes
  const builtIn = ["dracula", "nord", "one-dark-pro", "minimal-light", "neon-dark"];
  if (builtIn.includes(themeId)) {
    throw new Error(`Cannot delete built-in theme "${themeId}"`);
  }

  try {
    await themeManager.deleteCustomTheme(themeId);

    return {
      id: themeId,
      message: `Theme "${themeId}" deleted successfully`
    };
  } catch (error) {
    throw new Error(`Failed to delete theme: ${error.message}`);
  }
}

/**
 * Apply a theme to the application
 */
export async function applyTheme(themeId) {
  if (!themeId || typeof themeId !== 'string') {
    throw new Error('Theme ID is required');
  }

  try {
    await themeManager.setGlobalActiveTheme(themeId);

    return {
      id: themeId,
      message: `Theme "${themeId}" applied successfully`
    };
  } catch (error) {
    throw new Error(`Failed to apply theme: ${error.message}`);
  }
}

/**
 * Export a theme to a file
 */
export async function exportTheme(themeId, exportPath) {
  if (!themeId || typeof themeId !== 'string') {
    throw new Error('Theme ID is required');
  }

  if (!exportPath || typeof exportPath !== 'string') {
    throw new Error('Export path is required');
  }

  try {
    await themeManager.exportTheme(themeId, exportPath);

    return {
      id: themeId,
      path: exportPath,
      message: `Theme "${themeId}" exported to ${exportPath}`
    };
  } catch (error) {
    throw new Error(`Failed to export theme: ${error.message}`);
  }
}

/**
 * Import a theme from a file
 */
export async function importTheme(filePath, overwrite = false) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }

  try {
    // Validate theme file first
    const validation = await themeManager.validateThemeFile(filePath);
    if (!validation.valid) {
      throw new Error(`Invalid theme file: ${validation.error}`);
    }

    // Import the theme
    const themeId = await themeManager.importThemeFile(filePath, overwrite);

    return {
      id: themeId,
      path: filePath,
      message: `Theme imported successfully as "${themeId}"`
    };
  } catch (error) {
    throw new Error(`Failed to import theme: ${error.message}`);
  }
}

/**
 * Get current active theme
 */
export async function getCurrentTheme() {
  try {
    const visuals = await themeManager.readGlobalVisuals();
    const themeId = visuals.theme;

    if (!themeId) {
      return {
        id: null,
        message: "No theme currently active"
      };
    }

    const manifest = await themeManager.loadThemeManifestById(themeId);

    return {
      id: themeId,
      name: manifest?.name || themeId,
      tokens: manifest?.tokens || {}
    };
  } catch (error) {
    throw new Error(`Failed to get current theme: ${error.message}`);
  }
}

/**
 * MCP tool definitions
 */
export const themeTools = [
  {
    name: "list_themes",
    description: "List all available themes (built-in and custom)",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_theme",
    description: "Get details of a specific theme including all token values",
    inputSchema: {
      type: "object",
      properties: {
        themeId: {
          type: "string",
          description: "Theme ID (e.g., 'dracula', 'nord', 'my-custom-theme')"
        }
      },
      required: ["themeId"]
    }
  },
  {
    name: "create_theme",
    description: "Create a new custom theme with specified colors. Supports hex (#282a36) or RGB (40 42 54) format.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Theme name (will be converted to safe ID)"
        },
        tokens: {
          type: "object",
          description: "Theme color tokens. Required: --bg, --text, --panel, --border, --muted, --accent, --accent-fg. Optional: --tab-active, --task-*, --danger, --success, --warning, --info, --editor-placeholder",
          properties: {
            "--bg": { type: "string", description: "Background color" },
            "--text": { type: "string", description: "Primary text color" },
            "--panel": { type: "string", description: "Panel background" },
            "--border": { type: "string", description: "Border color" },
            "--muted": { type: "string", description: "Muted text" },
            "--accent": { type: "string", description: "Accent color" },
            "--accent-fg": { type: "string", description: "Accent foreground" },
            "--tab-active": { type: "string", description: "Active tab background" },
            "--task-todo": { type: "string", description: "Todo task color" },
            "--task-progress": { type: "string", description: "In-progress task color" },
            "--task-urgent": { type: "string", description: "Urgent task color" },
            "--task-question": { type: "string", description: "Question task color" },
            "--task-completed": { type: "string", description: "Completed task color" },
            "--task-cancelled": { type: "string", description: "Cancelled task color" },
            "--task-delegated": { type: "string", description: "Delegated task color" },
            "--danger": { type: "string", description: "Danger/error color" },
            "--success": { type: "string", description: "Success color" },
            "--warning": { type: "string", description: "Warning color" },
            "--info": { type: "string", description: "Info color" },
            "--editor-placeholder": { type: "string", description: "Editor placeholder color" }
          },
          required: ["--bg", "--text", "--panel", "--border", "--muted", "--accent", "--accent-fg"]
        }
      },
      required: ["name", "tokens"]
    }
  },
  {
    name: "update_theme",
    description: "Update an existing theme's tokens (partial updates allowed)",
    inputSchema: {
      type: "object",
      properties: {
        themeId: {
          type: "string",
          description: "Theme ID to update"
        },
        tokens: {
          type: "object",
          description: "Token values to update (only changed tokens needed)"
        }
      },
      required: ["themeId", "tokens"]
    }
  },
  {
    name: "delete_theme",
    description: "Delete a custom theme (cannot delete built-in themes)",
    inputSchema: {
      type: "object",
      properties: {
        themeId: {
          type: "string",
          description: "Theme ID to delete"
        }
      },
      required: ["themeId"]
    }
  },
  {
    name: "apply_theme",
    description: "Apply a theme to the application",
    inputSchema: {
      type: "object",
      properties: {
        themeId: {
          type: "string",
          description: "Theme ID to apply"
        }
      },
      required: ["themeId"]
    }
  },
  {
    name: "get_current_theme",
    description: "Get the currently active theme",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "export_theme",
    description: "Export a theme to a JSON file",
    inputSchema: {
      type: "object",
      properties: {
        themeId: {
          type: "string",
          description: "Theme ID to export"
        },
        exportPath: {
          type: "string",
          description: "Full path where to save the theme file"
        }
      },
      required: ["themeId", "exportPath"]
    }
  },
  {
    name: "import_theme",
    description: "Import a theme from a JSON file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to theme JSON file"
        },
        overwrite: {
          type: "boolean",
          description: "Overwrite existing theme if it exists",
          default: false
        }
      },
      required: ["filePath"]
    }
  }
];

/**
 * Handle MCP tool execution
 */
export async function handleThemeTool(toolName, args) {
  switch (toolName) {
    case "list_themes":
      return await listThemes();

    case "get_theme":
      return await getTheme(args.themeId);

    case "create_theme":
      return await createTheme(args.name, args.tokens);

    case "update_theme":
      return await updateTheme(args.themeId, args.tokens);

    case "delete_theme":
      return await deleteTheme(args.themeId);

    case "apply_theme":
      return await applyTheme(args.themeId);

    case "get_current_theme":
      return await getCurrentTheme();

    case "export_theme":
      return await exportTheme(args.themeId, args.exportPath);

    case "import_theme":
      return await importTheme(args.filePath, args.overwrite);

    default:
      throw new Error(`Unknown theme tool: ${toolName}`);
  }
}
