import { InputRule, inputRules } from 'prosemirror-inputrules';
import { createReactNodeView } from '../lib/react-pm-helpers.jsx';
import MermaidComponent from '../lib/Mermaid';

// Node view factory — pass this to useProseMirror's nodeViews config as:
//   nodeViews: { mermaid: mermaidNodeView }
export const mermaidNodeView = createReactNodeView(MermaidComponent);

/**
 * Returns a prosemirror-inputrules plugin that converts the ``mm shortcut
 * at the start of a line into a mermaid node.
 *
 * Matches the sequence "```mm " (triple-backtick mm space) typed at the
 * beginning of a block.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin}
 */
export function createMermaidInputRulesPlugin(schema) {
  return inputRules({
    rules: [
      new InputRule(/^```mm\s$/, (state, _match, start, end) => {
        const nodeType = schema.nodes.mermaid;
        if (!nodeType) return null;

        return state.tr.replaceWith(start, end, nodeType.create());
      }),
    ],
  });
}

// Backward-compatible default export so any existing import of
// `MermaidDiagram` still resolves to something meaningful.
export default { mermaidNodeView, createMermaidInputRulesPlugin };
