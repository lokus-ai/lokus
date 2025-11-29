import { mergeAttributes, Node, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MermaidComponent from '../lib/Mermaid';

// Step 1: match only the start trigger
const MERMAID_START_REGEX = /^``mm$/;

 const MermaidDiagram = Node.create({
  name: 'mermaid',
  group: 'block',
  content: 'text*', // allow editing inside the block
  code: true,
  atom: false,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      code: {
        default: '',
      },
      theme: {
        default: 'default',
      },
      updatedAt: {
        default: Date.now(),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mermaid-block',
        getAttrs: node => {
          let code = '';

          // Try new base64 format first
          const dataCode = node.getAttribute('data-code');
          if (dataCode) {
            try {
              code = atob(dataCode); // Base64 decode
            } catch (e) {
              console.error('[MermaidDiagram] Failed to decode mermaid code:', e);
              code = '';
            }
          } else {
            // Fallback to old formats for backward compatibility
            const codeElement = node.querySelector('code');
            if (codeElement) {
              code = codeElement.textContent;
            } else {
              code = node.getAttribute('code') || '';
            }
          }

          return {
            code: code,
            theme: node.getAttribute('theme') || 'default',
            updatedAt: node.getAttribute('updatedat') || Date.now(),
          };
        },
      },
      // Support for markdown code blocks: ```mermaid
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: node => {
          const codeElement = node.querySelector('code.language-mermaid');
          if (!codeElement) return false;

          return {
            code: codeElement.textContent || '',
            theme: 'default',
            updatedAt: Date.now(),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Store code as base64-encoded attribute for reliable persistence
    // Base64 encoding preserves multi-line code and special characters
    const encodedCode = node.attrs.code ? btoa(node.attrs.code) : '';

    return [
      'mermaid-block',
      mergeAttributes(HTMLAttributes, {
        'data-code': encodedCode,
        theme: node.attrs.theme || 'default',
        updatedat: node.attrs.updatedAt || Date.now(),
      }),
    ];
  },

  // 1 When user types ``mm at line start -> convert to this node
  addInputRules() {
    return [
      new InputRule({
        find: MERMAID_START_REGEX,
        handler: ({ state, range }) => {
          const nodeType = state.schema.nodes.mermaid;
          if (!nodeType) return null;

          const tr = state.tr.replaceRangeWith(
            range.from,
            range.to,
            nodeType.create()
          );

          return tr;
        },
      }),
    ];
  },

  // 2 The React NodeView - renders diagram or editable text
  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent);
  },
});

export default MermaidDiagram;