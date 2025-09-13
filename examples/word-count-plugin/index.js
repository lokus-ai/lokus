/**
 * Word Count Plugin for Lokus
 * 
 * This plugin demonstrates:
 * - Extending BasePlugin for proper plugin architecture
 * - Real-time document analysis using editor events
 * - UI panel registration and management
 * - Plugin settings and configuration
 * - Text processing utilities and debounced updates
 * - Error handling and user feedback
 */

import { BasePlugin } from '../../src/plugins/core/BasePlugin.js';

export default class WordCountPlugin extends BasePlugin {
  constructor() {
    super();
    this.stats = {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      readingTime: 0,
      paragraphs: 0,
      sentences: 0
    };
    this.panelId = null;
    this.debouncedUpdate = null;
  }

  /**
   * Plugin activation - called when plugin is loaded
   */
  async activate() {
    await super.activate();
    
    try {
      // Setup debounced update function
      this.debouncedUpdate = this.debounce(() => {
        this.updateWordCount();
      }, 300);

      // Register UI panel
      await this.setupUI();
      
      // Register commands
      this.registerCommands();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initial word count
      this.updateWordCount();
      
      this.showNotification('Word Count plugin activated', 'info');
      
    } catch (error) {
      this.logger.error('Failed to activate Word Count plugin:', error);
      this.showNotification('Failed to activate Word Count plugin', 'error');
      throw error;
    }
  }

  /**
   * Plugin deactivation - cleanup resources
   */
  async deactivate() {
    try {
      // Remove styles
      this.removeStyles();
      
      await super.deactivate();
      
    } catch (error) {
      this.logger.error('Error during deactivation:', error);
    }
  }

  /**
   * Setup UI components and panels
   */
  async setupUI() {
    // Register a sidebar panel
    this.panelId = this.registerPanel({
      name: 'word-count',
      title: 'Word Count',
      position: 'sidebar',
      content: this.createPanelContent(),
      icon: '📊'
    });
    
    // Inject CSS styles
    this.injectStyles();
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    // Command to toggle sidebar
    this.registerCommand({
      name: 'toggle-sidebar',
      description: 'Toggle Word Count Sidebar',
      action: () => {
        this.api.emit('panel_toggle', { panelId: this.panelId });
      }
    });

    // Command to copy stats
    this.registerCommand({
      name: 'copy-stats',
      description: 'Copy Word Count Statistics',
      action: () => {
        this.copyStatsToClipboard();
      }
    });
  }

  /**
   * Setup event listeners for editor changes
   */
  setupEventListeners() {
    // Listen for content changes
    this.addEventListener('editor:content-change', this.debouncedUpdate);
    
    // Listen for selection changes
    this.addEventListener('editor:selection-change', () => {
      this.updateSelectionCount();
    });

    // Listen for settings changes
    this.addEventListener('settings:changed', () => {
      this.updateWordCount();
    });
  }

  /**
   * Update word count statistics
   */
  updateWordCount() {
    try {
      const content = this.getEditorContent();
      if (!content) {
        this.resetStats();
        return;
      }

      const textContent = this.extractTextContent(content);
      this.stats = this.calculateStats(textContent);
      
      // Update UI
      this.updatePanelContent();
      
      this.logger.info('Word count updated:', this.stats);
      
    } catch (error) {
      this.logger.error('Error updating word count:', error);
    }
  }

  /**
   * Update count for selected text only
   */
  updateSelectionCount() {
    try {
      const selection = this.getSelection();
      if (selection && selection.text && selection.text.trim().length > 0) {
        const selectionStats = this.calculateStats(selection.text);
        this.showSelectionTooltip(selectionStats);
      }
    } catch (error) {
      this.logger.error('Error updating selection count:', error);
    }
  }

  /**
   * Extract plain text content from HTML/Markdown
   */
  extractTextContent(content) {
    if (!content) return '';

    // Create a temporary element to strip HTML
    const temp = document.createElement('div');
    temp.innerHTML = content;
    
    // Remove code blocks if setting is enabled
    const excludeCodeBlocks = this.getSetting('excludeCodeBlocks', false);
    if (excludeCodeBlocks) {
      const codeBlocks = temp.querySelectorAll('pre, code');
      codeBlocks.forEach(block => block.remove());
    }
    
    // Get text content and normalize whitespace
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Calculate comprehensive text statistics
   */
  calculateStats(text) {
    if (!text || typeof text !== 'string') {
      return {
        words: 0,
        characters: 0,
        charactersNoSpaces: 0,
        readingTime: 0,
        paragraphs: 0,
        sentences: 0
      };
    }

    // Clean and normalize text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Word count (split by whitespace, filter empty strings)
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Character counts
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;

    // Reading time (words per minute from settings)
    const wpm = this.getSetting('wordsPerMinute', 200);
    const readingTime = Math.ceil(wordCount / wpm);

    // Paragraph count (split by double line breaks)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

    // Sentence count (approximate - split by sentence-ending punctuation)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    return {
      words: wordCount,
      characters,
      charactersNoSpaces,
      readingTime,
      paragraphs: Math.max(1, paragraphs), // At least 1 paragraph if there's content
      sentences: Math.max(1, sentences)    // At least 1 sentence if there's content
    };
  }

  /**
   * Create panel content HTML
   */
  createPanelContent() {
    return `
      <div class="word-count-panel">
        <div class="word-count-stats">
          <div class="stat-item">
            <span class="stat-label">Words:</span>
            <span class="stat-value" id="wc-words">${this.stats.words}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Characters:</span>
            <span class="stat-value" id="wc-chars">${this.stats.characters}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Chars (no spaces):</span>
            <span class="stat-value" id="wc-chars-no-spaces">${this.stats.charactersNoSpaces}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Reading time:</span>
            <span class="stat-value" id="wc-reading-time">${this.formatReadingTime(this.stats.readingTime)}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Paragraphs:</span>
            <span class="stat-value" id="wc-paragraphs">${this.stats.paragraphs}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Sentences:</span>
            <span class="stat-value" id="wc-sentences">${this.stats.sentences}</span>
          </div>
        </div>
        
        <div class="word-count-actions">
          <button class="btn-secondary" id="wc-copy-stats">Copy Stats</button>
          <button class="btn-secondary" id="wc-refresh">Refresh</button>
        </div>
      </div>
    `;
  }

  /**
   * Update panel content with current statistics
   */
  updatePanelContent() {
    if (!this.panelId) return;

    // Update individual stat values
    const updates = {
      'wc-words': this.stats.words,
      'wc-chars': this.stats.characters,
      'wc-chars-no-spaces': this.stats.charactersNoSpaces,
      'wc-reading-time': this.formatReadingTime(this.stats.readingTime),
      'wc-paragraphs': this.stats.paragraphs,
      'wc-sentences': this.stats.sentences
    };

    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    // Setup button event listeners (re-attach after updates)
    this.setupButtonListeners();
  }

  /**
   * Setup event listeners for panel buttons
   */
  setupButtonListeners() {
    const copyBtn = document.getElementById('wc-copy-stats');
    if (copyBtn) {
      copyBtn.onclick = () => this.copyStatsToClipboard();
    }

    const refreshBtn = document.getElementById('wc-refresh');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.updateWordCount();
    }
  }

  /**
   * Show selection-specific statistics in a tooltip
   */
  showSelectionTooltip(stats) {
    this.showNotification(
      `Selection: ${stats.words} words, ${stats.characters} characters`,
      'info',
      2000
    );
  }

  /**
   * Format reading time in a human-readable format
   */
  formatReadingTime(minutes) {
    if (minutes < 1) return 'less than 1 min';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} mins`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 1) {
      return remainingMinutes > 0 ? `1h ${remainingMinutes}m` : '1 hour';
    }
    
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hours`;
  }

  /**
   * Copy statistics to clipboard
   */
  async copyStatsToClipboard() {
    const statsText = `
Document Statistics:
- Words: ${this.stats.words}
- Characters: ${this.stats.characters}
- Characters (no spaces): ${this.stats.charactersNoSpaces}
- Reading time: ${this.formatReadingTime(this.stats.readingTime)}
- Paragraphs: ${this.stats.paragraphs}
- Sentences: ${this.stats.sentences}
`.trim();

    try {
      await navigator.clipboard.writeText(statsText);
      this.showNotification('Statistics copied to clipboard', 'success');
    } catch (error) {
      this.logger.error('Failed to copy stats:', error);
      this.showNotification('Failed to copy statistics', 'error');
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      readingTime: 0,
      paragraphs: 0,
      sentences: 0
    };
    this.updatePanelContent();
  }

  /**
   * Inject CSS styles for the plugin UI
   */
  injectStyles() {
    const styles = `
      .word-count-panel {
        padding: 16px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .word-count-stats {
        margin-bottom: 16px;
      }
      
      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }
      
      .stat-item:last-child {
        border-bottom: none;
      }
      
      .stat-label {
        font-size: 14px;
        color: var(--text-muted, #6b7280);
        font-weight: 500;
      }
      
      .stat-value {
        font-size: 14px;
        color: var(--text-primary, #111827);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      
      .word-count-actions {
        display: flex;
        gap: 8px;
      }
      
      .btn-secondary {
        flex: 1;
        padding: 8px 12px;
        font-size: 12px;
        background: var(--bg-secondary, #f3f4f6);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      
      .btn-secondary:hover {
        background: var(--bg-hover, #e5e7eb);
      }
      
      @media (prefers-color-scheme: dark) {
        .stat-label {
          color: var(--text-muted, #9ca3af);
        }
        
        .stat-value {
          color: var(--text-primary, #f9fafb);
        }
        
        .btn-secondary {
          background: var(--bg-secondary, #374151);
          border-color: var(--border-color, #4b5563);
          color: var(--text-primary, #f9fafb);
        }
        
        .btn-secondary:hover {
          background: var(--bg-hover, #4b5563);
        }
      }
    `;
    
    this.addDisposable(() => this.removeStyles());
    
    if (!document.getElementById('word-count-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'word-count-styles';
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  }

  /**
   * Remove injected styles
   */
  removeStyles() {
    const styleSheet = document.getElementById('word-count-styles');
    if (styleSheet) {
      styleSheet.remove();
    }
  }

  /**
   * Get plugin setting value
   */
  async getSetting(key, defaultValue) {
    try {
      return await super.getSetting(key, defaultValue);
    } catch (error) {
      this.logger.warn(`Failed to get setting ${key}, using default:`, defaultValue);
      return defaultValue;
    }
  }
}