/**
 * Editor Config Cache - Performance Optimization
 * Loads editor configuration ONCE on app startup and caches it in memory
 * Eliminates the "Loading editor..." delay on every file open
 */

class EditorConfigCache {
  constructor() {
    this.config = null;
    this.loading = true;
  }

  /**
   * Initialize config cache - call once on app startup
   */
  async init() {
    try {
      const { readConfig } = await import('../config/store.js');
      const cfg = await readConfig() || {};
      this.config = this.mergeDefaults(cfg);
    } catch (e) {
      this.config = this.getDefaults();
    }
    this.loading = false;
  }

  /**
   * Get cached config (returns defaults if not yet loaded)
   */
  get() {
    return this.config || this.getDefaults();
  }

  /**
   * Check if config is still loading
   */
  isLoading() {
    return this.loading;
  }

  /**
   * Get default editor settings
   */
  getDefaults() {
    return {
      font: {
        family: 'ui-sans-serif',
        size: 16,
        lineHeight: 1.7,
        letterSpacing: 0.003
      },
      typography: {
        h1Size: 2.0,
        h2Size: 1.6,
        h3Size: 1.3,
        headingColor: 'inherit',
        codeBlockTheme: 'default',
        linkColor: 'rgb(var(--accent))'
      },
      behavior: {
        autoPairBrackets: true,
        smartQuotes: false,
        autoIndent: true,
        wordWrap: true,
        showLineNumbers: false
      },
      appearance: {
        showMarkdown: false,
        focusMode: false,
        typewriterMode: false
      }
    };
  }

  /**
   * Merge user config with defaults
   */
  mergeDefaults(cfg) {
    const defaults = this.getDefaults();
    const editorConfig = cfg.editor || {};

    return {
      font: { ...defaults.font, ...editorConfig.font },
      typography: { ...defaults.typography, ...editorConfig.typography },
      behavior: { ...defaults.behavior, ...editorConfig.behavior },
      appearance: { ...defaults.appearance, ...editorConfig.appearance }
    };
  }

  /**
   * Invalidate cache and reload config
   */
  async reload() {
    this.loading = true;
    await this.init();
  }
}

// Export singleton instance
const editorConfigCache = new EditorConfigCache();
export default editorConfigCache;
