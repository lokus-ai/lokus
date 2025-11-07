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
      code: { default: '' },
      theme: { default: 'default' },
      updatedAt: { default: Date.now() },
    };
  },

  parseHTML() {
    return [{ tag: 'mermaid-block' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mermaid-block', mergeAttributes(HTMLAttributes), 0];
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