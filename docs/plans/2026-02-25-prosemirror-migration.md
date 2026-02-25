# TipTap → Raw ProseMirror Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace TipTap editor abstraction with raw ProseMirror EditorView, eliminating the md→HTML→TipTap conversion chain, enabling custom syntax freedom, and fixing the tab-switching content loss bug by architectural design.

**Architecture:** Single ProseMirror EditorView per editor group, managed via React ref (never recreated on tab switch). Content flows: load (md → PM doc via lokus-md-pipeline), edit (PM transactions), save (PM doc → md via lokus serializer), tab switch (PM JSON cache swap via `view.updateState()`). All `getHTML()` calls eliminated. TipTap extension system replaced with raw PM plugins + custom infrastructure (suggestion factory, React-in-PM helpers, floating menu plugin).

**Tech Stack:** ProseMirror (prosemirror-model, prosemirror-state, prosemirror-view, prosemirror-commands, prosemirror-keymap, prosemirror-inputrules, prosemirror-markdown, prosemirror-history, prosemirror-dropcursor, prosemirror-gapcursor, prosemirror-tables), React 18 (createRoot), tippy.js (popups), lowlight (code highlighting), KaTeX (math rendering)

---

## Pre-Flight Checklist

Before starting any task:
1. You're in the `fixing-root` worktree at `/Users/pratham/Programming/Lokus/lokus/.claude/worktrees/fixing-root`
2. Run `git status` to confirm clean state
3. Run `npm run dev` to verify the app starts (Tauri desktop app)

Key reference files you'll need throughout:
- Schema source of truth: `src/core/markdown/lokus-md-pipeline.js`
- Current editor: `src/editor/components/Editor.jsx` (~1100 lines)
- Editor group: `src/components/EditorGroup.jsx` (~450 lines)
- Editor registry: `src/stores/editorRegistry.js` (21 lines)
- Plugin API: `src/plugins/api/EditorAPI.js` (~2048 lines)
- Save hook: `src/features/editor/hooks/useSave.js`

---

## Task 1: Install ProseMirror Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install prosemirror packages**

```bash
npm install prosemirror-model prosemirror-state prosemirror-view prosemirror-commands prosemirror-keymap prosemirror-inputrules prosemirror-history prosemirror-dropcursor prosemirror-gapcursor prosemirror-schema-list prosemirror-tables
```

Note: `prosemirror-markdown` (^1.13.2) and `markdown-it` (^14.1.0) are already installed.

**Step 2: Verify installation**

```bash
node -e "require('prosemirror-model'); require('prosemirror-state'); require('prosemirror-view'); console.log('All PM packages OK')"
```

Expected: `All PM packages OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install prosemirror dependencies for tiptap migration"
```

---

## Task 2: Create the ProseMirror Schema

This is the single most critical piece. Every other task depends on it.

**Files:**
- Create: `src/editor/schema/lokus-schema.js`
- Create: `src/editor/schema/index.js`

**Context:** Currently there is NO standalone schema. TipTap builds it implicitly from extensions. The parser in `lokus-md-pipeline.js` receives the schema as a parameter. We need an explicit schema that matches what TipTap currently produces.

**Step 1: Create the schema file**

```js
// src/editor/schema/lokus-schema.js
import { Schema } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';

/**
 * The Lokus ProseMirror schema.
 *
 * Node/mark names use camelCase (TipTap convention) to stay compatible
 * with existing PM JSON stored in contentByTab and lokus-md-pipeline
 * serializer mappings (which map both camelCase and snake_case).
 */

const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'block*',
  cellAttributes: {},
});

const nodes = {
  doc: { content: 'block+' },
  text: { group: 'inline' },

  paragraph: {
    group: 'block',
    content: 'inline*',
    attrs: { blockId: { default: null } },
    parseDOM: [{ tag: 'p', getAttrs: (dom) => ({ blockId: dom.getAttribute('data-block-id') }) }],
    toDOM(node) {
      const attrs = {};
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId;
      return ['p', attrs, 0];
    },
  },

  heading: {
    group: 'block',
    content: 'inline*',
    attrs: {
      level: { default: 1 },
      blockId: { default: null },
    },
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
      tag: `h${level}`,
      getAttrs: (dom) => ({ level, blockId: dom.getAttribute('data-block-id') }),
    })),
    toDOM(node) {
      const attrs = {};
      if (node.attrs.blockId) attrs['data-block-id'] = node.attrs.blockId;
      return [`h${node.attrs.level}`, attrs, 0];
    },
  },

  blockquote: {
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: { blockId: { default: null } },
    parseDOM: [{ tag: 'blockquote' }],
    toDOM() { return ['blockquote', 0]; },
  },

  codeBlock: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: {
      language: { default: null },
      blockId: { default: null },
    },
    parseDOM: [{
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs: (dom) => ({
        language: dom.querySelector('code')?.getAttribute('class')?.replace(/^language-/, '') || null,
      }),
    }],
    toDOM(node) {
      const codeAttrs = node.attrs.language ? { class: `language-${node.attrs.language}` } : {};
      return ['pre', ['code', codeAttrs, 0]];
    },
  },

  horizontalRule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() { return ['hr']; },
  },

  hardBreak: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM() { return ['br']; },
  },

  image: {
    inline: true,
    group: 'inline',
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
    },
    parseDOM: [{
      tag: 'img[src]',
      getAttrs: (dom) => ({
        src: dom.getAttribute('src'),
        alt: dom.getAttribute('alt'),
        title: dom.getAttribute('title'),
      }),
    }],
    toDOM(node) { return ['img', node.attrs]; },
  },

  bulletList: {
    group: 'block',
    content: 'listItem+',
    parseDOM: [{ tag: 'ul' }],
    toDOM() { return ['ul', 0]; },
  },

  orderedList: {
    group: 'block',
    content: 'listItem+',
    attrs: { order: { default: 1 } },
    parseDOM: [{
      tag: 'ol',
      getAttrs: (dom) => ({ order: dom.hasAttribute('start') ? +dom.getAttribute('start') : 1 }),
    }],
    toDOM(node) {
      return node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0];
    },
  },

  listItem: {
    content: 'paragraph block*',
    attrs: { blockId: { default: null } },
    defining: true,
    parseDOM: [{ tag: 'li' }],
    toDOM() { return ['li', 0]; },
  },

  taskList: {
    group: 'block',
    content: 'taskItem+',
    parseDOM: [{ tag: 'ul[data-type="taskList"]' }],
    toDOM() { return ['ul', { 'data-type': 'taskList' }, 0]; },
  },

  taskItem: {
    content: 'paragraph block*',
    defining: true,
    attrs: { checked: { default: false } },
    parseDOM: [{
      tag: 'li[data-type="taskItem"]',
      getAttrs: (dom) => ({ checked: dom.getAttribute('data-checked') === 'true' }),
    }],
    toDOM(node) {
      return ['li', { 'data-type': 'taskItem', 'data-checked': node.attrs.checked }, 0];
    },
  },

  // Tables — from prosemirror-tables with customization
  table: {
    ...tableNodeSpecs.table,
    attrs: { ...tableNodeSpecs.table.attrs, blockId: { default: null } },
  },
  tableRow: {
    ...tableNodeSpecs.table_row,
    attrs: { blockId: { default: null } },
  },
  tableHeader: tableNodeSpecs.table_header,
  tableCell: tableNodeSpecs.table_cell,

  // --- Custom Lokus nodes ---

  wikiLink: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      id: { default: null },
      target: { default: '' },
      alt: { default: null },
      embed: { default: false },
      href: { default: null },
      src: { default: null },
    },
    parseDOM: [{
      tag: 'span[data-wiki-link]',
      getAttrs: (dom) => ({
        target: dom.getAttribute('data-target') || '',
        alt: dom.getAttribute('data-alt'),
        id: dom.getAttribute('data-id'),
      }),
    }],
    toDOM(node) {
      return ['span', {
        'data-wiki-link': '',
        'data-target': node.attrs.target,
        'data-alt': node.attrs.alt || '',
        class: 'wiki-link',
      }, node.attrs.alt || node.attrs.target];
    },
  },

  wikiLinkEmbed: {
    group: 'block',
    atom: true,
    attrs: {
      id: { default: null },
      fileName: { default: '' },
      blockId: { default: null },
      filePath: { default: null },
      content: { default: '' },
      loading: { default: true },
      error: { default: null },
    },
    parseDOM: [{
      tag: 'div[data-wiki-embed]',
      getAttrs: (dom) => ({
        fileName: dom.getAttribute('data-file-name') || '',
        blockId: dom.getAttribute('data-block-id'),
        filePath: dom.getAttribute('data-file-path'),
      }),
    }],
    toDOM(node) {
      return ['div', {
        'data-wiki-embed': '',
        'data-file-name': node.attrs.fileName,
        'data-block-id': node.attrs.blockId || '',
        class: 'wiki-link-embed',
      }];
    },
  },

  canvasLink: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      id: { default: null },
      canvasName: { default: '' },
      canvasPath: { default: null },
      thumbnailUrl: { default: null },
      exists: { default: true },
    },
    parseDOM: [{
      tag: 'span[data-canvas-link]',
      getAttrs: (dom) => ({
        canvasName: dom.getAttribute('data-canvas-name') || '',
        canvasPath: dom.getAttribute('data-canvas-path'),
      }),
    }],
    toDOM(node) {
      return ['span', {
        'data-canvas-link': '',
        'data-canvas-name': node.attrs.canvasName,
        class: 'canvas-link',
      }, node.attrs.canvasName];
    },
  },

  callout: {
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: {
      type: { default: 'note' },
      title: { default: null },
      collapsed: { default: false },
    },
    parseDOM: [{
      tag: 'div[data-callout-type]',
      getAttrs: (dom) => ({
        type: dom.getAttribute('data-callout-type') || 'note',
        title: dom.getAttribute('data-callout-title'),
        collapsed: dom.getAttribute('data-callout-collapsed') === 'true',
      }),
    }],
    toDOM(node) {
      return ['div', {
        'data-callout-type': node.attrs.type,
        'data-callout-title': node.attrs.title || '',
        'data-callout-collapsed': String(node.attrs.collapsed),
        class: `callout callout-${node.attrs.type}`,
      }, 0];
    },
  },

  mermaid: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    isolating: true,
    attrs: {
      code: { default: '' },
      theme: { default: 'default' },
      updatedAt: { default: null },
    },
    parseDOM: [{
      tag: 'mermaid-block',
      getAttrs: (dom) => {
        const encoded = dom.getAttribute('data-code');
        return {
          code: encoded ? atob(encoded) : '',
          theme: dom.getAttribute('data-theme') || 'default',
        };
      },
    }],
    toDOM(node) {
      return ['mermaid-block', {
        'data-code': node.attrs.code ? btoa(node.attrs.code) : '',
        'data-theme': node.attrs.theme,
      }, 0];
    },
  },

  inlineMath: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      latex: { default: '' },
      display: { default: 'no' },
    },
    parseDOM: [{
      tag: 'span[data-inline-math]',
      getAttrs: (dom) => ({
        latex: dom.getAttribute('data-latex') || '',
        display: dom.getAttribute('data-display') || 'no',
      }),
    }],
    toDOM(node) {
      return ['span', {
        'data-inline-math': '',
        'data-latex': node.attrs.latex,
        'data-display': node.attrs.display,
        class: 'inline-math',
      }];
    },
  },
};

const marks = {
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (node) => node.style.fontWeight !== 'normal' && null },
      { style: 'font-weight=400', clearMark: (m) => m.type.name === 'bold' },
      { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
    ],
    toDOM() { return ['strong', 0]; },
  },

  italic: {
    parseDOM: [
      { tag: 'i' },
      { tag: 'em' },
      { style: 'font-style=italic' },
    ],
    toDOM() { return ['em', 0]; },
  },

  code: {
    excludes: '_',
    parseDOM: [{ tag: 'code' }],
    toDOM() { return ['code', 0]; },
  },

  link: {
    attrs: {
      href: {},
      target: { default: null },
      rel: { default: null },
      class: { default: null },
    },
    inclusive: false,
    parseDOM: [{
      tag: 'a[href]',
      getAttrs: (dom) => ({
        href: dom.getAttribute('href'),
        target: dom.getAttribute('target'),
        rel: dom.getAttribute('rel'),
      }),
    }],
    toDOM(node) {
      return ['a', { href: node.attrs.href, target: '_blank', rel: 'noopener noreferrer' }, 0];
    },
  },

  strike: {
    parseDOM: [
      { tag: 's' },
      { tag: 'del' },
      { tag: 'strike' },
      { style: 'text-decoration', getAttrs: (value) => value === 'line-through' && null },
    ],
    toDOM() { return ['s', 0]; },
  },

  highlight: {
    attrs: { color: { default: null } },
    parseDOM: [{ tag: 'mark', getAttrs: (dom) => ({ color: dom.getAttribute('data-color') }) }],
    toDOM(node) {
      const attrs = { 'data-color': node.attrs.color };
      if (node.attrs.color) attrs.style = `background-color: ${node.attrs.color}`;
      return ['mark', attrs, 0];
    },
  },

  superscript: {
    excludes: 'subscript',
    parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
    toDOM() { return ['sup', 0]; },
  },

  subscript: {
    excludes: 'superscript',
    parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
    toDOM() { return ['sub', 0]; },
  },
};

export const lokusSchema = new Schema({ nodes, marks });

export default lokusSchema;
```

**Step 2: Create the index barrel**

```js
// src/editor/schema/index.js
export { lokusSchema, default } from './lokus-schema.js';
```

**Step 3: Verify schema loads**

```bash
node -e "
  const { lokusSchema } = require('./src/editor/schema/lokus-schema.js');
  console.log('Nodes:', Object.keys(lokusSchema.nodes).join(', '));
  console.log('Marks:', Object.keys(lokusSchema.marks).join(', '));
  console.log('Node count:', Object.keys(lokusSchema.nodes).length);
  console.log('Mark count:', Object.keys(lokusSchema.marks).length);
"
```

Expected: 24 nodes, 8 marks listed. If this fails due to ESM, test in the app instead.

**Step 4: Verify round-trip with existing pipeline**

```bash
node -e "
  const { lokusSchema } = require('./src/editor/schema/lokus-schema.js');
  const { createLokusParser, createLokusSerializer } = require('./src/core/markdown/lokus-md-pipeline.js');
  const parser = createLokusParser(lokusSchema);
  const serializer = createLokusSerializer();
  const md = '# Hello\n\nA paragraph with **bold** and *italic*.\n\n- list item 1\n- list item 2\n';
  const doc = parser.parse(md);
  const out = serializer.serialize(doc);
  console.log('Input:', JSON.stringify(md));
  console.log('Output:', JSON.stringify(out));
  console.log('Match:', md.trim() === out.trim() ? 'PASS' : 'FAIL');
"
```

Expected: `Match: PASS` (basic round-trip works)

**Step 5: Commit**

```bash
git add src/editor/schema/
git commit -m "feat: create explicit ProseMirror schema for Lokus editor"
```

---

## Task 3: Create React-in-PM Helpers

Infrastructure for rendering React components inside ProseMirror (replaces `ReactRenderer` and `ReactNodeViewRenderer` from `@tiptap/react`).

**Files:**
- Create: `src/editor/lib/react-pm-helpers.js`

**Step 1: Create the helpers file**

```js
// src/editor/lib/react-pm-helpers.js
import { createRoot } from 'react-dom/client';

/**
 * Renders a React component into a DOM container with lifecycle management.
 * Replaces @tiptap/react's ReactRenderer.
 *
 * Usage:
 *   const renderer = new ReactPopup(MyComponent, { someProp: true });
 *   document.body.appendChild(renderer.element);
 *   renderer.updateProps({ someProp: false });
 *   renderer.destroy();
 */
export class ReactPopup {
  constructor(Component, initialProps = {}) {
    this.Component = Component;
    this.element = document.createElement('div');
    this.element.style.display = 'contents';
    this.root = createRoot(this.element);
    this.ref = null;
    this.props = initialProps;
    this._render();
  }

  _render() {
    const { Component } = this;
    const props = { ...this.props, ref: (r) => { this.ref = r; } };
    this.root.render(<Component {...props} />);
  }

  updateProps(newProps) {
    this.props = { ...this.props, ...newProps };
    this._render();
  }

  destroy() {
    this.root.unmount();
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.ref = null;
  }
}

/**
 * Creates a ProseMirror NodeView that renders a React component.
 * Replaces @tiptap/react's ReactNodeViewRenderer.
 *
 * The React component receives: { node, view, getPos, updateAttributes }
 *
 * Usage in schema or plugin:
 *   nodeViews: { mermaid: createReactNodeView(MermaidComponent) }
 */
export function createReactNodeView(Component) {
  return (node, view, getPos) => {
    const dom = document.createElement('div');
    dom.classList.add('react-node-view');
    const root = createRoot(dom);

    const updateAttributes = (attrs) => {
      if (typeof getPos !== 'function') return;
      const pos = getPos();
      if (pos == null) return;
      const tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attrs,
      });
      view.dispatch(tr);
    };

    const render = (currentNode) => {
      root.render(
        <Component
          node={currentNode}
          view={view}
          getPos={getPos}
          updateAttributes={updateAttributes}
          selected={false}
        />
      );
    };

    render(node);

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type !== node.type) return false;
        node = updatedNode;
        render(updatedNode);
        return true;
      },
      selectNode() {
        dom.classList.add('ProseMirror-selectednode');
        root.render(
          <Component
            node={node}
            view={view}
            getPos={getPos}
            updateAttributes={updateAttributes}
            selected={true}
          />
        );
      },
      deselectNode() {
        dom.classList.remove('ProseMirror-selectednode');
        render(node);
      },
      destroy() {
        root.unmount();
      },
      // For atom nodes, don't allow internal editing
      stopEvent: () => true,
      ignoreMutation: () => true,
    };
  };
}
```

**Step 2: Commit**

```bash
git add src/editor/lib/react-pm-helpers.js
git commit -m "feat: add React-in-ProseMirror helpers (ReactPopup, createReactNodeView)"
```

---

## Task 4: Create the Suggestion Plugin Factory

Replaces `@tiptap/suggestion`. Used by WikiLinkSuggest, SlashCommand, TagAutocomplete, TaskMentionSuggest, PluginCompletion.

**Files:**
- Create: `src/editor/lib/suggestion-plugin.js`

**Context:** The `@tiptap/suggestion` package creates a PM plugin that watches for a trigger character (e.g., `/`, `[[`, `#`, `@`), extracts a query string, and calls lifecycle hooks (`onStart`, `onUpdate`, `onKeyDown`, `onExit`). Our 5 extensions all use it with this same shape.

**Step 1: Create the suggestion plugin factory**

```js
// src/editor/lib/suggestion-plugin.js
import { Plugin, PluginKey } from 'prosemirror-state';

/**
 * Creates a ProseMirror plugin that triggers suggestions based on a character.
 * Replaces @tiptap/suggestion.
 *
 * Config shape (same as @tiptap/suggestion):
 * {
 *   pluginKey: PluginKey,
 *   char: string,                       // trigger character (e.g. '/')
 *   allowSpaces?: boolean,              // allow spaces in query (default false)
 *   startOfLine?: boolean,              // only trigger at start of line
 *   allowedPrefixes?: (string|null)[],  // chars that can precede the trigger
 *   allow?: ({ state, range }) => bool, // custom gate function
 *   items: ({ query, editor }) => any[], // returns suggestions
 *   command: ({ view, range, props }) => void, // handles selection
 *   render: () => { onStart, onUpdate, onKeyDown, onExit },
 * }
 */
export function createSuggestionPlugin(config) {
  const {
    pluginKey = new PluginKey('suggestion'),
    char = '/',
    allowSpaces = false,
    startOfLine = false,
    allowedPrefixes = null,
    allow = () => true,
    items = () => [],
    command = () => {},
    render = () => ({}),
  } = config;

  const renderer = render();

  function findSuggestionMatch(state) {
    const { $from } = state.selection;
    // Only works with cursor selections (not range)
    if (!state.selection.empty) return null;

    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 500),
      $from.parentOffset,
      null,
      '\ufffc'
    );

    // Find the trigger character
    const triggerIndex = textBefore.lastIndexOf(char);
    if (triggerIndex === -1) return null;

    const query = textBefore.slice(triggerIndex + char.length);

    // Check startOfLine
    if (startOfLine && triggerIndex !== 0) return null;

    // Check spaces
    if (!allowSpaces && query.includes(' ')) return null;

    // Check allowed prefixes
    if (allowedPrefixes !== null) {
      const prefix = triggerIndex === 0 ? null : textBefore[triggerIndex - 1];
      if (!allowedPrefixes.includes(prefix)) return null;
    }

    // Calculate absolute positions
    const from = $from.start() + $from.parentOffset - textBefore.length + triggerIndex;
    const to = $from.pos;
    const range = { from, to };

    if (!allow({ state, range })) return null;

    return { query, range, text: textBefore.slice(triggerIndex) };
  }

  return new Plugin({
    key: pluginKey,

    state: {
      init() {
        return { active: false, query: null, range: null, decorationId: null };
      },
      apply(tr, prev, _oldState, newState) {
        // If the document or selection changed, re-check for suggestions
        if (!tr.docChanged && !tr.selectionSet) return prev;

        const match = findSuggestionMatch(newState);

        if (match && !prev.active) {
          return { active: true, query: match.query, range: match.range };
        }
        if (match && prev.active) {
          return { active: true, query: match.query, range: match.range };
        }
        if (!match && prev.active) {
          return { active: false, query: null, range: null };
        }
        return prev;
      },
    },

    view() {
      return {
        update: (view, prevState) => {
          const prev = pluginKey.getState(prevState);
          const next = pluginKey.getState(view.state);

          const started = !prev.active && next.active;
          const stopped = prev.active && !next.active;
          const changed = prev.active && next.active && prev.query !== next.query;

          if (stopped) {
            renderer.onExit?.();
          }

          if (started) {
            const itemsList = items({ query: next.query, editor: view });
            renderer.onStart?.({
              query: next.query,
              range: next.range,
              items: itemsList,
              clientRect: () => {
                const coords = view.coordsAtPos(next.range.from);
                return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
              },
              command: (props) => command({ view, range: next.range, props }),
              view,
            });
          }

          if (changed) {
            const itemsList = items({ query: next.query, editor: view });
            renderer.onUpdate?.({
              query: next.query,
              range: next.range,
              items: itemsList,
              clientRect: () => {
                const coords = view.coordsAtPos(next.range.from);
                return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
              },
              command: (props) => command({ view, range: next.range, props }),
              view,
            });
          }
        },
        destroy: () => {
          renderer.onExit?.();
        },
      };
    },

    props: {
      handleKeyDown(view, event) {
        const state = pluginKey.getState(view.state);
        if (!state.active) return false;
        return renderer.onKeyDown?.({ event, view }) || false;
      },
    },
  });
}

export { PluginKey };
```

**Step 2: Commit**

```bash
git add src/editor/lib/suggestion-plugin.js
git commit -m "feat: add suggestion plugin factory (replaces @tiptap/suggestion)"
```

---

## Task 5: Create the Floating Menu Plugin

Replaces `BubbleMenu` from `@tiptap/react/menus`. Used by TableBubbleMenu.

**Files:**
- Create: `src/editor/lib/floating-menu-plugin.js`

**Step 1: Create the floating menu plugin**

```js
// src/editor/lib/floating-menu-plugin.js
import { Plugin, PluginKey } from 'prosemirror-state';
import tippy from 'tippy.js/dist/tippy.esm.js';

/**
 * Creates a ProseMirror plugin that shows a floating menu when `shouldShow` returns true.
 * Replaces @tiptap/react's BubbleMenu.
 *
 * Config:
 * {
 *   pluginKey: PluginKey,
 *   element: HTMLElement,         // the menu DOM element to show/hide
 *   shouldShow: (state, view) => boolean,
 *   tippyOptions?: object,        // extra tippy.js options
 * }
 */
export function createFloatingMenuPlugin(config) {
  const {
    pluginKey = new PluginKey('floatingMenu'),
    element,
    shouldShow,
    tippyOptions = {},
  } = config;

  let tippyInstance = null;

  return new Plugin({
    key: pluginKey,

    view(editorView) {
      tippyInstance = tippy(editorView.dom, {
        content: element,
        interactive: true,
        trigger: 'manual',
        placement: 'top',
        offset: [0, 8],
        appendTo: () => document.body,
        ...tippyOptions,
        getReferenceClientRect: () => {
          const { from, to } = editorView.state.selection;
          const start = editorView.coordsAtPos(from);
          const end = editorView.coordsAtPos(to);
          return new DOMRect(
            Math.min(start.left, end.left),
            Math.min(start.top, end.top),
            Math.abs(end.right - start.left),
            Math.abs(end.bottom - start.top)
          );
        },
      });

      return {
        update(view) {
          const show = shouldShow(view.state, view);
          if (show) {
            tippyInstance.show();
          } else {
            tippyInstance.hide();
          }
        },
        destroy() {
          tippyInstance?.destroy();
          tippyInstance = null;
        },
      };
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/editor/lib/floating-menu-plugin.js
git commit -m "feat: add floating menu plugin (replaces @tiptap/react BubbleMenu)"
```

---

## Task 6: Create PM Command Helpers

Replaces `editor.chain().focus().<command>().run()` pattern used in 20+ places outside the editor.

**Files:**
- Create: `src/editor/commands/index.js`

**Context:** TipTap's `editor.chain().focus()` is a fluent API that builds a PM transaction. With raw PM, we dispatch transactions directly. This file provides helper functions so external code doesn't need to know PM internals.

**Step 1: Create the command helpers**

```js
// src/editor/commands/index.js
import { toggleMark } from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import { TextSelection } from 'prosemirror-state';

/**
 * Execute a ProseMirror command on a view, focusing it first.
 * Replaces editor.chain().focus().<cmd>().run()
 */
export function exec(view, command) {
  if (!view) return false;
  view.focus();
  return command(view.state, view.dispatch, view);
}

/**
 * Insert content at the current cursor position.
 * `content` can be a PM Node, Fragment, or JSON object.
 */
export function insertContent(view, content) {
  if (!view) return;
  view.focus();
  const { state } = view;
  const { from, to } = state.selection;
  let node;
  if (content.type && typeof content.type === 'string') {
    // JSON node spec: { type: 'paragraph', content: [...] }
    node = state.schema.nodeFromJSON(content);
  } else {
    node = content;
  }
  const tr = state.tr.replaceWith(from, to, node);
  view.dispatch(tr);
}

/**
 * Insert text content (convenience for inline text insertion).
 */
export function insertText(view, text) {
  if (!view) return;
  view.focus();
  const { from, to } = view.state.selection;
  view.dispatch(view.state.tr.insertText(text, from, to));
}

/**
 * Set the entire document content from a PM doc node or JSON.
 */
export function setContent(view, content, schema) {
  if (!view) return;
  let doc;
  if (content && typeof content === 'object' && content.type === 'doc') {
    doc = schema.nodeFromJSON(content);
  } else if (content && content.type) {
    doc = content;
  } else {
    doc = schema.node('doc', null, [schema.node('paragraph')]);
  }
  const newState = view.state.reconfigure
    ? view.state.apply(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content))
    : view.state;
  // Full document replacement
  const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
  tr.setMeta('programmatic', true);
  view.dispatch(tr);
}

/**
 * Set text selection at given positions.
 */
export function setTextSelection(view, from, to = from) {
  if (!view) return;
  view.focus();
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to));
  view.dispatch(tr);
}

/**
 * Delete the current selection.
 */
export function deleteSelection(view) {
  if (!view) return;
  view.focus();
  const { from, to } = view.state.selection;
  if (from === to) return;
  view.dispatch(view.state.tr.delete(from, to));
}

/**
 * Select all content in the document.
 */
export function selectAll(view) {
  if (!view) return;
  view.focus();
  const tr = view.state.tr.setSelection(
    TextSelection.create(view.state.doc, 0, view.state.doc.content.size)
  );
  view.dispatch(tr);
}

/**
 * Toggle a mark (bold, italic, code, strike, etc.)
 */
export function toggleMarkCommand(view, markName) {
  if (!view) return;
  view.focus();
  const markType = view.state.schema.marks[markName];
  if (!markType) return;
  toggleMark(markType)(view.state, view.dispatch);
}

/**
 * Shortcut helpers for common operations used by useShortcuts.
 * Returns an object with methods matching the TipTap chain commands.
 */
export function createEditorCommands(view) {
  if (!view) return null;

  const schema = view.state.schema;

  return {
    // Marks
    toggleBold: () => exec(view, toggleMark(schema.marks.bold)),
    toggleItalic: () => exec(view, toggleMark(schema.marks.italic)),
    toggleCode: () => exec(view, toggleMark(schema.marks.code)),
    toggleStrike: () => exec(view, toggleMark(schema.marks.strike)),
    toggleHighlight: () => exec(view, toggleMark(schema.marks.highlight)),
    toggleSuperscript: () => exec(view, toggleMark(schema.marks.superscript)),
    toggleSubscript: () => exec(view, toggleMark(schema.marks.subscript)),
    unsetAllMarks: () => {
      view.focus();
      const { from, to } = view.state.selection;
      const tr = view.state.tr;
      Object.values(schema.marks).forEach((markType) => {
        tr.removeMark(from, to, markType);
      });
      view.dispatch(tr);
    },

    // Block nodes
    toggleHeading: (attrs) => {
      view.focus();
      const { $from } = view.state.selection;
      const node = $from.parent;
      const tr = view.state.tr;
      if (node.type === schema.nodes.heading && node.attrs.level === attrs.level) {
        tr.setBlockType($from.before(), $from.after(), schema.nodes.paragraph);
      } else {
        tr.setBlockType($from.before(), $from.after(), schema.nodes.heading, attrs);
      }
      view.dispatch(tr);
    },
    toggleBlockquote: () => {
      view.focus();
      // Use wrapIn/lift pattern
      const { $from } = view.state.selection;
      if ($from.parent.type === schema.nodes.blockquote || $from.depth > 1 && $from.node($from.depth - 1).type === schema.nodes.blockquote) {
        const { lift } = require('prosemirror-commands');
        lift(view.state, view.dispatch);
      } else {
        const { wrapIn } = require('prosemirror-commands');
        wrapIn(schema.nodes.blockquote)(view.state, view.dispatch);
      }
    },
    toggleCodeBlock: () => {
      view.focus();
      const { $from } = view.state.selection;
      const node = $from.parent;
      const tr = view.state.tr;
      if (node.type === schema.nodes.codeBlock) {
        tr.setBlockType($from.before(), $from.after(), schema.nodes.paragraph);
      } else {
        tr.setBlockType($from.before(), $from.after(), schema.nodes.codeBlock);
      }
      view.dispatch(tr);
    },
    toggleBulletList: () => exec(view, wrapInList(schema.nodes.bulletList)),
    toggleOrderedList: () => exec(view, wrapInList(schema.nodes.orderedList)),
    toggleTaskList: () => exec(view, wrapInList(schema.nodes.taskList)),
    setHorizontalRule: () => {
      view.focus();
      const { $from } = view.state.selection;
      const hr = schema.nodes.horizontalRule.create();
      view.dispatch(view.state.tr.replaceSelectionWith(hr));
    },
    insertTable: ({ rows, cols }) => {
      view.focus();
      const { createTable } = require('prosemirror-tables');
      const table = createTable(schema, rows, cols);
      view.dispatch(view.state.tr.replaceSelectionWith(table));
    },

    // Content operations
    insertContent: (content) => insertContent(view, content),
    setContent: (content) => setContent(view, content, schema),
    setTextSelection: ({ from, to }) => setTextSelection(view, from, to),
    deleteSelection: () => deleteSelection(view),
    selectAll: () => selectAll(view),
    scrollIntoView: () => {
      view.dispatch(view.state.tr.scrollIntoView());
    },
    focus: () => view.focus(),

    // History
    undo: () => {
      const { undo } = require('prosemirror-history');
      undo(view.state, view.dispatch);
    },
    redo: () => {
      const { redo } = require('prosemirror-history');
      redo(view.state, view.dispatch);
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/editor/commands/
git commit -m "feat: add PM command helpers (replaces editor.chain().focus() pattern)"
```

---

## Task 7: Create the `useProseMirror` Hook

The core React hook that replaces `useEditor` from `@tiptap/react`. Manages a single EditorView instance via ref.

**Files:**
- Create: `src/editor/hooks/useProseMirror.js`

**Step 1: Create the hook**

```js
// src/editor/hooks/useProseMirror.js
import { useRef, useEffect, useCallback } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

/**
 * React hook that manages a ProseMirror EditorView.
 *
 * The view is created ONCE when the mount ref is set, and NEVER recreated.
 * Tab switches are handled via view.updateState() — no destruction/recreation.
 *
 * This is the fix for the tab-switching content loss bug: the view survives
 * tab switches because it's held in a ref, not in a dependency array.
 *
 * @param {Object} config
 * @param {import('prosemirror-model').Schema} config.schema - The PM schema
 * @param {import('prosemirror-state').Plugin[]} config.plugins - PM plugins array
 * @param {Function} config.onUpdate - Called on every user edit: (view) => void
 * @param {Object} config.nodeViews - PM nodeViews map: { mermaid: nodeViewFactory }
 * @param {Object} config.editorProps - Extra PM EditorProps (handleDOMEvents, attributes, etc.)
 * @param {Function} config.onReady - Called when the view is created: (view) => void
 * @param {Function} config.onDestroy - Called when the view is destroyed: () => void
 * @returns {{ mountRef: Function, viewRef: React.RefObject<EditorView> }}
 */
export function useProseMirror({
  schema,
  plugins = [],
  onUpdate,
  nodeViews = {},
  editorProps = {},
  onReady,
  onDestroy,
}) {
  const viewRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const onReadyRef = useRef(onReady);
  const onDestroyRef = useRef(onDestroy);

  // Keep callback refs current without triggering re-renders
  onUpdateRef.current = onUpdate;
  onReadyRef.current = onReady;
  onDestroyRef.current = onDestroy;

  // Stable mount callback — never changes identity
  const mountRef = useCallback((dom) => {
    // Unmount if previously mounted
    if (viewRef.current) {
      onDestroyRef.current?.();
      viewRef.current.destroy();
      viewRef.current = null;
    }

    if (!dom) return;

    const state = EditorState.create({
      schema,
      plugins,
    });

    const view = new EditorView(dom, {
      state,
      nodeViews,
      ...editorProps,
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);

        // Only call onUpdate for user edits, not programmatic changes
        if (!tr.getMeta('programmatic') && (tr.docChanged || tr.selectionSet)) {
          onUpdateRef.current?.(view);
        }
      },
    });

    viewRef.current = view;
    onReadyRef.current?.(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — mount only happens once via ref callback

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        onDestroyRef.current?.();
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  return { mountRef, viewRef };
}
```

**Step 2: Commit**

```bash
git add src/editor/hooks/useProseMirror.js
git commit -m "feat: add useProseMirror hook (replaces useEditor, fixes tab switching)"
```

---

## Task 8: Replace Editor.jsx Core

The biggest single task. Replaces the TipTap editor with raw ProseMirror.

**Files:**
- Modify: `src/editor/components/Editor.jsx`
- Modify: `src/editor/components/TableBubbleMenu.jsx`

**Context:** Editor.jsx is ~1100 lines. The outer `Editor` component builds extensions, the inner `Tiptap` component creates the editor. We need to:
1. Replace the inner `Tiptap` with a `ProseMirrorEditor` that uses `useProseMirror`
2. Replace the outer `Editor`'s extension-building with PM plugin-building
3. Replace `EditorContent` with a `<div ref={mountRef}>`
4. Remove `isSettingRef` pattern (replaced by `tr.setMeta('programmatic', true)`)
5. Replace `editor.getHTML()` in `handleEditorUpdate` with serializer

**Step 1: Read the full current Editor.jsx**

Read `src/editor/components/Editor.jsx` completely to understand the current structure before modifying.

**Step 2: Replace the inner `Tiptap` component**

The inner component currently:
- Takes `extensions`, `content`, `onContentChange`, `isLoading` props
- Calls `useEditor()` with `[extensions, handleEditorUpdate]` deps (THE BUG)
- Has `isSettingRef` guard
- Renders `<EditorContent editor={editor} />`

Replace with:
- Takes `schema`, `plugins`, `onContentChange`, `nodeViews`, `editorProps` props
- Calls `useProseMirror()` with stable config (NO dependency array recreation)
- Uses `tr.setMeta('programmatic', true)` instead of `isSettingRef`
- Renders `<div ref={mountRef} className="..." />`

Key changes in the component body:

```jsx
// OLD (lines 505-527):
const handleEditorUpdate = useCallback(({ editor }) => {
  if (isSettingRef.current) { isSettingRef.current = false; return; }
  onContentChange(editor.getHTML());
  // ... tag indexing
}, [onContentChange]);

// NEW:
const onContentChangeRef = useRef(onContentChange);
onContentChangeRef.current = onContentChange;

const handleUpdate = useCallback((view) => {
  // No isSettingRef needed — programmatic changes have tr.setMeta('programmatic', true)
  // which means dispatchTransaction never calls this for programmatic edits
  onContentChangeRef.current(view);
  // ... tag indexing (same debounced logic, use view.state.doc.textContent)
}, []);
```

```jsx
// OLD (line 529-722):
const editor = useEditor({ extensions, content, onUpdate: handleEditorUpdate, ... }, [extensions, handleEditorUpdate]);

// NEW:
const { mountRef, viewRef } = useProseMirror({
  schema: lokusSchema,
  plugins,
  onUpdate: handleUpdate,
  nodeViews,
  editorProps: { /* same handleDOMEvents, attributes */ },
  onReady: (view) => { onEditorReady?.(view); },
  onDestroy: () => { onEditorReady?.(null); },
});
```

```jsx
// OLD (lines 819-867 — content sync useEffect):
// DELETED — no longer needed. Content is set imperatively by EditorGroup.

// OLD (lines 1137-1141):
<EditorContent editor={editor} className={...} />

// NEW:
<div ref={mountRef} className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none tiptap-area obsidian-editor" />
```

**Step 3: Replace the outer `Editor` component's extension building**

The outer component currently builds a TipTap extensions array (lines 130-386) in a useEffect. Replace with building a PM plugins array:

- StarterKit extensions → individual PM plugins: `keymap(baseKeymap)`, `history()`, `dropCursor()`, `gapCursor()`
- Each custom extension (WikiLink, Callout, etc.) → PM plugin via its migrated plugin factory
- Input rules → `inputRules({ rules: [...] })`
- The extensions array becomes a `plugins` array + `nodeViews` object

**Step 4: Replace `useImperativeHandle`**

```jsx
// OLD (lines 870-881):
useImperativeHandle(ref, () => ({
  commands: editor?.commands,
  getHTML: () => editor?.getHTML(),
  editor
}), [editor]);

// NEW:
useImperativeHandle(ref, () => ({
  view: viewRef.current,
  state: viewRef.current?.state,
  dispatch: (tr) => viewRef.current?.dispatch(tr),
  getJSON: () => viewRef.current?.state?.doc?.toJSON(),
  getText: () => viewRef.current?.state?.doc?.textContent,
  focus: () => viewRef.current?.focus(),
  ...createEditorCommands(viewRef.current),
}), []);
```

**Step 5: Replace TableBubbleMenu**

Modify `src/editor/components/TableBubbleMenu.jsx`:
- Remove `import { BubbleMenu } from "@tiptap/react/menus"`
- Use `createFloatingMenuPlugin` from Task 5 instead
- The component becomes a PM plugin that renders a React element via `ReactPopup`
- The `shouldShow` logic checks `state.selection` for table context

**Step 6: Verify the editor renders**

```bash
npm run dev
```

Open a markdown file. Verify:
- Text renders in the editor
- Basic typing works
- Bold/italic/code formatting works
- No console errors about TipTap

**Step 7: Commit**

```bash
git add src/editor/components/Editor.jsx src/editor/components/TableBubbleMenu.jsx
git commit -m "feat: replace TipTap useEditor with raw ProseMirror EditorView"
```

---

## Task 9: Update EditorGroup.jsx

Adapt EditorGroup to work with the raw PM view instead of TipTap editor.

**Files:**
- Modify: `src/components/EditorGroup.jsx`

**Step 1: Read the current file**

Read `src/components/EditorGroup.jsx` completely.

**Step 2: Update `handleContentChange`**

```jsx
// OLD (lines 307-314):
const handleContentChange = useCallback((newContent) => {
  const store = useEditorGroupStore.getState();
  store.setTabContent(group.id, activeFile, { html: newContent });  // stores HTML
  store.markTabDirty(group.id, activeFile, saved !== undefined && newContent !== saved);
}, [group.id, activeFile]);

// NEW — receives the EditorView, not HTML:
const handleContentChange = useCallback((view) => {
  const store = useEditorGroupStore.getState();
  const grp = store.findGroup(group.id);
  const activeTab = grp?.activeTab;
  if (!activeTab) return;

  // Snapshot current doc as JSON (cheap, no HTML)
  const json = view.state.doc.toJSON();
  store.setTabContent(group.id, activeTab, { json });

  // Dirty check: serialize to md and compare with saved source
  const saved = grp?.contentByTab?.[activeTab]?.savedContent;
  if (saved !== undefined) {
    const currentMd = lokusSerializerRef.current.serialize(view.state.doc);
    store.markTabDirty(group.id, activeTab, currentMd !== saved);
  }
}, [group.id]);
// NOTE: activeFile removed from deps — uses store's activeTab instead
```

**Step 3: Update `snapshotTabJSON`**

```jsx
// OLD (line 128-133):
const json = editor.getJSON();

// NEW — uses the raw PM view:
const snapshotTabJSON = useCallback((filePath) => {
  const view = rawEditorRef.current;  // now an EditorView, not TipTap editor
  if (!view || !filePath || filePath.startsWith('__') || filePath.endsWith('.canvas')) return;
  const json = view.state.doc.toJSON();
  useEditorGroupStore.getState().setTabContent(group.id, filePath, { json });
}, [group.id]);
```

**Step 4: Update `setEditorContent`**

```jsx
// OLD (line 116-122):
editor.commands.setContent(content, { parseOptions: { preserveWhitespace: 'full' } });

// NEW — uses PM state replacement:
const setEditorContent = useCallback((content) => {
  const view = rawEditorRef.current;
  if (!view) return;

  let doc;
  if (content && typeof content === 'object') {
    // JSON → PM Node
    doc = view.state.schema.nodeFromJSON(content);
  } else if (typeof content === 'string') {
    // Markdown → PM Node (shouldn't happen often, but fallback)
    doc = lokusParserRef.current.parse(content);
  } else {
    return;
  }

  const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
  tr.setMeta('programmatic', true);
  view.dispatch(tr);
}, []);
```

**Step 5: Update `handleEditorReady`**

```jsx
// OLD — receives TipTap editor, calls editor.commands.setContent
// NEW — receives PM EditorView:
const handleEditorReady = useCallback((view) => {
  rawEditorRef.current = view;

  if (view) {
    registerEditor(group.id, view);

    if (!lokusParserRef.current) {
      lokusParserRef.current = createLokusParser(view.state.schema);
    }
    if (!lokusSerializerRef.current) {
      lokusSerializerRef.current = createLokusSerializer();
    }

    // Apply cached content if available
    const file = prevActiveFileRef.current;
    if (file && !file.startsWith('__') && !file.endsWith('.canvas')) {
      const cached = useEditorGroupStore.getState().findGroup(group.id)?.contentByTab?.[file];
      if (cached?.json) {
        setEditorContent(cached.json);
      }
    }
  } else {
    registerEditor(group.id, null);
  }
}, [group.id, setEditorContent]);
```

**Step 6: Update the tab-switching effect**

The tab switching effect (lines 137-232) is mostly fine. Changes:
- Remove the HTML cache fallback (Case B: `cached?.html`) — only JSON cache or disk load
- All `editor.commands.setContent()` → `setEditorContent()` (already called, just verify)

**Step 7: Remove `content=""` and `isLoading={false}` props from `<Editor>`**

```jsx
// OLD:
<Editor ref={editorHandleRef} content="" onContentChange={handleContentChange} isLoading={false} />

// NEW:
<Editor ref={editorHandleRef} onContentChange={handleContentChange} onEditorReady={handleEditorReady} />
```

**Step 8: Verify tab switching works**

```bash
npm run dev
```

1. Open 3 files with content
2. Switch between tabs rapidly
3. Verify NO content loss (the original bug)
4. Verify dirty indicator works correctly

**Step 9: Commit**

```bash
git add src/components/EditorGroup.jsx
git commit -m "feat: update EditorGroup for raw ProseMirror (fixes tab switching bug)"
```

---

## Task 10: Port Trivial Extensions

Port the 7 simplest extensions. These are already using raw PM `Plugin` internally — they just need their `Extension.create()` wrapper replaced with a plain function that returns a PM `Plugin`.

**Files:**
- Modify: `src/editor/extensions/BlockId.js`
- Modify: `src/editor/extensions/TaskSyntaxHighlight.js`
- Modify: `src/editor/extensions/Folding.js`
- Modify: `src/editor/extensions/MarkdownPaste.js`
- Modify: `src/editor/extensions/MarkdownTablePaste.js`
- Modify: `src/editor/extensions/PluginHover.js`
- Modify: `src/editor/extensions/TaskCreationTrigger.js`

**Pattern for each file:**

```js
// OLD:
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const MyExtension = Extension.create({
  name: 'myExtension',
  addProseMirrorPlugins() {
    return [new Plugin({ ... })];
  },
});

// NEW:
import { Plugin, PluginKey } from 'prosemirror-state';

export function createMyExtensionPlugin(/* config if needed */) {
  return new Plugin({ ... });
}
```

**Step 1: Port each extension**

For each file, the transformation is mechanical:
1. Change `@tiptap/pm/state` → `prosemirror-state`
2. Change `@tiptap/pm/view` → `prosemirror-view`
3. Remove `Extension.create()` wrapper
4. Export a function that returns `Plugin` (or `Plugin[]`)
5. Replace `this.editor` references with the `view` parameter where needed

**Special case: MarkdownPaste.js**
- Currently imports the old `compiler.js` to convert pasted markdown to HTML
- Replace with `lokus-md-pipeline`'s parser to convert pasted md directly to PM doc slice
- This eliminates the last md→HTML→TipTap conversion path

```js
// OLD in MarkdownPaste.js:
import MarkdownCompiler from '../../core/markdown/compiler.js';
const compiler = new MarkdownCompiler();
// ... handler:
const html = compiler.compile(text);
editor.commands.insertContent(html);

// NEW:
import { createLokusParser } from '../../core/markdown/lokus-md-pipeline.js';
// ... handler:
const doc = parser.parse(text);
const slice = doc.slice(1, doc.content.size - 1); // trim doc wrapper
view.dispatch(view.state.tr.replaceSelection(slice));
```

**Step 2: Update imports in Editor.jsx**

After porting each extension, update its import in `Editor.jsx`'s plugin-building code to use the new function-based exports.

**Step 3: Verify paste and decorations work**

```bash
npm run dev
```

1. Paste markdown text → should render as formatted content
2. Block IDs should auto-generate on new paragraphs
3. Task syntax highlighting should still work
4. Heading folding should still work

**Step 4: Commit**

```bash
git add src/editor/extensions/BlockId.js src/editor/extensions/TaskSyntaxHighlight.js \
  src/editor/extensions/Folding.js src/editor/extensions/MarkdownPaste.js \
  src/editor/extensions/MarkdownTablePaste.js src/editor/extensions/PluginHover.js \
  src/editor/extensions/TaskCreationTrigger.js src/editor/components/Editor.jsx
git commit -m "feat: port 7 trivial extensions to raw ProseMirror plugins"
```

---

## Task 11: Port Moderate Extensions

Port 8 extensions that define custom nodes/marks with schema, commands, input rules, and keyboard shortcuts.

**Files:**
- Modify: `src/editor/extensions/Callout.js`
- Modify: `src/editor/extensions/WikiLink.js`
- Modify: `src/editor/extensions/WikiLinkEmbed.js`
- Modify: `src/editor/extensions/CanvasLink.js`
- Modify: `src/editor/extensions/CustomCodeBlock.js`
- Modify: `src/editor/extensions/CodeBlockIndent.js`
- Modify: `src/editor/extensions/MathSnippets.js`
- Modify: `src/editor/extensions/SymbolShortcuts.js`

**Pattern for node extensions (Callout, WikiLink, WikiLinkEmbed, CanvasLink):**

With raw PM, the schema is defined in `lokus-schema.js` (Task 2), not in the extension. So node extensions become:
1. Input rules → exported as `inputRules` plugin via `prosemirror-inputrules`
2. Commands → exported as plain functions
3. Keyboard shortcuts → exported as `keymap` plugin
4. DOM events → exported as PM plugin with `handleDOMEvents`

```js
// OLD (Callout.js):
import { Node, InputRule } from '@tiptap/core';
export const Callout = Node.create({
  name: 'callout',
  group: 'block', content: 'block+', defining: true,
  addAttributes() { ... },
  parseHTML() { ... },
  renderHTML() { ... },
  addCommands() { ... },
  addKeyboardShortcuts() { ... },
  addInputRules() { ... },
  addProseMirrorPlugins() { ... },
});

// NEW (Callout.js):
import { Plugin, PluginKey } from 'prosemirror-state';
import { InputRule, inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';

// Schema is in lokus-schema.js — no schema definition here

export function createCalloutPlugins(schema) {
  const calloutInputRule = new InputRule(
    /^>\[!(\w+)\](-?)\s*(.*)$/,
    (state, match, start, end) => { /* same handler, using state.tr directly */ }
  );

  return [
    inputRules({ rules: [calloutInputRule] }),
    keymap({
      'Mod-Alt-c': (state, dispatch) => { /* create callout node */ },
    }),
    new Plugin({
      key: new PluginKey('callout-click-handler'),
      props: {
        handleDOMEvents: {
          click: (view, event) => { /* toggle collapsed */ }
        }
      }
    }),
  ];
}
```

**Pattern for behavior-only extensions (CodeBlockIndent, MathSnippets, SymbolShortcuts):**

These just provide keyboard shortcuts or input rules, no schema changes:

```js
// NEW (CodeBlockIndent.js):
import { keymap } from 'prosemirror-keymap';

export function createCodeBlockIndentPlugin(schema) {
  return keymap({
    Tab: (state, dispatch) => { /* indent in code block */ },
    'Shift-Tab': (state, dispatch) => { /* dedent in code block */ },
  });
}
```

**Step 1: Port each extension one at a time**

For each file:
1. Remove `Node.create()` / `Extension.create()` wrapper
2. Move schema parts to `lokus-schema.js` if not already there
3. Convert `addCommands()` to exported functions
4. Convert `addInputRules()` to `inputRules()` plugin
5. Convert `addKeyboardShortcuts()` to `keymap()` plugin
6. Convert `addProseMirrorPlugins()` to exported plugin array
7. Replace `this.editor` with function parameters

**Step 2: Wire into Editor.jsx plugin array**

Update Editor.jsx to import the new plugin creators and add their results to the plugins array.

**Step 3: Verify each node type works**

For each ported extension, verify:
- Callout: type `>[!note]` on a new line → callout appears
- WikiLink: type `[[` → suggestion appears (separate task, but node renders)
- WikiLinkEmbed: existing embeds render correctly
- CanvasLink: existing links render
- Code blocks: syntax highlighting, Tab indent works
- Math: `$...$` renders inline math
- Symbol shortcuts: custom symbol input rules work

**Step 4: Commit**

```bash
git add src/editor/extensions/Callout.js src/editor/extensions/WikiLink.js \
  src/editor/extensions/WikiLinkEmbed.js src/editor/extensions/CanvasLink.js \
  src/editor/extensions/CustomCodeBlock.js src/editor/extensions/CodeBlockIndent.js \
  src/editor/extensions/MathSnippets.js src/editor/extensions/SymbolShortcuts.js \
  src/editor/components/Editor.jsx
git commit -m "feat: port 8 moderate extensions to raw ProseMirror plugins"
```

---

## Task 12: Port Suggestion-Based Extensions

Port the 5 extensions that use `@tiptap/suggestion` to use our new suggestion plugin factory (Task 4).

**Files:**
- Modify: `src/editor/lib/WikiLinkSuggest.js`
- Modify: `src/editor/lib/SlashCommand.js`
- Modify: `src/editor/lib/slash-command.jsx`
- Modify: `src/editor/extensions/TagAutocomplete.js`
- Modify: `src/editor/extensions/TaskMentionSuggest.js`
- Modify: `src/editor/extensions/PluginCompletion.js`

**Pattern:** Replace `@tiptap/suggestion` with our `createSuggestionPlugin`, and replace `ReactRenderer` with our `ReactPopup`.

**Step 1: Port SlashCommand (simplest suggestion)**

```js
// OLD (SlashCommand.js):
import { Extension } from '@tiptap/core';
import * as suggestionMod from '@tiptap/suggestion';
const suggestion = suggestionMod.default ?? suggestionMod;

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [suggestion({ editor: this.editor, char: '/', ... })];
  },
});

// NEW (SlashCommand.js):
import { createSuggestionPlugin, PluginKey } from './suggestion-plugin.js';

export function createSlashCommandPlugin(config) {
  return createSuggestionPlugin({
    pluginKey: new PluginKey('slashCommandSuggestion'),
    char: '/',
    ...config,  // items, render from slash-command.jsx
  });
}
```

```jsx
// OLD (slash-command.jsx render):
import { ReactRenderer } from "@tiptap/react";
component = new ReactRenderer(SlashCommandList, { props, editor: props.editor });

// NEW:
import { ReactPopup } from './react-pm-helpers.js';
component = new ReactPopup(SlashCommandList, enhancedProps);
// ...
component.updateProps(newProps);  // same API
component.ref?.onKeyDown(props);  // same API
component.destroy();  // same API
```

**Step 2: Port WikiLinkSuggest (most complex)**

WikiLinkSuggest returns 5 PM plugins. Transform each `suggestion()` call to `createSuggestionPlugin()`. Replace all 4 `new ReactRenderer(...)` with `new ReactPopup(...)`.

The manual DOM positioning code (creating `container`, appending to `document.body`) stays the same — it doesn't depend on TipTap at all.

Key change: `this.editor` references need to become parameters. Since WikiLinkSuggest creates its plugins in `addProseMirrorPlugins()`, we change it to a function that receives the necessary context:

```js
// NEW:
export function createWikiLinkSuggestPlugins({ fileIndex, imageIndex, workspacePath }) {
  return [
    // Plugin 0: paste handler (already raw PM Plugin)
    new Plugin({ ... }),
    // Plugin 1: [[ file linking
    createSuggestionPlugin({ char: '[', allowedPrefixes: [' ', '!', '[', null], ... }),
    // Plugin 2: ![[  image embeds
    createSuggestionPlugin({ char: '[', allowedPrefixes: ['!'], ... }),
    // Plugin 3: ![ canvas embeds
    createSuggestionPlugin({ char: '[', allowedPrefixes: ['!'], ... }),
    // Plugin 4: ^ block references
    createSuggestionPlugin({ char: '^', ... }),
  ];
}
```

**Step 3: Port TagAutocomplete, TaskMentionSuggest, PluginCompletion**

Same pattern as SlashCommand. Each becomes:
```js
export function createTagAutocompletePlugin(config) {
  return createSuggestionPlugin({
    pluginKey: new PluginKey('tagAutocompleteSuggestion'),
    char: '#',
    ...config,
  });
}
```

**Step 4: Wire all suggestion plugins into Editor.jsx**

Add the suggestion plugins to the plugins array in Editor.jsx, passing required context (file index, workspace path, etc.).

**Step 5: Verify all suggestions work**

```bash
npm run dev
```

1. Type `/` → slash command menu appears
2. Type `[[` → wiki link suggestions appear
3. Type `#` → tag autocomplete appears
4. Type `@` → task mention suggestions appear
5. Navigate suggestions with arrow keys
6. Select a suggestion with Enter
7. Press Escape to dismiss

**Step 6: Commit**

```bash
git add src/editor/lib/WikiLinkSuggest.js src/editor/lib/SlashCommand.js \
  src/editor/lib/slash-command.jsx src/editor/extensions/TagAutocomplete.js \
  src/editor/extensions/TaskMentionSuggest.js src/editor/extensions/PluginCompletion.js \
  src/editor/components/Editor.jsx
git commit -m "feat: port 5 suggestion extensions to use suggestion plugin factory"
```

---

## Task 13: Port MermaidDiagram

Uses `ReactNodeViewRenderer` — needs our `createReactNodeView` helper (Task 3).

**Files:**
- Modify: `src/editor/extensions/MermaidDiagram.jsx`
- Modify: `src/editor/lib/Mermaid.jsx`

**Step 1: Update MermaidDiagram**

```jsx
// OLD:
import { Node, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MermaidComponent from '../lib/Mermaid';

const MermaidDiagram = Node.create({
  name: 'mermaid',
  addNodeView() { return ReactNodeViewRenderer(MermaidComponent); },
  addInputRules() { ... },
});

// NEW:
import { InputRule, inputRules } from 'prosemirror-inputrules';
import { createReactNodeView } from '../lib/react-pm-helpers.js';
import MermaidComponent from '../lib/Mermaid';

// Schema is in lokus-schema.js — no schema here

export const mermaidNodeView = createReactNodeView(MermaidComponent);

export function createMermaidInputRulesPlugin(schema) {
  return inputRules({
    rules: [
      new InputRule(/^``mm$/, (state, match, start, end) => {
        const mermaidNode = schema.nodes.mermaid.create({ code: '' });
        return state.tr.replaceWith(start, end, mermaidNode);
      }),
    ],
  });
}
```

**Step 2: Update Mermaid.jsx**

```jsx
// OLD:
import { NodeViewWrapper } from "@tiptap/react";
const MermaidComponent = ({ node, updateAttributes, editor }) => {
  return <NodeViewWrapper>...</NodeViewWrapper>;
};

// NEW — no NodeViewWrapper needed, the div IS the node view:
const MermaidComponent = ({ node, view, getPos, updateAttributes, selected }) => {
  // Remove <NodeViewWrapper>, render content directly
  // updateAttributes works the same way (provided by createReactNodeView)
  return <div className="mermaid-node-view">...</div>;
};
```

**Step 3: Wire into Editor.jsx**

Add `mermaidNodeView` to the `nodeViews` object passed to `useProseMirror`:
```js
const nodeViews = {
  mermaid: mermaidNodeView,
};
```

Add `createMermaidInputRulesPlugin(schema)` to the plugins array.

**Step 4: Verify mermaid diagrams render**

1. Open a file with a mermaid code block
2. Verify the diagram renders
3. Type ` ``mm ` on a new line → mermaid block appears
4. Edit the mermaid code → diagram updates

**Step 5: Commit**

```bash
git add src/editor/extensions/MermaidDiagram.jsx src/editor/lib/Mermaid.jsx src/editor/components/Editor.jsx
git commit -m "feat: port MermaidDiagram to raw ProseMirror NodeView"
```

---

## Task 14: Update External Consumers — EditorAPI.js

The central plugin API. 2048 lines, but changes are systematic.

**Files:**
- Modify: `src/plugins/api/EditorAPI.js`

**Context:** `EditorAPI` stores `this.editorInstance` which is currently a TipTap editor. After migration, it will be a PM EditorView. The TipTap-specific APIs used are:

| TipTap API | PM Replacement |
|---|---|
| `editor.getHTML()` | `lokusSerializer.serialize(view.state.doc)` |
| `editor.getText()` | `view.state.doc.textContent` |
| `editor.commands.setContent(c)` | `setContent(view, c, schema)` from commands |
| `editor.commands.insertContent(c)` | `insertContent(view, c)` from commands |
| `editor.commands.setTextSelection({from,to})` | `setTextSelection(view, from, to)` from commands |
| `editor.chain().focus().deleteRange(...).insertContentAt(...).run()` | Direct PM transaction |
| `editor.state.selection` | `view.state.selection` (same) |
| `editor.state.doc.textBetween()` | `view.state.doc.textBetween()` (same) |
| `editor.view` | `view` (IS the view now) |
| `editor.on('update')` | Custom event via `dispatchTransaction` |
| `editor.destroy()` | `view.destroy()` |
| `Node.create()`, `Mark.create()`, `Extension.create()` | New plugin factory APIs |

**Step 1: Read EditorAPI.js and identify all TipTap API calls**

Read the file. The investigation agent found 30+ usage sites.

**Step 2: Update `getContent()` (line 186)**

```js
// OLD:
return this.editorInstance.getHTML()
// NEW:
const serializer = createLokusSerializer();
return serializer.serialize(this.editorInstance.state.doc);
```

**Step 3: Update `setContent()` (line 196)**

```js
// OLD:
this.editorInstance.commands.setContent(content)
// NEW:
import { setContent } from '../../editor/commands/index.js';
setContent(this.editorInstance, content, this.editorInstance.state.schema);
```

**Step 4: Update `insertContent()` (line 208)**

```js
// OLD:
this.editorInstance.commands.insertContent(content)
// NEW:
import { insertContent } from '../../editor/commands/index.js';
insertContent(this.editorInstance, content);
```

**Step 5: Update remaining TipTap API calls systematically**

Go through each of the ~30 usage sites and apply the corresponding PM replacement.

**Step 6: Update `createSecureNode/Mark/Extension` factories**

These create TipTap extensions for third-party plugins. They need to be rewritten to create PM plugins instead. This is the most complex part:

```js
// OLD:
createSecureNode(config) {
  return Node.create({ name: config.name, ... });
}

// NEW:
createSecureNode(config) {
  // Returns { nodeSpec, plugins } — nodeSpec must be merged into schema,
  // plugins are added to the editor
  // For dynamic plugins loaded at runtime, we need a plugin registration system
  // that adds plugins without recreating the view
  return {
    nodeSpec: { /* PM node spec from config */ },
    plugins: [ /* input rules, keymaps, nodeViews from config */ ],
  };
}
```

**Step 7: Update `setEditorInstance` event wiring**

```js
// OLD:
editor.on('update', () => { this.emit('editor-update') });
editor.on('selectionUpdate', () => { this.emit('editor-selection-update') });

// NEW — these events come from dispatchTransaction now.
// EditorAPI listens for custom events dispatched by the editor component.
```

**Step 8: Verify plugin system works**

1. Open Settings → Plugins
2. Verify installed plugins still function
3. Check plugin slash commands appear in `/` menu

**Step 9: Commit**

```bash
git add src/plugins/api/EditorAPI.js
git commit -m "feat: adapt EditorAPI to raw ProseMirror EditorView"
```

---

## Task 15: Update External Consumers — useShortcuts.js

**Files:**
- Modify: `src/features/shortcuts/hooks/useShortcuts.js`

**Step 1: Replace all `.chain().focus().*` patterns**

Every shortcut currently does:
```js
getFocusedEditor()?.chain?.().focus().<command>().run()
```

Replace with:
```js
import { createEditorCommands } from '../../../editor/commands/index.js';

// In each shortcut handler:
const view = getFocusedEditor();
const cmds = createEditorCommands(view);
cmds?.toggleBold();  // or whatever command
```

The `createEditorCommands` function (Task 6) returns an object with the same method names, so the migration is 1:1.

**Step 2: Update `getFocusedEditor`**

```js
// OLD: Returns TipTap editor
function getFocusedEditor() {
  const { focusedGroupId } = useEditorGroupStore.getState();
  return getEditor(focusedGroupId);  // returns TipTap editor
}

// NEW: Returns PM EditorView (editorRegistry now stores views)
// No change needed — editorRegistry was updated to store EditorView
```

**Step 3: Commit**

```bash
git add src/features/shortcuts/hooks/useShortcuts.js
git commit -m "feat: update useShortcuts to use PM command helpers"
```

---

## Task 16: Update Remaining External Consumers

**Files:**
- Modify: `src/plugins/api/PluginBridge.js`
- Modify: `src/views/workspace/ModalLayer.jsx`
- Modify: `src/features/workspace/useWorkspaceEvents.js`
- Modify: `src/features/workspace/useWorkspaceSession.js`
- Modify: `src/features/file-tree/hooks/useFileOperations.js`
- Modify: `src/core/clipboard/index.js`
- Modify: `src/core/clipboard/shortcuts.js`
- Modify: `src/features/tabs/hooks/useTabs.js`
- Modify: `src/components/DocumentOutline.jsx`
- Modify: `src/components/InFileSearch.jsx`

**Step 1: PluginBridge.js**

Replace `editor.chain().focus().insertContent(...)` with `insertContent(view, ...)`.
Replace `editor.getText()` with `view.state.doc.textContent`.

**Step 2: ModalLayer.jsx**

Replace `editorInstance.chain().focus().insertContent(content).run()` with `insertContent(view, content)`.

**Step 3: useWorkspaceEvents.js**

- Replace `document.querySelector('.tiptap.ProseMirror')` with `document.querySelector('.ProseMirror')` (PM uses this class by default)
- Replace `editor.chain().focus().insertContent(content).run()` with PM commands

**Step 4: useWorkspaceSession.js**

Replace `editor.chain().focus().insertContent({ type: 'paragraph' }).run()` with PM transaction.

**Step 5: useFileOperations.js**

Replace `editor.getHTML()` (lines 290, 301) with `lokusSerializer.serialize(view.state.doc)`.

**Step 6: clipboard/index.js**

Replace `editor.getHTML()` (lines 108, 113) with serializer.
Note: line 113 (`editor.getHTML().slice(from, to)`) is already buggy (HTML offsets ≠ PM offsets). Fix properly: use `view.state.doc.slice(from, to)` and serialize the slice.

**Step 7: clipboard/shortcuts.js**

Replace `editor.commands.selectTextblockStart()`, `.selectTextblockEnd()`, `.deleteSelection()` with PM command equivalents.

**Step 8: useTabs.js**

Replace `editor.commands.scrollIntoView()` with `view.dispatch(view.state.tr.scrollIntoView())`.

**Step 9: DocumentOutline.jsx**

Replace `editor.commands.focus()` and `editor.commands.setTextSelection(pos)` with PM commands.

**Step 10: InFileSearch.jsx**

The `@tiptap/pm/state` import → `prosemirror-state`. The `TextSelection` import is the same.
Replace `editor.commands.scrollIntoView()` with PM transaction.

**Step 11: Verify all consumers work**

1. Keyboard shortcuts work (Ctrl+B, Ctrl+I, etc.)
2. Slash command insertions work
3. Plugin insertions work
4. Copy/paste works
5. Document outline navigation works
6. In-file search works
7. Modal insertions work (template picker, etc.)

**Step 12: Commit**

```bash
git add src/plugins/api/PluginBridge.js src/views/workspace/ModalLayer.jsx \
  src/features/workspace/useWorkspaceEvents.js src/features/workspace/useWorkspaceSession.js \
  src/features/file-tree/hooks/useFileOperations.js src/core/clipboard/index.js \
  src/core/clipboard/shortcuts.js src/features/tabs/hooks/useTabs.js \
  src/components/DocumentOutline.jsx src/components/InFileSearch.jsx
git commit -m "feat: update all external editor consumers to raw ProseMirror"
```

---

## Task 17: Replace All Remaining getHTML() Calls

**Files:**
- Modify: `src/features/editor/hooks/useSave.js`
- Any remaining files from Task 16

**Step 1: Update useSave.js**

The primary save path (line 59) already uses `lokusSerializer.serialize(editor.state.doc)` — no change needed.

The Save-As paths (lines 133, 155) use `editor.getHTML()` for HTML/JSON export formats:

```js
// Line 133 — HTML export:
// OLD: const htmlContent = editor.getHTML();
// NEW: We still need HTML for HTML export. Generate from PM doc:
import { DOMSerializer } from 'prosemirror-model';
const fragment = DOMSerializer.fromSchema(editor.state.schema).serializeFragment(editor.state.doc.content);
const div = document.createElement('div');
div.appendChild(fragment);
const htmlContent = div.innerHTML;

// Line 155 — JSON export:
// OLD: content: editor.getHTML()
// NEW: content: lokusSerializer.serialize(editor.state.doc)
// (Export markdown, not HTML — more useful)
```

**Step 2: Verify save works**

1. Edit a file, press Ctrl+S → file saves correctly
2. Reopen the file → content matches
3. Save-As in different formats works

**Step 3: Commit**

```bash
git add src/features/editor/hooks/useSave.js
git commit -m "feat: replace getHTML() in save hooks with PM serializer"
```

---

## Task 18: Delete Dead Code

Remove code that's no longer needed.

**Files:**
- Delete: `src/editor/extensions/SimpleTask.js`
- Delete: `src/editor/extensions/SmartTask.js`
- Delete: `src/editor/extensions/HeadingAltInput.js`
- Delete: `src/editor/extensions/TaskMarkdownInput.js`
- Delete: `src/editor/extensions/Template.js`
- Delete: `src/core/markdown/compiler.js`
- Delete: `src/core/markdown/compiler-logic.js`
- Delete: `src/core/export/markdown-exporter.js`

**Step 1: Verify each file is actually unused**

Search for imports of each file:

```bash
grep -r "SimpleTask\|SmartTask\|HeadingAltInput\|TaskMarkdownInput\|Template" src/ --include="*.js" --include="*.jsx" -l
grep -r "compiler\.js\|compiler-logic" src/ --include="*.js" --include="*.jsx" -l
grep -r "markdown-exporter" src/ --include="*.js" --include="*.jsx" -l
```

If any file is still imported, update the import site first.

**Step 2: Delete the files**

```bash
rm src/editor/extensions/SimpleTask.js src/editor/extensions/SmartTask.js \
   src/editor/extensions/HeadingAltInput.js src/editor/extensions/TaskMarkdownInput.js \
   src/editor/extensions/Template.js src/core/markdown/compiler.js \
   src/core/markdown/compiler-logic.js src/core/export/markdown-exporter.js
```

**Step 3: Remove imports from Editor.jsx if any remain**

Check if any deleted extension was imported (HeadingAltInput was imported but commented out).

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete dead extensions and legacy HTML compiler/exporter"
```

---

## Task 19: Remove TipTap Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Verify no TipTap imports remain**

```bash
grep -r "@tiptap/" src/ --include="*.js" --include="*.jsx" -l
```

Expected: NO results. If any files still import `@tiptap/*`:
- `@tiptap/pm/state` → `prosemirror-state`
- `@tiptap/pm/view` → `prosemirror-view`
- `@tiptap/pm/model` → `prosemirror-model`
- `@tiptap/pm/inputrules` → `prosemirror-inputrules`
- Fix them first.

**Step 2: Uninstall TipTap packages**

```bash
npm uninstall @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/suggestion \
  @tiptap/pm @tiptap/extension-code-block-lowlight @tiptap/extension-highlight \
  @tiptap/extension-horizontal-rule @tiptap/extension-image @tiptap/extension-link \
  @tiptap/extension-placeholder @tiptap/extension-strike @tiptap/extension-subscript \
  @tiptap/extension-superscript @tiptap/extension-table @tiptap/extension-table-cell \
  @tiptap/extension-table-header @tiptap/extension-table-row @tiptap/extension-task-item \
  @tiptap/extension-task-list @aarkue/tiptap-math-extension
```

**Step 3: Also uninstall tiptap-related peer deps if orphaned**

Check if any remaining packages depend on removed tiptap packages.

**Step 4: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds with no import errors.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove all @tiptap/* dependencies"
```

---

## Task 20: Update Tests

**Files:**
- Modify: `src/editor/components/Editor.test.jsx`
- Modify: `src/editor/extensions/WikiLink.test.js`
- Modify: `src/editor/extensions/Callout.test.js`
- Modify: `src/editor/extensions/SmartTask.test.js` (delete — extension deleted)
- Modify: `src/core/search/index.test.js`
- Any other test files that reference TipTap

**Step 1: Find all test files with TipTap references**

```bash
grep -r "@tiptap\|useEditor\|ReactRenderer\|EditorContent" src/ --include="*.test.*" -l
```

**Step 2: Update Editor.test.jsx**

Replace TipTap test setup with PM EditorView:
```js
// OLD:
import { useEditor, EditorContent } from '@tiptap/react';
// mock setup with TipTap extensions

// NEW:
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { lokusSchema } from '../schema/lokus-schema.js';

function createTestView(doc) {
  const state = EditorState.create({ schema: lokusSchema, doc });
  return new EditorView(document.createElement('div'), { state });
}
```

**Step 3: Update extension tests**

Replace `editor.getHTML()` assertions with PM doc assertions:
```js
// OLD: expect(editor.getHTML()).toContain('<span data-wiki-link');
// NEW: expect(view.state.doc.firstChild.type.name).toBe('wikiLink');
```

**Step 4: Delete SmartTask.test.js** (extension was deleted)

**Step 5: Run all tests**

```bash
npm test
```

Fix any failures.

**Step 6: Commit**

```bash
git add -A
git commit -m "test: update editor tests for raw ProseMirror"
```

---

## Task 21: Update CSS

**Files:**
- Modify: `src/styles/fluid-ux.css`
- Modify: `src/editor/styles/editor.css`

**Step 1: Update CSS selectors**

ProseMirror uses `.ProseMirror` class on the editor div (no `.tiptap` prefix).

```css
/* OLD: .tiptap.ProseMirror { ... } */
/* NEW: .ProseMirror { ... } */
```

The class `tiptap-area` is set via `editorProps.attributes.class` in Editor.jsx. Keep it if other CSS depends on it, or rename to `lokus-editor` for clarity.

**Step 2: Verify editor styling is correct**

Visual check: text size, spacing, colors, selection highlight, cursor appearance.

**Step 3: Commit**

```bash
git add src/styles/ src/editor/styles/
git commit -m "style: update CSS selectors for raw ProseMirror (remove .tiptap prefix)"
```

---

## Task 22: Integration Testing & Final Verification

**Files:** None (testing only)

**Step 1: Round-trip test**

Create a test file with ALL supported syntax:
- Headings (1-6)
- Bold, italic, code, strike, highlight, superscript, subscript
- Links
- Images
- Bullet list, ordered list, task list
- Code block with language
- Blockquote
- Horizontal rule
- Table (3x3)
- Wiki link `[[target]]`
- Wiki link embed `![[file]]`
- Canvas link `![[name.canvas]]`
- Callout `> [!note] Title`
- Mermaid diagram
- Inline math `$x^2$`
- Block math `$$\sum_{i=1}^n$$`
- Block ID `^blockid`

Open the file → save without edits → diff against original. Should be identical.

**Step 2: Tab switching stress test**

1. Open 5 files with different content
2. Switch between all tabs rapidly (Cmd+1-5)
3. Verify NO content loss or mixing
4. Edit each file, switch away and back
5. Verify edits persist

**Step 3: Full feature verification**

- [ ] Basic editing (type, delete, undo, redo)
- [ ] Formatting shortcuts (Ctrl+B, Ctrl+I, etc.)
- [ ] Slash command menu (`/`)
- [ ] Wiki link suggestion (`[[`)
- [ ] Tag autocomplete (`#`)
- [ ] Task mention (`@`)
- [ ] Code block with syntax highlighting
- [ ] Mermaid diagram rendering
- [ ] Table editing + bubble menu
- [ ] Callout creation
- [ ] Markdown paste
- [ ] Copy/paste
- [ ] File save (Ctrl+S)
- [ ] Document outline navigation
- [ ] In-file search
- [ ] Plugin system
- [ ] Math rendering

**Step 4: Performance check**

Open a large file (1000+ lines). Verify:
- Loads in <500ms
- Typing latency is imperceptible
- Tab switching is instant with cached content

**Step 5: Final commit**

If all tests pass:
```bash
git add -A
git commit -m "test: integration verification complete — ProseMirror migration done"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Install PM dependencies | — |
| 2 | Create ProseMirror schema | 1 |
| 3 | Create React-in-PM helpers | 1 |
| 4 | Create suggestion plugin factory | 1 |
| 5 | Create floating menu plugin | 1 |
| 6 | Create PM command helpers | 1 |
| 7 | Create useProseMirror hook | 1 |
| 8 | Replace Editor.jsx core | 2, 3, 5, 6, 7 |
| 9 | Update EditorGroup.jsx | 8 |
| 10 | Port trivial extensions | 8 |
| 11 | Port moderate extensions | 2, 8 |
| 12 | Port suggestion extensions | 3, 4, 8 |
| 13 | Port MermaidDiagram | 3, 8 |
| 14 | Update EditorAPI.js | 6, 8 |
| 15 | Update useShortcuts.js | 6, 8 |
| 16 | Update external consumers | 6, 8 |
| 17 | Replace remaining getHTML() | 8 |
| 18 | Delete dead code | 10-17 |
| 19 | Remove TipTap dependencies | 18 |
| 20 | Update tests | 19 |
| 21 | Update CSS | 8 |
| 22 | Integration testing | 20, 21 |
