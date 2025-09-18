// Real-time editor settings that apply immediately
class LiveEditorSettings {
  constructor() {
    this.defaultSettings = {
      fontSize: 16,
      fontFamily: 'ui-sans-serif',
      lineHeight: 1.7,
      letterSpacing: 0.003,
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
      headingColor: 'inherit',
      linkColor: 'rgb(var(--accent))',
      codeBlockTheme: 'default'
    };
    
    this.settings = { ...this.defaultSettings };
    this.listeners = new Set();
    this.init();
  }
  
  init() {
    // Apply initial styles to document root
    this.updateCSSVariables();
  }
  
  updateCSSVariables() {
    const root = document.documentElement;
    root.style.setProperty('--editor-font-family', this.settings.fontFamily);
    root.style.setProperty('--editor-font-size', this.settings.fontSize + 'px');
    root.style.setProperty('--editor-line-height', this.settings.lineHeight);
    root.style.setProperty('--editor-letter-spacing', this.settings.letterSpacing + 'em');
    root.style.setProperty('--editor-h1-size', this.settings.h1Size + 'em');
    root.style.setProperty('--editor-h2-size', this.settings.h2Size + 'em');
    root.style.setProperty('--editor-h3-size', this.settings.h3Size + 'em');
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
      } catch (e) {
      }
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
      } catch (e) {
      }
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
      } catch (e) {
      }
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