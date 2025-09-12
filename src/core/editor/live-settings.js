// Real-time editor settings that apply immediately
class LiveEditorSettings {
  constructor() {
    this.settings = {
      fontFamily: 'ui-sans-serif',
      fontSize: 16,
      lineHeight: 1.7,
      letterSpacing: 0.003,
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
    };
    
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
    this.settings[key] = value;
    this.updateCSSVariables();
    
    // Notify listeners
    this.listeners.forEach(callback => {
      try {
        callback(key, value, this.settings);
      } catch (e) {
        console.warn('Error in settings listener:', e);
      }
    });
  }
  
  getSetting(key) {
    return this.settings[key];
  }
  
  getAllSettings() {
    return { ...this.settings };
  }
  
  onSettingsChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

// Create global instance
const liveEditorSettings = new LiveEditorSettings();

export default liveEditorSettings;