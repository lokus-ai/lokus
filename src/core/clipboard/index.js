import { invoke } from '@tauri-apps/api/core';
import { stripHtml, sanitizeHtml } from '../security/index.js';

/**
 * Custom clipboard manager that syncs with macOS system clipboard
 * Provides seamless integration between the editor and native clipboard
 */
class ClipboardManager {
  constructor() {
    this.isSupported = true;
    this.listeners = new Set();
  }

  /**
   * Write text to system clipboard
   */
  async writeText(text) {
    try {
      await invoke('clipboard_write_text', { text });
      this._notifyListeners('write', { type: 'text', data: text });
      return true;
    } catch (error) {
      console.error('Failed to write text to clipboard:', error);
      return false;
    }
  }

  /**
   * Read text from system clipboard
   */
  async readText() {
    try {
      const text = await invoke('clipboard_read_text');
      return text;
    } catch (error) {
      console.error('Failed to read text from clipboard:', error);
      return '';
    }
  }

  /**
   * Write HTML to system clipboard (with fallback to text)
   */
  async writeHTML(html, plainText = null) {
    try {
      // Try to write HTML first
      await invoke('clipboard_write_html', { html });
      
      // If no plain text provided, strip HTML tags as fallback (secure)
      if (!plainText) {
        plainText = stripHtml(html);
      }

      this._notifyListeners('write', { type: 'html', data: html, plainText });
      return true;
    } catch (error) {
      console.warn('Failed to write HTML to clipboard, falling back to text:', error);
      // Fallback to plain text
      return await this.writeText(plainText || this._stripHTML(html));
    }
  }

  /**
   * Read HTML from system clipboard
   */
  async readHTML() {
    try {
      const html = await invoke('clipboard_read_html');
      return html;
    } catch (error) {
      console.error('Failed to read HTML from clipboard:', error);
      // Fallback to reading as text
      return await this.readText();
    }
  }

  /**
   * Check if clipboard has text content
   */
  async hasText() {
    try {
      return await invoke('clipboard_has_text');
    } catch (error) {
      console.error('Failed to check clipboard text:', error);
      return false;
    }
  }

  /**
   * Clear clipboard contents
   */
  async clear() {
    try {
      await invoke('clipboard_clear');
      this._notifyListeners('clear', null);
      return true;
    } catch (error) {
      console.error('Failed to clear clipboard:', error);
      return false;
    }
  }

  /**
   * Copy selected content from editor
   */
  async copyFromEditor(editor) {
    if (!editor) return false;

    const { state } = editor;
    const { from, to } = state.selection;
    
    if (from === to) {
      // No selection, copy entire document
      const html = editor.getHTML();
      const text = editor.getText();
      return await this.writeHTML(html, text);
    } else {
      // Copy selected content
      const selectedHTML = editor.getHTML().slice(from, to);
      const selectedText = editor.getText().slice(from, to);
      return await this.writeHTML(selectedHTML, selectedText);
    }
  }

  /**
   * Paste content to editor
   */
  async pasteToEditor(editor) {
    if (!editor) return false;

    try {
      // Try to read HTML first, fallback to text
      let content = await this.readHTML();
      
      if (!content) {
        content = await this.readText();
      }

      if (content) {
        // Insert content at current cursor position
        editor.commands.insertContent(content);
        this._notifyListeners('paste', { content });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to paste to editor:', error);
      return false;
    }
  }

  /**
   * Select all content in editor
   */
  selectAll(editor) {
    if (!editor) return false;
    
    editor.commands.selectAll();
    this._notifyListeners('selectAll', null);
    return true;
  }

  /**
   * Add event listener for clipboard operations
   */
  addEventListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Private: Notify all listeners of clipboard events
   */
  _notifyListeners(type, data) {
    this.listeners.forEach(callback => {
      try {
        callback({ type, data, timestamp: Date.now() });
      } catch (error) {
        console.error('Error in clipboard listener:', error);
      }
    });
  }

  /**
   * Private: Strip HTML tags from string (secure)
   */
  _stripHTML(html) {
    return stripHtml(html);
  }
}

// Create singleton instance
const clipboard = new ClipboardManager();

export default clipboard;

// Named exports for convenience
export const {
  writeText,
  readText,
  writeHTML,
  readHTML,
  hasText,
  clear,
  copyFromEditor,
  pasteToEditor,
  selectAll,
  addEventListener,
  removeEventListener
} = clipboard;