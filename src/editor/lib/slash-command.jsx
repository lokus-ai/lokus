import { ReactPopup } from './react-pm-helpers.jsx';
import { logger } from "../../utils/logger.js";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
  Code,
  CodeXml,
  ListTodo,
  Table2,
  Image as ImageIcon,
  Superscript as SupIcon,
  Subscript as SubIcon,
  Sigma,
  Strikethrough,
  Highlighter,
  Minus,
  FileText,
  Link,
  CheckSquare,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import tippy from "tippy.js/dist/tippy.esm.js";

import SlashCommandList from "../components/SlashCommandList";
import { editorAPI } from "../../plugins/api/EditorAPI.js";
import { createEditorCommands, insertContent } from '../commands/index.js';
import { TextSelection } from 'prosemirror-state';

// Keep track of the current reference rect so we can open sub-popovers
let lastClientRect = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Delete a range in the editor view and focus.
 * Returns the new state after dispatch so subsequent commands operate on fresh state.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {{ from: number, to: number }} range
 */
function deleteRange(view, range) {
  if (!view) return;
  view.dom.focus({ preventScroll: true });
  const tr = view.state.tr.delete(range.from, range.to);
  // Place cursor at the deletion point
  const pos = Math.min(range.from, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, pos));
  tr.scrollIntoView();
  view.dispatch(tr);
}

/**
 * Delete the slash command range and then insert content.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {{ from: number, to: number }} range
 * @param {import('prosemirror-model').Node | Object | string} content
 */
function deleteRangeAndInsert(view, range, content) {
  if (!view) return;
  view.dom.focus({ preventScroll: true });

  const { schema, tr } = view.state;

  // Delete the slash command text
  tr.delete(range.from, range.to);

  // Resolve the content
  let nodes;
  if (typeof content === 'string') {
    nodes = [schema.text(content)];
  } else if (content && typeof content === 'object' && content.type && typeof content.type === 'string') {
    nodes = [schema.nodeFromJSON(content)];
  } else if (content && typeof content === 'object' && content.type && content.type.name) {
    nodes = [content];
  } else {
    nodes = [schema.text(String(content))];
  }

  // Insert at the mapped deletion point
  const insertPos = tr.mapping.map(range.from);
  for (const node of nodes) {
    if (node.isInline) {
      tr.insert(insertPos, node);
    } else {
      tr.replaceWith(insertPos, insertPos, node);
    }
  }

  tr.scrollIntoView();
  view.dispatch(tr);
}

function buildTableHTML(rows, cols, withHeaderRow = true) {
  const th = (n) => Array.from({ length: n }).map((_, i) => `<th>Header ${i + 1}</th>`).join('');
  const tds = (n) => Array.from({ length: n }).map(() => `<td> </td>`).join('');
  const body = Array.from({ length: rows }).map(() => `<tr>${tds(cols)}</tr>`).join('');
  const thead = withHeaderRow ? `<thead><tr>${th(cols)}</tr></thead>` : '';
  return `<table>${thead}<tbody>${body}</tbody></table>`;
}

function openTemplatePicker({ editor: view, range }) {
  logger.debug('SlashCommand', 'Opening template picker via event');

  // Dispatch custom event to open template picker
  window.dispatchEvent(new CustomEvent('open-template-picker', {
    detail: {
      editorState: { editor: view, range },
      onSelect: (template, processedContent) => {
        logger.debug('SlashCommand', 'Template selected:', template?.name);
        try {
          deleteRangeAndInsert(view, range, processedContent);
        } catch (err) {
          logger.error('SlashCommand', 'Error inserting template:', err);
          try {
            deleteRangeAndInsert(view, range, template.content);
          } catch {}
        }
      }
    }
  }));
}

function openFileLinkPicker({ editor: view, range }) {
  try {
    const getIndex = () => {
      const list = (globalThis.__LOKUS_FILE_INDEX__ || []);
      return Array.isArray(list) ? list : [];
    };

    const files = getIndex();

    if (files.length === 0) {
      deleteRangeAndInsert(view, range, '[[]]');
      return;
    }

    createFilePicker(files, (selectedFile) => {
      if (selectedFile) {
        const linkText = `[[${selectedFile.title}]]`;
        deleteRangeAndInsert(view, range, linkText);
      }
    });

  } catch (error) {
    try {
      deleteRangeAndInsert(view, range, '[[Link]]');
    } catch { }
  }
}

function createFilePicker(files, onSelect) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;

  // Create picker container
  const picker = document.createElement('div');
  picker.style.cssText = `
    background: rgb(var(--panel));
    border: 1px solid rgb(var(--border));
    border-radius: 12px;
    width: 500px;
    max-height: 600px;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px;
    border-bottom: 1px solid rgb(var(--border));
    background: rgb(var(--bg));
  `;
  header.innerHTML = `
    <h3 style="margin: 0; color: rgb(var(--text)); font-size: 16px; font-weight: 600;">
      Select File to Link
    </h3>
    <p style="margin: 4px 0 0 0; color: rgb(var(--muted)); font-size: 14px;">
      Choose a file from your workspace
    </p>
  `;

  // Create file list container
  const listContainer = document.createElement('div');
  listContainer.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    padding: 8px 0;
  `;

  // Create file items
  files.forEach((file, index) => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 12px 20px;
      cursor: pointer;
      border-bottom: 1px solid rgba(var(--border), 0.5);
      transition: background-color 0.15s ease;
    `;

    // Get relative path (remove workspace path)
    const getRelativePath = (fullPath) => {
      const workspace = globalThis.__LOKUS_WORKSPACE_PATH__ || '';
      if (workspace && fullPath.startsWith(workspace)) {
        return fullPath.slice(workspace.length).replace(/^\//, '');
      }
      return fullPath;
    };

    const relativePath = getRelativePath(file.path);

    item.innerHTML = `
      <div style="color: rgb(var(--text)); font-size: 14px; font-weight: 500; margin-bottom: 2px;">
        ${file.title}
      </div>
      <div style="color: rgb(var(--muted)); font-size: 12px;">
        ${relativePath}
      </div>
    `;

    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(var(--accent), 0.1)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    // Click handler
    item.addEventListener('click', () => {
      onSelect(file);
      cleanup();
    });

    listContainer.appendChild(item);
  });

  // Create footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 20px;
    border-top: 1px solid rgb(var(--border));
    background: rgb(var(--bg));
    text-align: right;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: transparent;
    border: 1px solid rgb(var(--border));
    color: rgb(var(--muted));
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `;

  cancelBtn.addEventListener('click', () => {
    onSelect(null);
    cleanup();
  });

  footer.appendChild(cancelBtn);

  // Assemble picker
  picker.appendChild(header);
  picker.appendChild(listContainer);
  picker.appendChild(footer);
  overlay.appendChild(picker);

  // Add to DOM
  document.body.appendChild(overlay);

  // Cleanup function
  const cleanup = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      onSelect(null);
      cleanup();
    }
  });

  // Close on escape
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      onSelect(null);
      cleanup();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);
}

function openTableSizePicker({ editor: view, range }) {
  // If table not ready, wait briefly and insert default; if we can't position a picker, also insert default.
  if (!lastClientRect) {
    try {
      deleteRange(view, range);
      const cmds = createEditorCommands(view);
      cmds.insertTable({ rows: 3, cols: 3 });
    } catch { }
    return;
  }

  const MAX_ROWS = 6;
  const MAX_COLS = 8;
  const container = document.createElement('div');
  container.className = "p-2 bg-app-panel border border-app-border rounded-md shadow-md";
  container.style.userSelect = 'none';

  const label = document.createElement('div');
  label.className = "text-xs text-app-muted mb-2";
  label.textContent = `Insert table`;
  container.appendChild(label);

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${MAX_COLS}, 18px)`;
  grid.style.gridAutoRows = '18px';
  grid.style.gap = '6px';
  container.appendChild(grid);

  let hoverRows = 0;
  let hoverCols = 0;

  const cells = [];
  for (let r = 1; r <= MAX_ROWS; r++) {
    for (let c = 1; c <= MAX_COLS; c++) {
      const cell = document.createElement('div');
      cell.style.width = '18px';
      cell.style.height = '18px';
      cell.style.border = '1px solid rgb(var(--border))';
      cell.style.background = 'rgb(var(--panel))';
      cell.style.borderRadius = '4px';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      grid.appendChild(cell);
      cells.push(cell);
    }
  }

  function paint() {
    for (const cell of cells) {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const active = r <= hoverRows && c <= hoverCols;
      cell.style.background = active ? 'rgb(var(--accent) / 0.25)' : 'rgb(var(--panel))';
      cell.style.borderColor = active ? 'rgb(var(--accent))' : 'rgb(var(--border))';
    }
    label.textContent = `Insert ${hoverRows} x ${hoverCols} table`;
  }

  grid.addEventListener('mousemove', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const r = Number(target.dataset.r || 0);
    const c = Number(target.dataset.c || 0);
    if (r && c && (r !== hoverRows || c !== hoverCols)) {
      hoverRows = r; hoverCols = c; paint();
    }
  });

  const doInsert = () => {
    if (!hoverRows || !hoverCols) return;
    try {
      deleteRange(view, range);
      const cmds = createEditorCommands(view);
      cmds.insertTable({ rows: hoverRows, cols: hoverCols });
    } catch { }
    try { pick.destroy(); } catch { }
  };
  grid.addEventListener('click', doInsert);

  const pick = tippy('body', {
    getReferenceClientRect: lastClientRect || (() => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })),
    appendTo: () => document.body,
    content: container,
    showOnCreate: true,
    interactive: true,
    trigger: 'manual',
    placement: 'bottom-start',
    onHidden: (inst) => { try { inst.destroy(); } catch { } },
  });

  // Initial paint so the palette uses 1x1 by default hover
  hoverRows = 1; hoverCols = 1; paint();
}

// ---------------------------------------------------------------------------
// Command items — each `command` callback receives { editor: EditorView, range }
// ---------------------------------------------------------------------------

const commandItems = [
  {
    group: "Writing",
    commands: [
      {
        title: "Heading 1",
        description: "Big section heading.",
        icon: <Heading1 size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleHeading({ level: 1 });
        },
      },
      {
        title: "Heading 2",
        description: "Medium section heading.",
        icon: <Heading2 size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleHeading({ level: 2 });
        },
      },
      {
        title: "Heading 3",
        description: "Small section heading.",
        icon: <Heading3 size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleHeading({ level: 3 });
        },
      },
      {
        title: "Bullet List",
        description: "Create a simple bullet list.",
        icon: <List size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleBulletList();
        },
      },
      {
        title: "Ordered List",
        description: "Create a list with numbers.",
        icon: <ListOrdered size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleOrderedList();
        },
      },
      {
        title: "Task List",
        description: "Track tasks with checkboxes.",
        icon: <ListTodo size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleTaskList();
        },
      },
      {
        title: "Quote",
        description: "Capture a quote.",
        icon: <TextQuote size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleBlockquote();
        },
      },
    ],
  },
  {
    group: "Content",
    commands: [
      {
        title: "Image",
        description: "Insert image from workspace or URL.",
        icon: <ImageIcon size={18} />,
        command: ({ editor: view, range }) => {
          // Delete the slash command and insert ![[ to trigger image autocomplete
          deleteRangeAndInsert(view, range, '![[');
        },
      },
      {
        title: "Table",
        description: "Pick size, then insert.",
        icon: <Table2 size={18} />,
        command: ({ editor: view, range }) => {
          openTableSizePicker({ editor: view, range });
        },
      },
      {
        title: "Template",
        description: "Insert a template with variables.",
        icon: <FileText size={18} />,
        command: ({ editor: view, range }) => {
          openTemplatePicker({ editor: view, range });
        },
      },
      {
        title: "Link to File",
        description: "Create a wiki link to another file.",
        icon: <Link size={18} />,
        command: ({ editor: view, range }) => {
          openFileLinkPicker({ editor: view, range });
        },
      },
      {
        title: "Simple Task",
        description: "Create standalone task (!task).",
        icon: <ListTodo size={18} />,
        command: ({ editor: view, range }) => {
          deleteRangeAndInsert(view, range, '!task ');
        },
      },
    ],
  },
  {
    group: "Code",
    commands: [
      {
        title: "Code",
        description: "Capture a code snippet.",
        icon: <Code size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleCode();
        },
      },
      {
        title: "Code Block",
        description: "Capture a larger code block.",
        icon: <CodeXml size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          createEditorCommands(view).toggleCodeBlock();
        },
      },
    ],
  },
  {
    group: "Formatting",
    commands: [
      {
        title: "Highlight",
        description: "Highlight text (==text==).",
        icon: <Highlighter size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const cmds = createEditorCommands(view);
          if (!cmds.toggleHighlight()) {
            insertContent(view, '<mark></mark>');
          }
        },
      },
      {
        title: "Strikethrough",
        description: "Cross out text (~~text~~).",
        icon: <Strikethrough size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const cmds = createEditorCommands(view);
          if (!cmds.toggleStrike()) {
            insertContent(view, '<s></s>');
          }
        },
      },
      {
        title: "Superscript",
        description: "Raise text (x^2).",
        icon: <SupIcon size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const cmds = createEditorCommands(view);
          if (!cmds.toggleSuperscript()) {
            insertContent(view, '<sup></sup>');
          }
        },
      },
      {
        title: "Subscript",
        description: "Lower text (H2O).",
        icon: <SubIcon size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const cmds = createEditorCommands(view);
          if (!cmds.toggleSubscript()) {
            insertContent(view, '<sub></sub>');
          }
        },
      },
      {
        title: "Horizontal Rule",
        description: "Insert a horizontal divider.",
        icon: <Minus size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const cmds = createEditorCommands(view);
          if (!cmds.setHorizontalRule()) {
            insertContent(view, '<hr />');
          }
        },
      },
    ],
  },
  {
    group: "Callouts",
    commands: [
      {
        title: "Note Callout",
        description: "Insert a note callout block.",
        icon: <Info size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          // Callouts are custom nodes - insert as JSON node spec
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'note' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Tip Callout",
        description: "Insert a tip callout block.",
        icon: <Lightbulb size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'tip' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Info Callout",
        description: "Insert an info callout block.",
        icon: <Info size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'info' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Warning Callout",
        description: "Insert a warning callout block.",
        icon: <AlertTriangle size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'warning' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Danger Callout",
        description: "Insert a danger callout block.",
        icon: <AlertCircle size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'danger' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Success Callout",
        description: "Insert a success callout block.",
        icon: <CheckSquare size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'success' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Question Callout",
        description: "Insert a question callout block.",
        icon: <HelpCircle size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'question' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
      {
        title: "Example Callout",
        description: "Insert an example callout block.",
        icon: <BookOpen size={18} />,
        command: ({ editor: view, range }) => {
          deleteRange(view, range);
          const schema = view.state.schema;
          if (schema.nodes.callout) {
            const tr = view.state.tr.replaceSelectionWith(
              schema.nodes.callout.create({ type: 'example' }, schema.nodes.paragraph.create())
            ).scrollIntoView();
            view.dispatch(tr);
          }
        },
      },
    ],
  },
  {
    group: "Math",
    commands: [
      {
        title: "Inline Math",
        description: "Insert $x^2$ (LaTeX).",
        icon: <Sigma size={18} />,
        command: ({ editor: view, range }) => {
          // Dispatch event to open math formula modal
          window.dispatchEvent(new CustomEvent('open-math-formula-modal', {
            detail: {
              mode: 'inline',
              editor: view,
              range,
              onInsert: ({ formula }) => {
                const schema = view.state.schema;
                const mathInlineType = schema.nodes.mathInline ?? schema.nodes.math_inline;
                if (mathInlineType) {
                  // Delete the slash command range first, then insert math node
                  view.dom.focus({ preventScroll: true });
                  const tr = view.state.tr.delete(range.from, range.to);
                  const insertPos = tr.mapping.map(range.from);
                  const mathNode = mathInlineType.create({ src: formula });
                  tr.insert(insertPos, mathNode);
                  tr.scrollIntoView();
                  view.dispatch(tr);
                } else {
                  // Fallback: insert as HTML-like text
                  deleteRangeAndInsert(view, range, `$${formula}$`);
                }
              }
            }
          }));
        },
      },
      {
        title: "Block Math",
        description: "Insert $$E=mc^2$$ (LaTeX).",
        icon: <Sigma size={18} />,
        command: ({ editor: view, range }) => {
          // Dispatch event to open math formula modal
          window.dispatchEvent(new CustomEvent('open-math-formula-modal', {
            detail: {
              mode: 'block',
              editor: view,
              range,
              onInsert: ({ formula }) => {
                const schema = view.state.schema;
                const mathBlockType = schema.nodes.mathBlock ?? schema.nodes.math_block;
                if (mathBlockType) {
                  // Delete the slash command range first, then insert math node
                  view.dom.focus({ preventScroll: true });
                  const tr = view.state.tr.delete(range.from, range.to);
                  const insertPos = tr.mapping.map(range.from);
                  const mathNode = mathBlockType.create({ src: formula });
                  tr.replaceWith(insertPos, insertPos, mathNode);
                  tr.scrollIntoView();
                  view.dispatch(tr);
                } else {
                  // Fallback: insert as text
                  deleteRangeAndInsert(view, range, `$$${formula}$$`);
                }
              }
            }
          }));
        },
      },
    ],
  },
];

const slashCommand = {
  items: ({ query, editor }) => {
    // If no query, show all commands
    if (!query || !query.trim()) {
      const pluginCommandGroups = editorAPI.getSlashCommands();
      return [...commandItems, ...pluginCommandGroups];
    }

    const queryLower = query.toLowerCase().trim();

    // Enhanced matching: check title and description
    const matches = (item) => {
      const titleLower = item.title.toLowerCase();
      const descLower = (item.description || '').toLowerCase();

      // Check if title or description includes the query
      return titleLower.includes(queryLower) || descLower.includes(queryLower);
    };

    // Score items for better sorting (title matches rank higher)
    const scoreItem = (item) => {
      const titleLower = item.title.toLowerCase();
      const descLower = (item.description || '').toLowerCase();

      // Exact title match = highest score
      if (titleLower === queryLower) return 1000;

      // Title starts with query = high score
      if (titleLower.startsWith(queryLower)) return 100;

      // Title contains query = medium score
      if (titleLower.includes(queryLower)) return 50;

      // Description contains query = low score
      if (descLower.includes(queryLower)) return 10;

      return 0;
    };

    const available = (_item) => true; // Always show; execution is guarded.

    // Get plugin slash commands
    const pluginCommandGroups = editorAPI.getSlashCommands();

    // Combine core commands with plugin commands
    const allCommandGroups = [...commandItems, ...pluginCommandGroups];

    // Filter and sort commands by relevance
    const filtered = allCommandGroups
      .map((group) => {
        const matchedCommands = group.commands
          .filter((item) => matches(item) && available(item))
          .map((item) => ({ ...item, _score: scoreItem(item) }))
          .sort((a, b) => b._score - a._score); // Sort by score descending

        return {
          ...group,
          commands: matchedCommands
        };
      })
      .filter((group) => group.commands.length > 0);

    return filtered;
  },

  render: () => {
    let component;
    let popup;

    return {
      onStart: (props) => {
        // keep latest rect for sub-popovers (e.g., table size picker)
        if (props.clientRect) lastClientRect = props.clientRect;

        // Refresh plugin commands on each open in case they changed
        const currentItems = slashCommand.items(props);
        const enhancedProps = {
          ...props,
          items: currentItems
        };

        component = new ReactPopup(SlashCommandList, enhancedProps);

        if (!props.clientRect) {
          logger.warn('SlashCommand', 'No clientRect in onStart');
          return;
        }

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props) {
        // Refresh items with latest plugin commands
        const currentItems = slashCommand.items(props);
        const enhancedProps = {
          ...props,
          items: currentItems
        };

        component.updateProps(enhancedProps);

        if (!props.clientRect) {
          logger.warn('SlashCommand', 'No clientRect in onUpdate');
          return;
        }

        if (!popup) {
          logger.warn('SlashCommand', 'No popup in onUpdate');
          return;
        }

        // update rect for sub-popovers
        lastClientRect = props.clientRect;
        if (popup && popup[0]) {
          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        }
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          if (popup && popup[0]) popup[0].hide();
          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        if (popup && popup[0]) popup[0].destroy();
        if (component) component.destroy();
      },
    };
  },
};

// Export enhanced slash command with plugin support
export default slashCommand;
