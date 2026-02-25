import { invoke } from '@tauri-apps/api/core';
import { stripHtml, sanitizeHtml } from '../security/index.js';
import { insertContent, selectAll as pmSelectAll } from '../../editor/commands/index.js';
import { createLokusSerializer } from '../markdown/lokus-md-pipeline.js';

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
      return false;
    }
  }

  /**
   * Copy selected content from editor (PM EditorView)
   */
  async copyFromEditor(view) {
    if (!view) return false;

    const { state } = view;
    const { from, to } = state.selection;

    if (from === to) {
      // No selection, copy entire document as markdown
      try {
        const serializer = createLokusSerializer();
        const markdown = serializer.serialize(state.doc);
        const text = state.doc.textContent;
        return await this.writeHTML(markdown, text);
      } catch {
        const text = state.doc.textContent;
        return await this.writeText(text);
      }
    } else {
      // Copy selected content
      const selectedText = state.doc.textBetween(from, to);
      return await this.writeText(selectedText);
    }
  }

  /**
   * Paste content to editor (PM EditorView)
   */
  async pasteToEditor(view) {
    if (!view) return false;

    try {
      // Try to read HTML first, fallback to text
      let content = await this.readHTML();

      if (!content) {
        content = await this.readText();
      }

      if (content) {
        // Insert content at current cursor position using PM command helper
        insertContent(view, content);
        this._notifyListeners('paste', { content });
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Select all content in editor (PM EditorView)
   */
  selectAll(view) {
    if (!view) return false;

    pmSelectAll(view);
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
      } catch { }
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