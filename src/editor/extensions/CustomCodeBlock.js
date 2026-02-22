import { mergeAttributes, Node, textblockTypeInputRule } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight';

// Import common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';

// Register languages with lowlight
lowlight.registerLanguage('javascript', javascript);
lowlight.registerLanguage('js', javascript);
lowlight.registerLanguage('typescript', typescript);
lowlight.registerLanguage('ts', typescript);
lowlight.registerLanguage('python', python);
lowlight.registerLanguage('py', python);
lowlight.registerLanguage('java', java);
lowlight.registerLanguage('cpp', cpp);
lowlight.registerLanguage('c', c);
lowlight.registerLanguage('csharp', csharp);
lowlight.registerLanguage('cs', csharp);
lowlight.registerLanguage('go', go);
lowlight.registerLanguage('rust', rust);
lowlight.registerLanguage('php', php);
lowlight.registerLanguage('ruby', ruby);
lowlight.registerLanguage('swift', swift);
lowlight.registerLanguage('kotlin', kotlin);
lowlight.registerLanguage('css', css);
lowlight.registerLanguage('html', html);
lowlight.registerLanguage('xml', html);
lowlight.registerLanguage('json', json);
lowlight.registerLanguage('yaml', yaml);
lowlight.registerLanguage('yml', yaml);
lowlight.registerLanguage('bash', bash);
lowlight.registerLanguage('sh', bash);
lowlight.registerLanguage('shell', bash);
lowlight.registerLanguage('sql', sql);
lowlight.registerLanguage('markdown', markdown);
lowlight.registerLanguage('md', markdown);

/**
 * Custom CodeBlock Extension with Syntax Highlighting
 * - Supports 20+ programming languages
 * - No auto-exit on typing
 * - Works with our CodeBlockIndent extension
 */
export const CustomCodeBlock = CodeBlockLowlight
  .extend({
      
    // name: 'codeBlock',

    priority: 1000, // High priority to override other extensions

    isolating: true, // Prevent content from leaving the block

    addOptions() {

      return {
        ...this.parent?.(),
        lowlight,
        languageClassPrefix: 'language-',
        HTMLAttributes: {},
        defaultLanguage: null,
      };
    },

    addKeyboardShortcuts() {
      return {
        ...this.parent?.(),
        'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),

      // Enter key - insert newline, stay in code block
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        const { $from, $to } = selection;

        // Only handle if we're in a code block
        if ($from.parent.type.name !== this.name) {
          return false;
        }

        // Insert a plain newline character
        const tr = state.tr.insertText('\n', $from.pos, $to.pos);
        view.dispatch(tr);
        return true;
      },

      // Backspace at start of empty code block = convert to paragraph
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection;
        const isAtStart = $anchor.parentOffset === 0;

        if (!empty || $anchor.parent.type.name !== this.name) {
          return false;
        }

        if (isAtStart || !$anchor.parent.textContent.length) {
          return this.editor.commands.clearNodes();
        }

        return false;
      },
      };
    },

    addInputRules() {
      return [
        textblockTypeInputRule({
          find: /^```([a-z]+)?[\s\n]$/,
          type: this.type,
          getAttributes: match => ({
            language: match[1],
          }),
        }),
      ];
    },
  });

export default CustomCodeBlock;