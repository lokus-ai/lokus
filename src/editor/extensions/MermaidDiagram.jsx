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
          console.log('[MermaidDiagram] parseHTML - data-code attr:', dataCode ? 'exists (base64)' : 'not found');

          if (dataCode) {
            try {
              code = atob(dataCode); // Base64 decode
              console.log('[MermaidDiagram] parseHTML - decoded base64, code length:', code.length);
            } catch (e) {
              console.error('[MermaidDiagram] Failed to decode mermaid code:', e);
              code = '';
            }
          } else {
            // Fallback to old formats for backward compatibility
            const codeElement = node.querySelector('code');
            console.log('[MermaidDiagram] parseHTML - code element:', codeElement ? 'found' : 'not found');

            if (codeElement) {
              code = codeElement.textContent;
              console.log('[MermaidDiagram] parseHTML - code from element, length:', code.length);
            } else {
              code = node.getAttribute('code') || '';
              console.log('[MermaidDiagram] parseHTML - code from attribute, length:', code.length);
            }
          }

          console.log('[MermaidDiagram] parseHTML - final code length:', code.length);
          console.log('[MermaidDiagram] parseHTML - first 100 chars:', code.substring(0, 100));

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