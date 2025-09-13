import clipboard from './index.js';

/**
 * Keyboard shortcut handler for clipboard operations
 * Integrates with our custom clipboard manager
 */
class ClipboardShortcuts {
  constructor() {
    this.editor = null;
    this.isEnabled = true;
    this.boundHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Initialize clipboard shortcuts for an editor
   */
  init(editor) {
    this.editor = editor;
    this.enable();
  }

  /**
   * Enable keyboard shortcuts
   */
  enable() {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    document.addEventListener('keydown', this.boundHandler, true);
  }

  /**
   * Disable keyboard shortcuts
   */
  disable() {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    document.removeEventListener('keydown', this.boundHandler, true);
  }

  /**
   * Handle keyboard events
   */
  async handleKeyDown(event) {
    if (!this.isEnabled || !this.editor) return;

    const isCmd = event.metaKey || event.ctrlKey;
    
    if (!isCmd) return;

    const key = event.key.toLowerCase();
    
    // Handle clipboard shortcuts
    switch (key) {
      case 'c':
        if (!event.shiftKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          await this.handleCopy();
          return true;
        }
        break;
        
      case 'x':
        if (!event.shiftKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          await this.handleCut();
          return true;
        }
        break;
        
      case 'v':
        if (!event.shiftKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          await this.handlePaste();
          return true;
        }
        break;
        
      case 'a':
        if (!event.shiftKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          await this.handleSelectAll();
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Handle copy operation
   */
  async handleCopy() {
    if (!this.editor) return false;

    const { state } = this.editor;
    const { from, to, empty } = state.selection;
    
    if (empty) {
      // No selection - copy the entire current line/paragraph
      const pos = from;
      const $pos = state.doc.resolve(pos);
      const start = $pos.start($pos.depth);
      const end = $pos.end($pos.depth);
      
      // Get content of current node
      const node = $pos.parent;
      const html = this._nodeToHTML(node);
      const text = node.textContent;
      
      return await clipboard.writeHTML(html, text);
    } else {
      // Copy selected content
      const selectedFragment = state.doc.slice(from, to);
      const html = this._fragmentToHTML(selectedFragment);
      const text = selectedFragment.textContent;
      
      return await clipboard.writeHTML(html, text);
    }
  }

  /**
   * Handle cut operation
   */
  async handleCut() {
    if (!this.editor) return false;

    // First copy the content
    const copySuccess = await this.handleCopy();
    
    if (copySuccess) {
      const { state } = this.editor;
      const { from, to, empty } = state.selection;
      
      if (empty) {
        // Delete current line/paragraph
        this.editor.commands.selectTextblockStart();
        this.editor.commands.selectTextblockEnd();
        this.editor.commands.deleteSelection();
      } else {
        // Delete selected content
        this.editor.commands.deleteSelection();
      }
    }
    
    return copySuccess;
  }

  /**
   * Handle paste operation
   */
  async handlePaste() {
    return await clipboard.pasteToEditor(this.editor);
  }

  /**
   * Handle select all operation
   */
  async handleSelectAll() {
    return clipboard.selectAll(this.editor);
  }

  /**
   * Private: Convert ProseMirror node to HTML
   */
  _nodeToHTML(node) {
    // Create a temporary editor instance to convert node to HTML
    const tempDiv = document.createElement('div');
    
    // Simple conversion for common node types
    if (node.type.name === 'paragraph') {
      tempDiv.innerHTML = `<p>${node.textContent}</p>`;
    } else if (node.type.name === 'heading') {
      const level = node.attrs.level || 1;
      tempDiv.innerHTML = `<h${level}>${node.textContent}</h${level}>`;
    } else if (node.type.name === 'codeBlock') {
      tempDiv.innerHTML = `<pre><code>${node.textContent}</code></pre>`;
    } else {
      tempDiv.innerHTML = node.textContent;
    }
    
    return tempDiv.innerHTML;
  }

  /**
   * Private: Convert ProseMirror fragment to HTML
   */
  _fragmentToHTML(fragment) {
    const tempDiv = document.createElement('div');
    
    // For now, use text content as fallback
    // In a full implementation, you'd want to properly serialize the fragment
    tempDiv.textContent = fragment.textContent;
    
    return tempDiv.innerHTML;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.disable();
    this.editor = null;
  }
}

// Create singleton instance
const clipboardShortcuts = new ClipboardShortcuts();

export default clipboardShortcuts;