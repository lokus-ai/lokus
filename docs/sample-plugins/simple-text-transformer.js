/**
 * Simple Text Transformer Plugin
 * 
 * A beginner-friendly plugin demonstrating:
 * - Basic plugin structure and lifecycle
 * - Editor content manipulation
 * - Slash command registration
 * - Simple UI notifications
 * - Text processing utilities
 * 
 * This plugin adds commands to transform selected text or the entire document
 * with common text operations like case changes and formatting.
 */

import { BasePlugin } from '@lokus/plugin-base';

export default class SimpleTextTransformer extends BasePlugin {
  /**
   * Plugin activation - called when the plugin is loaded
   */
  async activate() {
    // Always call super.activate() first
    await super.activate();
    
    this.logger.info('Text Transformer plugin activated');
    
    // Register all our text transformation commands
    this.registerTextCommands();
    
    // Show a welcome notification
    this.showNotification('Text Transformer plugin ready! Use slash commands to transform text.', 'info');
  }

  /**
   * Register all text transformation slash commands
   */
  registerTextCommands() {
    // Uppercase transformation
    this.registerCommand({
      name: 'uppercase',
      description: 'Convert text to UPPERCASE',
      icon: '🔠',
      action: () => this.transformText('uppercase')
    });

    // Lowercase transformation
    this.registerCommand({
      name: 'lowercase',
      description: 'Convert text to lowercase',
      icon: '🔡',
      action: () => this.transformText('lowercase')
    });

    // Title case transformation
    this.registerCommand({
      name: 'titlecase',
      description: 'Convert text to Title Case',
      icon: '🔤',
      action: () => this.transformText('titlecase')
    });

    // Sentence case transformation
    this.registerCommand({
      name: 'sentencecase',
      description: 'Convert text to Sentence case',
      icon: '📝',
      action: () => this.transformText('sentencecase')
    });

    // Reverse text
    this.registerCommand({
      name: 'reverse',
      description: 'Reverse the text',
      icon: '🔄',
      action: () => this.transformText('reverse')
    });

    // Remove extra spaces
    this.registerCommand({
      name: 'cleanup-spaces',
      description: 'Remove extra spaces',
      icon: '🧹',
      action: () => this.transformText('cleanup')
    });

    // Word count command
    this.registerCommand({
      name: 'word-count',
      description: 'Show word count',
      icon: '📊',
      action: () => this.showWordCount()
    });
  }

  /**
   * Main text transformation function
   * @param {string} transformType - Type of transformation to apply
   */
  transformText(transformType) {
    try {
      // Get current selection
      const selection = this.getSelection();
      
      let textToTransform;
      let isSelection = false;

      // Determine what text to transform
      if (selection && !selection.empty && selection.text.trim()) {
        // Use selected text
        textToTransform = selection.text;
        isSelection = true;
      } else {
        // Use entire document content (convert HTML to plain text)
        const content = this.getEditorContent();
        textToTransform = this.htmlToPlainText(content);
        isSelection = false;
      }

      // Check if we have text to transform
      if (!textToTransform || !textToTransform.trim()) {
        this.showNotification('No text to transform', 'warning');
        return;
      }

      // Apply the transformation
      const transformedText = this.applyTransformation(textToTransform, transformType);

      // Replace the text in the editor
      if (isSelection) {
        // Replace selected text
        this.insertContent(transformedText);
      } else {
        // Replace entire content
        this.setEditorContent(`<p>${this.escapeHtml(transformedText)}</p>`);
      }

      // Show success notification
      const scope = isSelection ? 'selected text' : 'document';
      this.showNotification(`Applied ${transformType} transformation to ${scope}`, 'success');

    } catch (error) {
      this.logger.error('Text transformation failed:', error);
      this.showNotification('Text transformation failed', 'error');
    }
  }

  /**
   * Apply specific transformation to text
   * @param {string} text - Text to transform
   * @param {string} type - Transformation type
   * @returns {string} Transformed text
   */
  applyTransformation(text, type) {
    switch (type) {
      case 'uppercase':
        return text.toUpperCase();

      case 'lowercase':
        return text.toLowerCase();

      case 'titlecase':
        return this.toTitleCase(text);

      case 'sentencecase':
        return this.toSentenceCase(text);

      case 'reverse':
        return text.split('').reverse().join('');

      case 'cleanup':
        return this.cleanupSpaces(text);

      default:
        throw new Error(`Unknown transformation type: ${type}`);
    }
  }

  /**
   * Convert text to Title Case
   * @param {string} text - Input text
   * @returns {string} Title cased text
   */
  toTitleCase(text) {
    // Words that should not be capitalized in title case (except at start/end)
    const minorWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet'];

    return text.toLowerCase().split(' ').map((word, index, array) => {
      // Always capitalize first and last word
      if (index === 0 || index === array.length - 1) {
        return this.capitalizeWord(word);
      }

      // Don't capitalize minor words unless they're at the beginning or end
      if (minorWords.includes(word)) {
        return word;
      }

      return this.capitalizeWord(word);
    }).join(' ');
  }

  /**
   * Convert text to Sentence case
   * @param {string} text - Input text
   * @returns {string} Sentence cased text
   */
  toSentenceCase(text) {
    return text.toLowerCase().replace(/(^\w|[.!?]\s*\w)/g, (match) => {
      return match.toUpperCase();
    });
  }

  /**
   * Capitalize the first letter of a word
   * @param {string} word - Word to capitalize
   * @returns {string} Capitalized word
   */
  capitalizeWord(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  /**
   * Clean up extra spaces in text
   * @param {string} text - Input text
   * @returns {string} Cleaned text
   */
  cleanupSpaces(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/^\s+|\s+$/g, '') // Trim leading/trailing spaces
      .replace(/\s+([.!?])/g, '$1') // Remove spaces before punctuation
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Ensure single space after sentence endings
  }

  /**
   * Convert HTML to plain text
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  htmlToPlainText(html) {
    // Create a temporary element to extract text content
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Get text content and normalize whitespace
    let text = temp.textContent || temp.innerText || '';
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  /**
   * Escape HTML characters in text
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show word count for current document or selection
   */
  showWordCount() {
    try {
      const selection = this.getSelection();
      let text;
      let scope;

      if (selection && !selection.empty && selection.text.trim()) {
        text = selection.text;
        scope = 'selection';
      } else {
        const content = this.getEditorContent();
        text = this.htmlToPlainText(content);
        scope = 'document';
      }

      if (!text || !text.trim()) {
        this.showNotification('No text to count', 'info');
        return;
      }

      // Calculate statistics
      const stats = this.calculateTextStats(text);

      // Show detailed statistics
      const message = `${scope.charAt(0).toUpperCase() + scope.slice(1)} statistics:
📝 Words: ${stats.words}
🔤 Characters: ${stats.characters}
🔠 Characters (no spaces): ${stats.charactersNoSpaces}
📄 Paragraphs: ${stats.paragraphs}
⏱️ Reading time: ${stats.readingTime}`;

      this.showNotification(message, 'info', 8000); // Show for 8 seconds

    } catch (error) {
      this.logger.error('Word count failed:', error);
      this.showNotification('Failed to count words', 'error');
    }
  }

  /**
   * Calculate comprehensive text statistics
   * @param {string} text - Text to analyze
   * @returns {object} Statistics object
   */
  calculateTextStats(text) {
    if (!text || typeof text !== 'string') {
      return {
        words: 0,
        characters: 0,
        charactersNoSpaces: 0,
        paragraphs: 0,
        readingTime: '0 min'
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

    // Paragraph count (split by double line breaks or HTML paragraph elements)
    const paragraphs = Math.max(1, text.split(/\n\s*\n|<\/p>|<br\s*\/?>/i).filter(p => p.trim().length > 0).length);

    // Reading time calculation (average 200 words per minute)
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    const readingTime = minutes < 1 ? 'less than 1 min' : 
                       minutes === 1 ? '1 min' : 
                       `${minutes} mins`;

    return {
      words: wordCount,
      characters,
      charactersNoSpaces,
      paragraphs,
      readingTime
    };
  }

  /**
   * Plugin deactivation - cleanup resources
   */
  async deactivate() {
    try {
      this.logger.info('Text Transformer plugin deactivating');
      
      // BasePlugin automatically handles cleanup of commands and event listeners
      await super.deactivate();
      
      this.showNotification('Text Transformer plugin deactivated', 'info');
      
    } catch (error) {
      this.logger.error('Error during deactivation:', error);
    }
  }
}

/**
 * Plugin manifest for this example
 * Save this as plugin.json in the same directory
 */
export const manifest = {
  "id": "simple-text-transformer",
  "name": "Simple Text Transformer",
  "version": "1.0.0",
  "description": "Transform selected text or entire document with common text operations like case changes and formatting",
  "main": "simple-text-transformer.js",
  "lokusVersion": "^1.0.0",
  "author": "Lokus Plugin Examples",
  "license": "MIT",
  "keywords": ["text", "transform", "format", "case", "utility"],
  "categories": ["Editor", "Other"],
  "permissions": [
    "modify_ui"
  ],
  "activationEvents": [
    "onStartup"
  ],
  "contributes": {
    "commands": [
      {
        "command": "text-transformer.uppercase",
        "title": "Convert to UPPERCASE",
        "category": "Text Transform"
      },
      {
        "command": "text-transformer.lowercase", 
        "title": "Convert to lowercase",
        "category": "Text Transform"
      },
      {
        "command": "text-transformer.titlecase",
        "title": "Convert to Title Case",
        "category": "Text Transform"
      },
      {
        "command": "text-transformer.sentencecase",
        "title": "Convert to Sentence case", 
        "category": "Text Transform"
      },
      {
        "command": "text-transformer.reverse",
        "title": "Reverse Text",
        "category": "Text Transform"
      },
      {
        "command": "text-transformer.cleanup-spaces",
        "title": "Clean Up Spaces",
        "category": "Text Transform"
      },
      {
        "command": "text-transformer.word-count",
        "title": "Show Word Count",
        "category": "Text Transform"
      }
    ]
  }
};