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
  Image as ImageIcon,
  Superscript as SupIcon,
  Subscript as SubIcon,
  Sigma,
  Strikethrough,
  Highlighter,
  Minus,
  FileText,
  Link,
  Mail,
  Send,
  Kanban,
  CheckSquare,
} from "lucide-react";
import tippy from "tippy.js/dist/tippy.esm.js";

import SlashCommandList from "../components/SlashCommandList";
import { editorAPI } from "../../plugins/api/EditorAPI.js";

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
    return false;
  }
  try {
    run();
    return true;
  } catch (e) {
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

function openTemplatePicker({ editor, range }) {
  console.log('[SlashCommand] Opening template picker via event...');
  // Store current editor state for template insertion
  const editorState = { editor, range };

  // Dispatch custom event to open template picker
  window.dispatchEvent(new CustomEvent('open-template-picker', {
    detail: {
      editorState,
      onSelect: (template, processedContent) => {
        console.log('[SlashCommand] Template selected:', template?.name);
        try {
          // Insert the processed template content
          editor.chain().focus().deleteRange(range).insertContent(processedContent).run();
        } catch (err) {
          console.error('[SlashCommand] Error inserting template:', err);
          // Fallback: insert raw template content
          editor.chain().focus().deleteRange(range).insertContent(template.content).run();
        }
      }
    }
  }));
}

function openFileLinkPicker({ editor, range }) {

  try {
    // Get file index for suggestions
    const getIndex = () => {
      const list = (globalThis.__LOKUS_FILE_INDEX__ || [])
      return Array.isArray(list) ? list : []
    };

    const files = getIndex();

    if (files.length === 0) {
      // No files available, just insert empty wiki link
      editor.chain().focus().deleteRange(range).insertContent('[[]]').run();
      return;
    }

    // Create file picker UI
    createFilePicker(files, (selectedFile) => {
      if (selectedFile) {
        // Insert the selected file as wiki link
        const linkText = `[[${selectedFile.title}]]`;
        editor.chain().focus().deleteRange(range).insertContent(linkText).run();
      }
    });

  } catch (error) {
    // Fallback: just insert something
    try {
      editor.chain().focus().deleteRange(range).insertContent('[[Link]]').run();
    } catch (fallbackError) {
    }
  }
}

function getCurrentFileName() {
  // Get the current file name from the workspace context
  try {
    const activeFile = window.__LOKUS_ACTIVE_FILE__;
    if (activeFile) {
      // Extract filename from full path and remove extension
      const fileName = activeFile.split('/').pop() || 'Untitled';
      return fileName.replace(/\.[^/.]+$/, ''); // Remove extension (.md, .txt, etc.)
    }
    return 'Untitled';
  } catch (error) {
    return 'Untitled';
  }
}

function createGmailTemplate({ editor, range }) {
  const fileName = getCurrentFileName();

  const template = `---
To:
Subject: ${fileName}
---

<!-- Write your email body here -->

`;

  editor.chain().focus().deleteRange(range).insertContent(template).run();
}

// Kanban helper functions
async function getKanbanBoards() {
  try {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const { invoke } = window.__TAURI__.tauri;
      const boards = await invoke('list_kanban_boards');
      return boards || [];
    }
  } catch (error) {
    console.error('Failed to get kanban boards:', error);
  }
  return [];
}

function createKanbanBoardPicker({ editor, range, onInsertTask = false }) {
  getKanbanBoards().then(boards => {
    if (boards.length === 0) {
      // No boards, prompt to create one
      const boardName = window.prompt('No kanban boards found. Create a new board:');
      if (boardName && boardName.trim()) {
        if (onInsertTask) {
          editor.chain().focus().deleteRange(range).insertContent(`@task[${boardName.trim()}] `).run();
        } else {
          // Just create the board
          if (typeof window !== 'undefined' && window.__TAURI__) {
            const { invoke } = window.__TAURI__.tauri;
            invoke('create_kanban_board', { name: boardName.trim() })
              .then(() => {
              })
              .catch(err => console.error('Failed to create board:', err));
          }
        }
      }
      return;
    }

    // Create board picker UI
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

    // Define cleanup function early so it can be used in event handlers
    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

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

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid rgb(var(--border));
      background: rgb(var(--bg));
    `;
    header.innerHTML = `
      <h3 style="margin: 0; color: rgb(var(--text)); font-size: 16px; font-weight: 600;">
        ${onInsertTask ? 'Select Board for Task' : 'Open Kanban Board'}
      </h3>
      <p style="margin: 4px 0 0 0; color: rgb(var(--muted)); font-size: 14px;">
        ${onInsertTask ? 'Choose a board to link your task to' : 'Choose a board to open'}
      </p>
    `;

    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      padding: 8px 0;
    `;

    boards.forEach((board) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 12px 20px;
        cursor: pointer;
        border-bottom: 1px solid rgba(var(--border), 0.5);
        transition: background-color 0.15s ease;
      `;

      item.innerHTML = `
        <div style="color: rgb(var(--text)); font-size: 14px; font-weight: 500;">
          ${board}
        </div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'rgba(var(--accent), 0.1)';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });

      item.addEventListener('click', () => {
        if (onInsertTask) {
          editor.chain().focus().deleteRange(range).insertContent(`@task[${board}] `).run();
        } else {
          // Open the board file
          window.dispatchEvent(new CustomEvent('lokus:open-file', {
            detail: { path: `kanban/${board}.kanban` }
          }));
        }
        cleanup();
      });

      listContainer.appendChild(item);
    });

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 20px;
      border-top: 1px solid rgb(var(--border));
      background: rgb(var(--bg));
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const createBtn = document.createElement('button');
    createBtn.textContent = '+ New Board';
    createBtn.style.cssText = `
      background: rgb(var(--accent));
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;

    createBtn.addEventListener('click', () => {
      cleanup();
      const boardName = window.prompt('Create new kanban board:');
      if (boardName && boardName.trim()) {
        if (onInsertTask) {
          editor.chain().focus().deleteRange(range).insertContent(`@task[${boardName.trim()}] `).run();
        }
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const { invoke } = window.__TAURI__.tauri;
          invoke('create_kanban_board', { name: boardName.trim() })
            .then(() => { })
            .catch(err => console.error('Failed to create board:', err));
        }
      }
    });

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

    cancelBtn.addEventListener('click', cleanup);

    footer.appendChild(createBtn);
    footer.appendChild(cancelBtn);

    picker.appendChild(header);
    picker.appendChild(listContainer);
    picker.appendChild(footer);
    overlay.appendChild(picker);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
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

function openTableSizePicker({ editor, range }) {
  // If table not ready, wait briefly and insert default; if we can't position a picker, also insert default.
  if (!lastClientRect) {
    try {
      const html = buildTableHTML(3, 3, true);
      editor.chain().focus().deleteRange(range).insertContent(html).run();
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

  // Initial paint so the palette uses 1×1 by default hover
  hoverRows = 1; hoverCols = 1; paint();
}

const commandItems = [
  {
    group: "Tasks & Kanban",
    commands: [
      {
        title: "Kanban Board",
        description: "Open or create a kanban board.",
        icon: <Kanban size={18} />,
        command: ({ editor, range }) => {
          createKanbanBoardPicker({ editor, range, onInsertTask: false });
        },
      },
      {
        title: "Linked Task",
        description: "Create task linked to kanban board.",
        icon: <CheckSquare size={18} />,
        command: ({ editor, range }) => {
          createKanbanBoardPicker({ editor, range, onInsertTask: true });
        },
      },
      {
        title: "Simple Task",
        description: "Create standalone task (!task).",
        icon: <ListTodo size={18} />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).insertContent('!task ').run();
        },
      },
    ],
  },
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
        title: "Image",
        description: "Insert an image by URL.",
        icon: <ImageIcon size={18} />,
        command: ({ editor, range }) => {
          // Dispatch event to open image insert modal
          window.dispatchEvent(new CustomEvent('open-image-insert-modal', {
            detail: {
              editor,
              range,
              onInsert: ({ src, alt }) => {
                if (editor?.commands?.setImage) {
                  editor.chain().focus().deleteRange(range).setImage({ src, alt }).run();
                } else {
                  editor.chain().focus().deleteRange(range).insertContent(`<img src="${src}" alt="${alt || ''}" />`).run();
                }
              }
            }
          }));
        },
      },
      {
        title: "Template",
        description: "Insert a template with variables.",
        icon: <FileText size={18} />,
        command: ({ editor, range }) => {
          openTemplatePicker({ editor, range });
        },
      },
      {
        title: "Link to File",
        description: "Create a wiki link to another file.",
        icon: <Link size={18} />,
        command: ({ editor, range }) => {
          openFileLinkPicker({ editor, range });
        },
      },
      {
        title: "Load Gmail",
        description: "Create an email template with file name as subject.",
        icon: <Mail size={18} />,
        command: ({ editor, range }) => {
          createGmailTemplate({ editor, range });
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
    group: "Formatting",
    commands: [
      {
        title: "Superscript",
        description: "Raise text (x^2).",
        icon: <SupIcon size={18} />,
        command: ({ editor, range }) => {
          if (editor?.commands?.toggleSuperscript) {
            editor.chain().focus().deleteRange(range).toggleSuperscript().run();
          } else {
            // Fallback: wrap selection in <sup>
            editor.chain().focus().deleteRange(range).insertContent('<sup></sup>').run();
          }
        },
      },
      {
        title: "Subscript",
        description: "Lower text (H₂O).",
        icon: <SubIcon size={18} />,
        command: ({ editor, range }) => {
          if (editor?.commands?.toggleSubscript) {
            editor.chain().focus().deleteRange(range).toggleSubscript().run();
          } else {
            editor.chain().focus().deleteRange(range).insertContent('<sub></sub>').run();
          }
        },
      },
      {
        title: "Strikethrough",
        description: "Cross out text (~~text~~).",
        icon: <Strikethrough size={18} />,
        command: ({ editor, range }) => {
          if (editor?.commands?.toggleStrike) {
            editor.chain().focus().deleteRange(range).toggleStrike().run();
          } else {
            editor.chain().focus().deleteRange(range).insertContent('<s></s>').run();
          }
        },
      },
      {
        title: "Highlight",
        description: "Highlight text (==text==).",
        icon: <Highlighter size={18} />,
        command: ({ editor, range }) => {
          if (editor?.commands?.toggleHighlight) {
            editor.chain().focus().deleteRange(range).toggleHighlight().run();
          } else {
            editor.chain().focus().deleteRange(range).insertContent('<mark></mark>').run();
          }
        },
      },
      {
        title: "Horizontal Rule",
        description: "Insert a horizontal divider.",
        icon: <Minus size={18} />,
        command: ({ editor, range }) => {
          if (editor?.commands?.setHorizontalRule) {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
          } else {
            editor.chain().focus().deleteRange(range).insertContent('<hr />').run();
          }
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
  {
    group: "Math",
    commands: [
      {
        title: "Inline Math",
        description: "Insert $x^2$ (LaTeX).",
        icon: <Sigma size={18} />,
        command: ({ editor, range }) => {
          // Dispatch event to open math formula modal
          window.dispatchEvent(new CustomEvent('open-math-formula-modal', {
            detail: {
              mode: 'inline',
              editor,
              range,
              onInsert: ({ formula }) => {
                if (editor?.commands?.setMathInline) {
                  editor.chain().focus().deleteRange(range).setMathInline(formula).run();
                } else {
                  // Fallback: insert as math node HTML
                  const html = `<span data-type="math-inline" data-src="${formula.replace(/"/g, '&quot;')}">${formula}</span>`;
                  editor.chain().focus().deleteRange(range).insertContent(html).run();
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
        command: ({ editor, range }) => {
          // Dispatch event to open math formula modal
          window.dispatchEvent(new CustomEvent('open-math-formula-modal', {
            detail: {
              mode: 'block',
              editor,
              range,
              onInsert: ({ formula }) => {
                if (editor?.commands?.setMathBlock) {
                  editor.chain().focus().deleteRange(range).setMathBlock(formula).run();
                } else {
                  // Fallback: insert as math block node HTML
                  const html = `<div data-type="math-block" data-src="${formula.replace(/"/g, '&quot;')}">${formula}</div>`;
                  editor.chain().focus().deleteRange(range).insertContent(html).run();
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
        // keep latest rect for sub‑popovers (e.g., table size picker)
        if (props.clientRect) lastClientRect = props.clientRect;

        // Refresh plugin commands on each open in case they changed
        const currentItems = slashCommand.items(props);
        const enhancedProps = {
          ...props,
          items: currentItems
        };

        component = new ReactRenderer(SlashCommandList, {
          props: enhancedProps,
          editor: props.editor,
        });

        if (!props.clientRect) {
          console.warn('⚠️ [SlashCommand] No clientRect in onStart');
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
          console.warn('⚠️ [SlashCommand] No clientRect in onUpdate');
          return;
        }

        if (!popup) {
          console.warn('⚠️ [SlashCommand] No popup in onUpdate');
          return;
        }

        // update rect for sub‑popovers
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
