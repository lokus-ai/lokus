// Real-time editor settings that apply immediately
class LiveEditorSettings {
  constructor() {
    this.defaultSettings = {
      // Font & Typography
      fontSize: 16,
      fontFamily: 'ui-sans-serif',
      lineHeight: 1.7,
      letterSpacing: 0.003,
      fontWeight: 400,
      boldWeight: 700,
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
      h1Weight: 700,
      h2Weight: 600,
      h3Weight: 600,

      // Colors
      textColor: '#inherit',
      headingColor: '#inherit',
      linkColor: '#inherit',
      linkHoverColor: '#inherit',
      codeColor: '#inherit',
      codeBackground: '#f5f5f5',
      blockquoteColor: '#inherit',
      blockquoteBorder: '#e5e5e5',

      // Spacing
      paragraphSpacing: 1,
      listSpacing: 0.25,
      indentSize: 2,
      headingMarginTop: 1.5,
      headingMarginBottom: 0.5,
      blockMargin: 1.5,

      // List Symbols
      bulletStyle: '•',
      numberedStyle: '1.',
      checkboxStyle: '☑',
      listIndent: 2,

      // Highlights
      highlightColor: '#fff3cd',
      highlightTextColor: '#inherit',

      // Code Blocks
      codeBlockBg: '#f8f9fa',
      codeBlockBorder: '#e9ecef',
      codeBlockBorderWidth: 1,
      codeBlockBorderRadius: 8,
      codeBlockPadding: 16,
      codeBlockFont: 'ui-monospace',
      codeBlockFontSize: 14,
      codeBlockLineHeight: 1.5,

      // Links
      linkUnderline: 'hover',
      linkUnderlineThickness: 1,
      linkUnderlineOffset: 2,

      // Text Decorations
      strikethroughColor: '#6c757d',
      strikethroughThickness: 2,
      underlineColor: '#inherit',
      underlineThickness: 1,

      // Bold & Italic
      boldColor: '#inherit',
      italicColor: '#inherit',

      // Blockquotes
      blockquoteBorderWidth: 4,
      blockquotePadding: 16,
      blockquoteStyle: 'solid',

      // Tables
      tableBorder: '#dee2e6',
      tableBorderWidth: 1,
      tableHeaderBg: null, // null = use theme default (CSS fallback to --panel-secondary)
      tableCellPadding: 12,

      // Selection
      selectionColor: 'rgba(99, 102, 241, 0.2)'
    };
    
    this.settings = { ...this.defaultSettings };
    this.listeners = new Set();
    this.init();
  }
  
  async init() {
    // Load saved settings from config
    try {
      const { readConfig } = await import("../config/store.js");
      const config = await readConfig();

      if (config && config.editorSettings) {
        // Merge saved settings with defaults

        // Migration: Remove old tableHeaderBg light theme default (#f8f9fa)
        // Let it use the theme's default color instead
        if (config.editorSettings.tableHeaderBg === '#f8f9fa') {
          delete config.editorSettings.tableHeaderBg;
        }

        this.settings = { ...this.defaultSettings, ...config.editorSettings };
      }
    } catch { }

    // Apply initial styles to document root
    this.updateCSSVariables();
  }
  
  updateCSSVariables() {
    const root = document.documentElement;

    // Font & Typography
    root.style.setProperty('--editor-font-family', this.settings.fontFamily);
    root.style.setProperty('--editor-font-size', this.settings.fontSize + 'px');
    root.style.setProperty('--editor-line-height', this.settings.lineHeight);
    root.style.setProperty('--editor-letter-spacing', this.settings.letterSpacing + 'em');
    root.style.setProperty('--editor-font-weight', this.settings.fontWeight);
    root.style.setProperty('--editor-bold-weight', this.settings.boldWeight);
    root.style.setProperty('--editor-h1-size', this.settings.h1Size + 'em');
    root.style.setProperty('--editor-h2-size', this.settings.h2Size + 'em');
    root.style.setProperty('--editor-h3-size', this.settings.h3Size + 'em');
    root.style.setProperty('--editor-h1-weight', this.settings.h1Weight);
    root.style.setProperty('--editor-h2-weight', this.settings.h2Weight);
    root.style.setProperty('--editor-h3-weight', this.settings.h3Weight);

    // Colors
    root.style.setProperty('--editor-text-color', this.settings.textColor);
    root.style.setProperty('--editor-heading-color', this.settings.headingColor);
    root.style.setProperty('--editor-link-color', this.settings.linkColor);
    root.style.setProperty('--editor-link-hover-color', this.settings.linkHoverColor);
    root.style.setProperty('--editor-code-color', this.settings.codeColor);
    root.style.setProperty('--editor-code-background', this.settings.codeBackground);
    root.style.setProperty('--editor-blockquote-color', this.settings.blockquoteColor);
    root.style.setProperty('--editor-blockquote-border', this.settings.blockquoteBorder);
    root.style.setProperty('--editor-bold-color', this.settings.boldColor);
    root.style.setProperty('--editor-italic-color', this.settings.italicColor);

    // Spacing
    root.style.setProperty('--editor-paragraph-spacing', this.settings.paragraphSpacing + 'rem');
    root.style.setProperty('--editor-list-spacing', this.settings.listSpacing + 'rem');
    root.style.setProperty('--editor-indent-size', this.settings.indentSize + 'rem');
    root.style.setProperty('--editor-heading-margin-top', this.settings.headingMarginTop + 'rem');
    root.style.setProperty('--editor-heading-margin-bottom', this.settings.headingMarginBottom + 'rem');
    root.style.setProperty('--editor-block-margin', this.settings.blockMargin + 'rem');
    root.style.setProperty('--editor-list-indent', this.settings.listIndent + 'rem');

    // List Symbols
    root.style.setProperty('--editor-bullet-style', `'${this.settings.bulletStyle}'`);
    root.style.setProperty('--editor-numbered-style', this.settings.numberedStyle);
    root.style.setProperty('--editor-checkbox-style', `'${this.settings.checkboxStyle}'`);

    // Highlights
    root.style.setProperty('--editor-highlight-color', this.settings.highlightColor);
    root.style.setProperty('--editor-highlight-text-color', this.settings.highlightTextColor);

    // Code Blocks
    root.style.setProperty('--editor-code-block-bg', this.settings.codeBlockBg);
    root.style.setProperty('--editor-code-block-border', this.settings.codeBlockBorder);
    root.style.setProperty('--editor-code-block-border-width', this.settings.codeBlockBorderWidth + 'px');
    root.style.setProperty('--editor-code-block-border-radius', this.settings.codeBlockBorderRadius + 'px');
    root.style.setProperty('--editor-code-block-padding', this.settings.codeBlockPadding + 'px');
    root.style.setProperty('--editor-code-block-font', this.settings.codeBlockFont);
    root.style.setProperty('--editor-code-block-font-size', this.settings.codeBlockFontSize + 'px');
    root.style.setProperty('--editor-code-block-line-height', this.settings.codeBlockLineHeight);

    // Links
    root.style.setProperty('--editor-link-underline', this.settings.linkUnderline);
    root.style.setProperty('--editor-link-underline-thickness', this.settings.linkUnderlineThickness + 'px');
    root.style.setProperty('--editor-link-underline-offset', this.settings.linkUnderlineOffset + 'px');

    // Text Decorations
    root.style.setProperty('--editor-strikethrough-color', this.settings.strikethroughColor);
    root.style.setProperty('--editor-strikethrough-thickness', this.settings.strikethroughThickness + 'px');
    root.style.setProperty('--editor-underline-color', this.settings.underlineColor);
    root.style.setProperty('--editor-underline-thickness', this.settings.underlineThickness + 'px');

    // Blockquotes
    root.style.setProperty('--editor-blockquote-border-width', this.settings.blockquoteBorderWidth + 'px');
    root.style.setProperty('--editor-blockquote-padding', this.settings.blockquotePadding + 'px');
    root.style.setProperty('--editor-blockquote-style', this.settings.blockquoteStyle);

    // Tables
    root.style.setProperty('--editor-table-border', this.settings.tableBorder);
    root.style.setProperty('--editor-table-border-width', this.settings.tableBorderWidth + 'px');
    // Only set header bg if customized (null = use CSS fallback to theme)
    if (this.settings.tableHeaderBg) {
      root.style.setProperty('--editor-table-header-bg', this.settings.tableHeaderBg);
    } else {
      root.style.removeProperty('--editor-table-header-bg');
    }
    root.style.setProperty('--editor-table-cell-padding', this.settings.tableCellPadding + 'px');

    // Selection
    root.style.setProperty('--editor-selection-color', this.settings.selectionColor);
  }
  
  updateSetting(key, value) {
    // Only update valid settings keys
    if (!(key in this.defaultSettings)) {
      return;
    }
    this.settings[key] = value;
    this.updateCSSVariables();
    
    // Notify listeners
    this.listeners.forEach(callback => {
      try {
        callback(key, value, this.settings);
      } catch { }
    });
  }

  setSetting(key, value) {
    this.updateSetting(key, value);
  }

  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    this.updateCSSVariables();
    
    // Notify listeners for each changed setting
    this.listeners.forEach(callback => {
      try {
        Object.keys(newSettings).forEach(key => {
          callback(key, newSettings[key], this.settings);
        });
      } catch { }
    });
  }
  
  getSetting(key) {
    return this.settings[key];
  }
  
  getAllSettings() {
    return { ...this.settings };
  }

  applyCSSVariables() {
    this.updateCSSVariables();
  }

  reset() {
    this.settings = { ...this.defaultSettings };
    this.updateCSSVariables();
    
    // Notify listeners of reset
    this.listeners.forEach(callback => {
      try {
        callback('reset', this.settings, this.settings);
      } catch { }
    });
  }
  
  onSettingsChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

// Create global instance
const liveEditorSettings = new LiveEditorSettings();

export default liveEditorSettings;