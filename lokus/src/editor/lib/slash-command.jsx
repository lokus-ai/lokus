import { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
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
} from "lucide-react";
import tippy from "tippy.js/dist/tippy.esm.js";

import SlashCommandList from "../components/SlashCommandList";

// Keep track of the current reference rect so we can open sub‑popovers
let lastClientRect = null;

function waitForCommand(editor, key, { interval = 100, timeout = 2000 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (editor?.commands?.[key]) return resolve(true);
      if (Date.now() - start >= timeout) return resolve(false);
      setTimeout(check, interval);
    };
    check();
  });
}

async function runWhenReady(editor, key, run, options) {
  const ok = await waitForCommand(editor, key, options);
  if (!ok) {
    console.warn(`[slash] Command '${key}' not available in time`);
    return false;
  }
  try {
    run();
    return true;
  } catch (e) {
    console.warn(`[slash] Failed running '${key}':`, e);
    return false;
  }
}

function buildTableHTML(rows, cols, withHeaderRow = true) {
  const th = (n) => Array.from({ length: n }).map((_, i) => `<th>Header ${i + 1}</th>`).join('');
  const tds = (n) => Array.from({ length: n }).map(() => `<td> </td>`).join('');
  const body = Array.from({ length: rows }).map(() => `<tr>${tds(cols)}</tr>`).join('');
  const thead = withHeaderRow ? `<thead><tr>${th(cols)}</tr></thead>` : '';
  return `<table>${thead}<tbody>${body}</tbody></table>`;
}

function openTableSizePicker({ editor, range }) {
  // If table not ready, wait briefly and insert default; if we can't position a picker, also insert default.
  if (!lastClientRect) {
    try {
      const html = buildTableHTML(3, 3, true);
      editor.chain().focus().deleteRange(range).insertContent(html).run();
    } catch {}
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
    label.textContent = `Insert ${hoverRows} × ${hoverCols} table`;
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
      const html = buildTableHTML(hoverRows, hoverCols, true);
      editor.chain().focus().deleteRange(range).insertContent(html).run();
    } catch {}
    try { pick.destroy(); } catch {}
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
    onHidden: (inst) => { try { inst.destroy(); } catch {} },
  });

  // Initial paint so the palette uses 1×1 by default hover
  hoverRows = 1; hoverCols = 1; paint();
}

const commandItems = [
  {
    group: "Basic Blocks",
    commands: [
      {
        title: "Heading 1",
        description: "Big section heading.",
        icon: <Heading1 size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
        },
      },
      {
        title: "Task List",
        description: "Track tasks with checkboxes.",
        icon: <ListTodo size={18} />,
        command: ({ editor, range }) => {
          runWhenReady(editor, 'toggleTaskList', () => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
          }, { timeout: 5000 });
        },
      },
      {
        title: "Table",
        description: "Pick size, then insert.",
        icon: <Table2 size={18} />,
        command: ({ editor, range }) => {
          openTableSizePicker({ editor, range });
        },
      },
      {
        title: "Heading 2",
        description: "Medium section heading.",
        icon: <Heading2 size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
        },
      },
      {
        title: "Heading 3",
        description: "Small section heading.",
        icon: <Heading3 size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
        },
      },
      {
        title: "Bullet List",
        description: "Create a simple bullet list.",
        icon: <List size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: "Ordered List",
        description: "Create a list with numbers.",
        icon: <ListOrdered size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: "Quote",
        description: "Capture a quote.",
        icon: <TextQuote size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
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
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCode().run();
        },
      },
      {
        title: "Code Block",
        description: "Capture a larger code block.",
        icon: <CodeXml size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
    ],
  },
];

const slashCommand = {
  items: ({ query, editor }) => {
    const matches = (title) => title.toLowerCase().startsWith(query.toLowerCase());
    const available = (_item) => true; // Always show; execution is guarded.

    return commandItems
      .map((group) => ({
        ...group,
        commands: group.commands.filter((item) => matches(item.title) && available(item)),
      }))
      .filter((group) => group.commands.length > 0);
  },

  render: () => {
    let component;
    let popup;

    return {
      onStart: (props) => {
        // keep latest rect for sub‑popovers (e.g., table size picker)
        if (props.clientRect) lastClientRect = props.clientRect;
        component = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
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
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        // update rect for sub‑popovers
        lastClientRect = props.clientRect;
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};

export default slashCommand;
