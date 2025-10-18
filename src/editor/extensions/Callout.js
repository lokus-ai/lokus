import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Callout/Admonition Extension for TipTap
 *
 * Supports syntax: >[!type] Optional Title
 *
 * Callout types: note, tip, warning, danger, info, success, question, example
 *
 * Features:
 * - Collapsible callouts with >[!type]- syntax
 * - Nested content support
 * - Dark mode compatible
 */

const CALLOUT_TYPES = {
  note: { icon: 'ℹ️', color: 'blue', label: 'Note' },
  tip: { icon: '💡', color: 'green', label: 'Tip' },
  warning: { icon: '⚠️', color: 'orange', label: 'Warning' },
  danger: { icon: '🚨', color: 'red', label: 'Danger' },
  info: { icon: 'ℹ️', color: 'cyan', label: 'Info' },
  success: { icon: '✅', color: 'green', label: 'Success' },
  question: { icon: '❓', color: 'purple', label: 'Question' },
  example: { icon: '📝', color: 'gray', label: 'Example' }
};

export const Callout = Node.create({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: element => element.getAttribute('data-callout-type') || 'note',
        renderHTML: attributes => {
          return {
            'data-callout-type': attributes.type
          };
        }
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('data-callout-title'),
        renderHTML: attributes => {
          if (attributes.title) {
            return {
              'data-callout-title': attributes.title
            };
          }
          return {};
        }
      },
      collapsed: {
        default: false,
        parseHTML: element => element.getAttribute('data-collapsed') === 'true',
        renderHTML: attributes => {
          return {
            'data-collapsed': attributes.collapsed ? 'true' : 'false'
          };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type || 'note';
    const title = node.attrs.title || CALLOUT_TYPES[type]?.label || 'Note';
    const collapsed = node.attrs.collapsed || false;
    const calloutConfig = CALLOUT_TYPES[type] || CALLOUT_TYPES.note;

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `callout callout-${type}`,
        'data-callout-type': type,
        'data-collapsed': collapsed ? 'true' : 'false'
      }),
      [
        'div',
        { class: 'callout-header' },
        [
          'span',
          { class: 'callout-icon' },
          calloutConfig.icon
        ],
        [
          'span',
          { class: 'callout-title' },
          title
        ],
        [
          'button',
          {
            class: 'callout-toggle',
            'data-toggle': 'true'
          },
          collapsed ? '▶' : '▼'
        ]
      ],
      [
        'div',
        {
          class: 'callout-content',
          style: collapsed ? 'display: none;' : ''
        },
        0
      ]
    ];
  },

  addCommands() {
    return {
      setCallout: (attributes) => ({ commands }) => {
        return commands.wrapIn(this.name, attributes);
      },
      toggleCallout: (attributes) => ({ commands }) => {
        return commands.toggleWrap(this.name, attributes);
      },
      unsetCallout: () => ({ commands }) => {
        return commands.lift(this.name);
      }
    };
  },

  addKeyboardShortcuts() {
    return {
      // Mod-Alt-C to create callout
      'Mod-Alt-c': () => this.editor.commands.setCallout({ type: 'note' })
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^>\[!(\w+)\](-?)\s*(.*)$/,
        handler: ({ state, range, match }) => {
          const [, type, collapsedFlag, title] = match;
          const calloutType = CALLOUT_TYPES[type.toLowerCase()] ? type.toLowerCase() : 'note';
          const collapsed = collapsedFlag === '-';

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          // Delete the input text
          tr.delete(start, end);

          // Insert callout node with a paragraph inside
          const calloutNode = state.schema.nodes.callout.create(
            {
              type: calloutType,
              title: title || null,
              collapsed
            },
            state.schema.nodes.paragraph.create()
          );

          tr.insert(start, calloutNode);
          // Position cursor inside the callout
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(start + 2)));

          // Dispatch the transaction and return false to prevent further handling
          this.editor.view.dispatch(tr);
          return false;
        }
      })
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('callout-click-handler'),
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target;

              // Check if clicked on toggle button
              if (target.classList?.contains('callout-toggle') || target.getAttribute?.('data-toggle')) {
                const calloutHeader = target.closest('.callout-header');
                if (!calloutHeader) return false;

                const callout = calloutHeader.parentElement;
                if (!callout || !callout.classList.contains('callout')) return false;

                // Find the callout node in the editor
                let calloutPos = null;
                let calloutNode = null;

                view.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'callout') {
                    const nodeDOM = view.nodeDOM(pos);
                    if (nodeDOM === callout) {
                      calloutPos = pos;
                      calloutNode = node;
                      return false;
                    }
                  }
                });

                if (calloutNode && calloutPos !== null) {
                  // Toggle collapsed state
                  const tr = view.state.tr.setNodeMarkup(calloutPos, null, {
                    ...calloutNode.attrs,
                    collapsed: !calloutNode.attrs.collapsed
                  });
                  view.dispatch(tr);
                  return true;
                }
              }

              return false;
            }
          }
        }
      })
    ];
  }
});

export default Callout;
