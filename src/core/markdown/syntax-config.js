// Markdown Syntax Configuration System
// Manages all markdown syntax characters and behaviors

class MarkdownSyntaxConfig {
  constructor() {
    this.defaultConfig = {
      // Headers
      heading: {
        marker: '#',
        altMarker: '^',
        altEnabled: false,
        requireSpace: true,
        maxLevel: 6
      },

      // Emphasis
      bold: {
        marker: '**',
        altMarker: '__',
        allowAlt: true
      },
      italic: {
        marker: '*',
        altMarker: '_',
        allowAlt: true
      },
      strikethrough: {
        marker: '~~',
        enabled: true
      },
      highlight: {
        marker: '==',
        enabled: true
      },

      // Code
      inlineCode: {
        marker: '`',
        enabled: true
      },
      codeBlock: {
        marker: '```',
        altMarker: '~~~',
        allowAlt: true,
        languageSupport: true
      },

      // Lists
      bulletList: {
        markers: ['*', '-', '+'],
        defaultMarker: '-',
        requireSpace: true
      },
      orderedList: {
        marker: '.',
        altMarker: ')',
        allowAlt: false,
        requireSpace: true
      },
      taskList: {
        incomplete: '[ ]',
        complete: '[x]',
        partialComplete: '[/]',
        enabled: true
      },

      // Quotes and Dividers
      blockquote: {
        marker: '>',
        requireSpace: true,
        nestable: true
      },
      horizontalRule: {
        markers: ['---', '***', '___'],
        minLength: 3
      },

      // Links and Images
      link: {
        wikiLink: {
          open: '[[',
          close: ']]',
          enabled: true
        },
        markdown: {
          enabled: true
        },
        autoLink: {
          enabled: true,
          detectUrls: true
        }
      },
      image: {
        marker: '!',
        enabled: true,
        wikiStyle: true
      },

      // Tables
      table: {
        columnSeparator: '|',
        alignMarkers: {
          left: ':--',
          center: ':-:',
          right: '--:'
        },
        enabled: true
      },

      // Math
      math: {
        inline: {
          open: '$',
          close: '$',
          enabled: true
        },
        block: {
          open: '$$',
          close: '$$',
          enabled: true
        }
      },

      // Comments
      comments: {
        marker: '%%',
        enabled: false
      },

      // Footnotes
      footnote: {
        marker: '[^',
        close: ']',
        enabled: false
      },

      // Behavior Settings
      behavior: {
        autoCloseBrackets: true,
        smartQuotes: false,
        autoIndent: true,
        preserveWhitespace: false,
        escapeCharacter: '\\'
      }
    };

    this.config = { ...this.defaultConfig };
    this.listeners = new Set();
  }

  async init() {
    try {
      // Try to load from workspace-specific config first
      const workspaceConfig = await this.loadWorkspaceConfig();
      if (workspaceConfig) {
        this.config = this.mergeConfig(this.defaultConfig, workspaceConfig);
        console.log('[MarkdownSyntax] Loaded workspace config:', this.config);

        // Notify listeners that config has been loaded (triggers editor reload)
        if (typeof window !== 'undefined') {
          console.log('[MarkdownSyntax] Dispatching config-loaded event to trigger editor reload');
          window.dispatchEvent(new CustomEvent('markdown-config-changed', {
            detail: { category: 'init', key: 'loaded', value: this.config }
          }));
        }
        return;
      }

      // If no workspace config exists, create one with defaults
      console.log('[MarkdownSyntax] No workspace config found, initializing with defaults');
      const saved = await this.saveWorkspaceConfig();
      if (saved) {
        console.log('[MarkdownSyntax] ✅ Initialized markdown-syntax.json with defaults');
      }

      // Also check global config as fallback
      const { readConfig } = await import("../config/store.js");
      const globalConfig = await readConfig();

      if (globalConfig && globalConfig.markdownSyntax) {
        this.config = this.mergeConfig(this.defaultConfig, globalConfig.markdownSyntax);
        console.log('[MarkdownSyntax] Merged with global config');
      }
    } catch (e) {
      console.log('[MarkdownSyntax] Error loading config:', e);
    }
  }

  async loadWorkspaceConfig() {
    try {
      const { getSavedWorkspacePath } = await import("../vault/vault.js");
      const { join } = await import("@tauri-apps/api/path");
      const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");

      // Try to get workspace from window variable first (set by Workspace component)
      const workspacePath = (typeof window !== 'undefined' && window.__LOKUS_WORKSPACE_PATH__) || getSavedWorkspacePath();

      console.log('[MarkdownSyntax] Loading from workspace:', workspacePath);
      console.log('[MarkdownSyntax] Window workspace:', typeof window !== 'undefined' ? window.__LOKUS_WORKSPACE_PATH__ : 'N/A');
      console.log('[MarkdownSyntax] LocalStorage workspace:', getSavedWorkspacePath());

      if (!workspacePath) return null;

      const configPath = await join(workspacePath, '.lokus', 'markdown-syntax.json');
      if (!(await exists(configPath))) {
        console.log('[MarkdownSyntax] Config file does not exist at:', configPath);
        return null;
      }

      const content = await readTextFile(configPath);
      return JSON.parse(content);
    } catch (e) {
      console.log('[MarkdownSyntax] Error loading workspace config:', e);
      return null;
    }
  }

  async saveWorkspaceConfig() {
    try {
      const { getSavedWorkspacePath } = await import("../vault/vault.js");
      const { join } = await import("@tauri-apps/api/path");
      const { writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

      // Try to get workspace from window variable first (set by Workspace component)
      let workspacePath = (typeof window !== 'undefined' && window.__LOKUS_WORKSPACE_PATH__) || getSavedWorkspacePath();

      console.log('[MarkdownSyntax] Saving to workspace:', workspacePath);
      console.log('[MarkdownSyntax] Window workspace:', typeof window !== 'undefined' ? window.__LOKUS_WORKSPACE_PATH__ : 'N/A');
      console.log('[MarkdownSyntax] LocalStorage workspace:', getSavedWorkspacePath());

      if (!workspacePath) {
        console.log('[MarkdownSyntax] No workspace path, cannot save');
        return false;
      }

      const lokusDir = await join(workspacePath, '.lokus');
      if (!(await exists(lokusDir))) {
        await mkdir(lokusDir, { recursive: true });
      }

      const configPath = await join(workspacePath, '.lokus', 'markdown-syntax.json');
      await writeTextFile(configPath, JSON.stringify(this.config, null, 2));
      console.log('[MarkdownSyntax] ✅ Successfully saved to:', configPath);
      return true;
    } catch (e) {
      console.error('[MarkdownSyntax] Error saving workspace config:', e);
      return false;
    }
  }

  mergeConfig(defaults, saved) {
    const merged = { ...defaults };

    for (const key in saved) {
      if (typeof saved[key] === 'object' && !Array.isArray(saved[key])) {
        merged[key] = { ...defaults[key], ...saved[key] };
      } else {
        merged[key] = saved[key];
      }
    }

    return merged;
  }

  get(category, key) {
    if (key) {
      return this.config[category]?.[key];
    }
    return this.config[category];
  }

  set(category, key, value) {
    if (!this.config[category]) {
      this.config[category] = {};
    }

    if (typeof key === 'object') {
      // Setting entire category
      this.config[category] = { ...this.config[category], ...key };
    } else {
      // Setting specific key
      this.config[category][key] = value;
    }

    console.log('[MarkdownSyntax] Setting changed:', { category, key, value });

    this.notifyListeners(category, key, value);

    // Auto-save after each change for immediate persistence
    this.save().then(success => {
      if (success) {
        console.log('[MarkdownSyntax] Auto-saved after change');
      }
    }).catch(e => {
      console.error('[MarkdownSyntax] Auto-save failed:', e);
    });
  }

  getAll() {
    return { ...this.config };
  }

  reset() {
    this.config = { ...this.defaultConfig };
    this.notifyListeners('reset', null, this.config);
  }

  async save() {
    try {
      console.log('[MarkdownSyntax] Saving config:', this.config);
      const success = await this.saveWorkspaceConfig();
      if (success) {
        console.log('[MarkdownSyntax] Config saved successfully to workspace');
      }
      return success;
    } catch (e) {
      console.error('Failed to save markdown syntax config:', e);
      return false;
    }
  }

  // Export current config as JSON
  export() {
    return JSON.stringify(this.config, null, 2);
  }

  // Import config from JSON
  import(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.config = this.mergeConfig(this.defaultConfig, imported);
      this.notifyListeners('import', null, this.config);
      return true;
    } catch (e) {
      console.error('Failed to import config:', e);
      return false;
    }
  }

  // Listen for changes
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(category, key, value) {
    console.log('[MarkdownSyntax] Notifying listeners of change:', { category, key, value });
    this.listeners.forEach(callback => {
      try {
        callback(category, key, value);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }

  // Validation helpers
  isValidMarker(marker) {
    return typeof marker === 'string' && marker.length > 0;
  }

  // Get regex patterns for syntax
  getPattern(category) {
    const config = this.config[category];
    if (!config) return null;

    switch (category) {
      case 'heading':
        return new RegExp(`^${this.escapeRegex(config.marker)}{1,${config.maxLevel}}${config.requireSpace ? ' ' : ''}`);
      case 'bold':
        return new RegExp(`${this.escapeRegex(config.marker)}(.+?)${this.escapeRegex(config.marker)}`, 'g');
      case 'italic':
        return new RegExp(`${this.escapeRegex(config.marker)}(.+?)${this.escapeRegex(config.marker)}`, 'g');
      default:
        return null;
    }
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Create singleton instance
const markdownSyntaxConfig = new MarkdownSyntaxConfig();

export default markdownSyntaxConfig;
