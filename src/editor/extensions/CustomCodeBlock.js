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
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('java', java);
lowlight.register('cpp', cpp);
lowlight.register('c', c);
lowlight.register('csharp', csharp);
lowlight.register('cs', csharp);
lowlight.register('go', go);
lowlight.register('rust', rust);
lowlight.register('php', php);
lowlight.register('ruby', ruby);
lowlight.register('swift', swift);
lowlight.register('kotlin', kotlin);
lowlight.register('css', css);
lowlight.register('html', html);
lowlight.register('xml', html);
lowlight.register('json', json);
lowlight.register('yaml', yaml);
lowlight.register('yml', yaml);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('shell', bash);
lowlight.register('sql', sql);
lowlight.register('markdown', markdown);
lowlight.register('md', markdown);

/**
 * Custom CodeBlock Extension with Syntax Highlighting
 * - Supports 20+ programming languages
 * - No auto-exit on typing
 * - Works with our CodeBlockIndent extension
 */
export const CustomCodeBlock = CodeBlockLowlight
  .extend({
    name: 'codeBlock',

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
        const isAtStart = $anchor.pos === 1;

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