import { Extension } from '@tiptap/core';

/**
 * CodeBlockIndent Extension
 * Adds proper tab indentation support inside code blocks
 * - Tab key inserts 2 spaces (or configurable)
 * - Shift+Tab removes indentation
 * - Works like VS Code inside code blocks
 */
const CodeBlockIndent = Extension.create({
  name: 'codeBlockIndent',

  addOptions() {
    return {
      tabSize: 2, // Number of spaces per tab
    };
  },

  addKeyboardShortcuts() {
    return {
      // Handle Tab key in code blocks
      Tab: ({ editor }) => {
        // Check if we're inside a code block using TipTap's built-in check
        if (editor.isActive('codeBlock')) {
          // Insert spaces instead of tab character
          const spaces = ' '.repeat(this.options.tabSize);
          editor.commands.insertContent(spaces);
          return true; // Prevent default tab behavior
        }

        return false; // Allow default tab behavior outside code blocks
      },

      // Handle Shift+Tab (outdent) in code blocks
      'Shift-Tab': ({ editor }) => {
        if (editor.isActive('codeBlock')) {
          const { state } = editor;
          const { selection, tr } = state;
          const { $from } = selection;

          // Get current line text
          const textBeforeCursor = state.doc.textBetween(
            $from.start(),
            $from.pos,
            '\n'
          );

          // Get the current line by finding last newline
          const lines = textBeforeCursor.split('\n');
          const currentLine = lines[lines.length - 1];

          // Check if line starts with spaces
          const indentMatch = currentLine.match(/^(\s+)/);
          if (indentMatch) {
            const spacesToRemove = Math.min(this.options.tabSize, indentMatch[1].length);
            const lineStartPos = $from.pos - currentLine.length;

            // Remove spaces
            tr.delete(lineStartPos, lineStartPos + spacesToRemove);
            editor.view.dispatch(tr);
          }

          return true;
        }

        return false;
      },
    };
  },
});

export default CodeBlockIndent;