import React, { useEffect, useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import * as StarterKitExt from "@tiptap/starter-kit";
import * as PlaceholderExt from "@tiptap/extension-placeholder";
import SlashCommand from "../lib/SlashCommand.js";
import TableBubbleMenu from "./TableBubbleMenu.jsx";
import EditorContextMenu from "../../components/EditorContextMenu.jsx";
import * as LinkExt from "@tiptap/extension-link";
import * as TaskListExt from "@tiptap/extension-task-list";
import * as TaskItemExt from "@tiptap/extension-task-item";
import * as ImageExt from "@tiptap/extension-image";
import * as SuperscriptExt from "@tiptap/extension-superscript";
import * as SubscriptExt from "@tiptap/extension-subscript";
import * as TableExt from "@tiptap/extension-table";
import * as TableRowExt from "@tiptap/extension-table-row";
import * as TableHeaderExt from "@tiptap/extension-table-header";
import * as TableCellExt from "@tiptap/extension-table-cell";
import * as StrikeExt from "@tiptap/extension-strike";
import * as HighlightExt from "@tiptap/extension-highlight";
import * as HorizontalRuleExt from "@tiptap/extension-horizontal-rule";
import { InputRule } from "@tiptap/core";
import MathExt from "../extensions/Math.js";
import WikiLink from "../extensions/WikiLink.js";
import WikiLinkSuggest from "../lib/WikiLinkSuggest.js";
import TagAutocomplete from "../extensions/TagAutocomplete.js";
import HeadingAltInput from "../extensions/HeadingAltInput.js";
import MarkdownPaste from "../extensions/MarkdownPaste.js";
import MarkdownTablePaste from "../extensions/MarkdownTablePaste.js";
import SmartTask from "../extensions/SmartTask.js";
import SimpleTask from "../extensions/SimpleTask.js";
import TaskSyntaxHighlight from "../extensions/TaskSyntaxHighlight.js";
import TaskMentionSuggest from "../extensions/TaskMentionSuggest.js";
import TaskCreationTrigger from "../extensions/TaskCreationTrigger.js";
import CodeBlockIndent from "../extensions/CodeBlockIndent.js";
import Callout from "../extensions/Callout.js";
import Folding from "../extensions/Folding.js";
import MermaidDiagram from "../extensions/MermaidDiagram.jsx";
import liveEditorSettings from "../../core/editor/live-settings.js";
import WikiLinkModal from "../../components/WikiLinkModal.jsx";
import TaskCreationModal from "../../components/TaskCreationModal.jsx";
import ExportModal from "../../views/ExportModal.jsx";
import ReadingModeView from "./ReadingModeView.jsx";
import { ImageViewerModal } from "../../components/ImageViewer/ImageViewerModal.jsx";
import { findImageFiles } from "../../utils/imageUtils.js";
import { editorAPI } from "../../plugins/api/EditorAPI.js";
import { pluginAPI } from "../../plugins/api/PluginAPI.js";

import "../styles/editor.css";

const Editor = forwardRef(({ content, onContentChange, onEditorReady }, ref) => {
  const [extensions, setExtensions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editorSettings, setEditorSettings] = useState(null);
  const [pluginExtensions, setPluginExtensions] = useState([]);
  const [lastPluginUpdate, setLastPluginUpdate] = useState(0);

  // Reading mode state: 'edit', 'live', 'reading'
  const [editorMode, setEditorMode] = useState(() => {
    // Try to load mode from localStorage
    try {
      const activeFile = globalThis.__LOKUS_ACTIVE_FILE__;
      if (activeFile) {
        const saved = localStorage.getItem(`editor-mode:${activeFile}`);
        return saved || 'edit';
      }
    } catch {}
    return 'edit';
  });

  // Listen for plugin extension changes and markdown config changes
  useEffect(() => {
    const handlePluginUpdate = () => {
      const pluginExts = editorAPI.getAllExtensions();
      setPluginExtensions(pluginExts);
      setLastPluginUpdate(Date.now());
    };

    const handleMarkdownConfigChange = () => {
      console.log('[Editor] Markdown config changed, forcing editor reload...');
      setLastPluginUpdate(Date.now());
    };

    // Listen for plugin registration events
    const unsubscribeNode = editorAPI.on('node-registered', handlePluginUpdate);
    const unsubscribeMark = editorAPI.on('mark-registered', handlePluginUpdate);
    const unsubscribeExt = editorAPI.on('extension-registered', handlePluginUpdate);
    const unsubscribeUnregister = editorAPI.on('plugin-unregistered', handlePluginUpdate);
    const unsubscribeHotReload = editorAPI.on('hot-reload-requested', ({ extensions, content: newContent }) => {
      // Recreate editor with new extensions - this will be handled by the editor recreation logic
      setLastPluginUpdate(Date.now());
    });

    // Listen for markdown config changes
    window.addEventListener('markdown-config-changed', handleMarkdownConfigChange);

    // Initial load of plugin extensions
    const initialPluginExts = editorAPI.getAllExtensions();
    if (initialPluginExts.length > 0) {
      setPluginExtensions(initialPluginExts);
    }

    return () => {
      unsubscribeNode();
      unsubscribeMark();
      unsubscribeExt();
      unsubscribeUnregister();
      unsubscribeHotReload();
      window.removeEventListener('markdown-config-changed', handleMarkdownConfigChange);
    };
  }, []);

  useEffect(() => {
    const pick = (ns, named) => ns?.default ?? ns?.[named] ?? null;
    const StarterKit = pick(StarterKitExt, 'StarterKit');
    const Placeholder = pick(PlaceholderExt, 'Placeholder');
    const Link = pick(LinkExt, 'Link');
    const TaskList = pick(TaskListExt, 'TaskList');
    const TaskItem = pick(TaskItemExt, 'TaskItem');
    const Image = pick(ImageExt, 'Image');
    const Superscript = pick(SuperscriptExt, 'Superscript');
    const Subscript = pick(SubscriptExt, 'Subscript');
    const Table = pick(TableExt, 'Table');
    const TableRow = pick(TableRowExt, 'TableRow');
    const TableHeader = pick(TableHeaderExt, 'TableHeader');
    const TableCell = pick(TableCellExt, 'TableCell');
    const Strike = pick(StrikeExt, 'Strike');
    const Highlight = pick(HighlightExt, 'Highlight');
    const HorizontalRule = pick(HorizontalRuleExt, 'HorizontalRule');

    const exts = [
      StarterKit.configure({
        // Use default codeBlock
      })
    ];
    if (Link) exts.push(Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }));
    if (TaskList && TaskItem) exts.push(TaskList, TaskItem);
    if (Image) {
      exts.push(Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
        addInputRules() {
          return [
            new InputRule({
              find: /!\[([^\]]*)\]\(([^)]+)\)$/,
              handler: ({ state, range, match, chain }) => {
                const alt = match[1];
                const src = match[2];
                // Handle both local paths and web URLs
                const resolvedSrc = src.startsWith('http') ? src : src;
                chain().deleteRange(range).insertContent({
                  type: 'image',
                  attrs: { src: resolvedSrc, alt: alt || '' }
                }).run();
              },
            }),
          ];
        },
      }));
    }
    // Superscript and subscript with input rules for H^2^O and H~2~O syntax
    if (Superscript) {
      exts.push(Superscript.extend({
        addInputRules() {
          return [
            new InputRule({
              find: /\^([^^\s]+)\^$/,
              handler: ({ state, range, match, chain }) => {
                const text = match[1];
                chain().deleteRange(range).insertContent(`<sup>${text}</sup>`).run();
              },
            }),
          ];
        },
      }));
    }
    
    if (Subscript) {
      exts.push(Subscript.extend({
        addInputRules() {
          return [
            new InputRule({
              find: /~([^~\s]+)~$/,
              handler: ({ state, range, match, chain }) => {
                const text = match[1];
                chain().deleteRange(range).insertContent(`<sub>${text}</sub>`).run();
              },
            }),
          ];
        },
      }));
    }
    if (Table && TableRow && TableHeader && TableCell) {
      exts.push(Table.configure({ resizable: true }), TableRow, TableHeader, TableCell);
    }
    
    // Additional formatting extensions
    if (Strike) {
      exts.push(Strike.extend({
        addInputRules() {
          return [
            new InputRule({
              find: /~~([^~]+)~~$/,
              handler: ({ state, range, match, chain }) => {
                const text = match[1];
                chain().deleteRange(range).toggleStrike().insertContent(text).toggleStrike().run();
              },
            }),
          ];
        },
      }));
    }
    if (Highlight) exts.push(Highlight.configure({ multicolor: true }));
    if (HorizontalRule) exts.push(HorizontalRule);
    
    // Code blocks (basic, StarterKit includes CodeBlock extension)
    
    // Math (inline + block) – local extension
    if (Array.isArray(MathExt)) exts.push(...MathExt)
    else if (MathExt) exts.push(MathExt)

    // Obsidian‑style wikilinks and image embeds
    exts.push(WikiLink);
    exts.push(WikiLinkSuggest);

    // Tag autocomplete
    exts.push(TagAutocomplete);

    // Markdown paste functionality
    exts.push(MarkdownPaste);
    exts.push(MarkdownTablePaste);

    // Task syntax visual highlighting
    exts.push(TaskSyntaxHighlight);

    // Task mention autocomplete for @task
    exts.push(TaskMentionSuggest);

    // Task creation trigger for !task
    exts.push(TaskCreationTrigger);

    // Code block indentation support (Tab, Shift+Tab, Enter)
    exts.push(CodeBlockIndent);

    // Callout/Admonition blocks
    exts.push(Callout);

    // Section folding for headings
    exts.push(Folding);

    // Mermaid diagrams
    exts.push(MermaidDiagram);


    // Add plugin extensions
    exts.push(...pluginExtensions);

    // Load markdown shortcut prefs and editor settings
    (async () => {
      try {
        const { readConfig } = await import('../../core/config/store.js')
        const cfg = (await readConfig()) || {}
        
        // Load markdown shortcuts
        const hs = cfg.markdownShortcuts?.headingAlt
        const invalid = ['$', '[', '!'] // avoid conflicts with math / wikilinks
        if (hs?.enabled && hs.marker && !invalid.includes(hs.marker)) {
          // exts.push(HeadingAltInput({ marker: hs.marker })) // Temporarily disabled
        }
        
        // Load editor settings
        const defaultEditorSettings = {
          font: {
            family: 'ui-sans-serif',
            size: 16,
            lineHeight: 1.7,
            letterSpacing: 0.003
          },
          typography: {
            h1Size: 2.0,
            h2Size: 1.6,
            h3Size: 1.3,
            headingColor: 'inherit',
            codeBlockTheme: 'default',
            linkColor: 'rgb(var(--accent))'
          },
          behavior: {
            autoPairBrackets: true,
            smartQuotes: false,
            autoIndent: true,
            wordWrap: true,
            showLineNumbers: false
          },
          appearance: {
            showMarkdown: false,
            focusMode: false,
            typewriterMode: false
          }
        };
        
        const editorConfig = cfg.editor || {};
        const mergedSettings = {
          font: { ...defaultEditorSettings.font, ...editorConfig.font },
          typography: { ...defaultEditorSettings.typography, ...editorConfig.typography },
          behavior: { ...defaultEditorSettings.behavior, ...editorConfig.behavior },
          appearance: { ...defaultEditorSettings.appearance, ...editorConfig.appearance }
        };
        
        setEditorSettings(mergedSettings);
        
      } catch (e) {
        // Use defaults if loading fails
        setEditorSettings({
          font: { family: 'ui-sans-serif', size: 16, lineHeight: 1.7, letterSpacing: 0.003 },
          typography: { h1Size: 2.0, h2Size: 1.6, h3Size: 1.3, headingColor: 'inherit', codeBlockTheme: 'default', linkColor: 'rgb(var(--accent))' },
          behavior: { autoPairBrackets: true, smartQuotes: false, autoIndent: true, wordWrap: true, showLineNumbers: false },
          appearance: { showMarkdown: false, focusMode: false, typewriterMode: false }
        });
      }
      
      exts.push(Placeholder.configure({ placeholder: "Press '/' for commands..." }));
      exts.push(SlashCommand);
      setExtensions(exts);
      setLoading(false);
    })()
  }, [pluginExtensions, lastPluginUpdate]);

  // Persist editor mode changes
  useEffect(() => {
    try {
      const activeFile = globalThis.__LOKUS_ACTIVE_FILE__;
      if (activeFile) {
        localStorage.setItem(`editor-mode:${activeFile}`, editorMode);
      }
    } catch {}
  }, [editorMode]);

  // Keyboard shortcut for cycling modes (Cmd/Ctrl+E)
  useEffect(() => {
    const handleModeShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setEditorMode(current => {
          if (current === 'edit') return 'live';
          if (current === 'live') return 'reading';
          return 'edit';
        });
      }
    };

    document.addEventListener('keydown', handleModeShortcut);
    return () => document.removeEventListener('keydown', handleModeShortcut);
  }, []);

  // Expose editorMode to parent via window global for sidebar access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__LOKUS_EDITOR_MODE__ = editorMode;
      window.__LOKUS_SET_EDITOR_MODE__ = setEditorMode;
    }
  }, [editorMode]);

  if (loading || !extensions || !editorSettings) {
    return <div className="m-5 text-app-muted">Loading editor…</div>;
  }

  return (
    <Tiptap ref={ref} extensions={extensions} content={content} onContentChange={onContentChange} editorSettings={editorSettings} editorMode={editorMode} onEditorReady={onEditorReady} />
  );
});

const Tiptap = forwardRef(({ extensions, content, onContentChange, editorSettings, editorMode = 'edit', onEditorReady }, ref) => {
  const isSettingRef = useRef(false);
  const [isWikiLinkModalOpen, setIsWikiLinkModalOpen] = useState(false);
  const [isTaskCreationModalOpen, setIsTaskCreationModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [imageViewerState, setImageViewerState] = useState({ isOpen: false, imagePath: null });

  // Subscribe to live settings changes for real-time updates
  const [liveSettings, setLiveSettings] = useState(liveEditorSettings.getAllSettings());
  
  useEffect(() => {
    const unsubscribe = liveEditorSettings.onSettingsChange((key, value, allSettings) => {
      setLiveSettings(allSettings);
    });
    return unsubscribe;
  }, []);

  // Memoize callbacks for performance
  const handleEditorUpdate = useCallback(({ editor }) => {
    if (isSettingRef.current) {
      isSettingRef.current = false;
      return;
    }
    onContentChange(editor.getHTML());

    // Index tags for autocomplete
    try {
      const activeFile = globalThis.__LOKUS_ACTIVE_FILE__;
      if (activeFile) {
        // Import tagManager and index the content
        import('../../core/tags/tag-manager.js').then(({ default: tagManager }) => {
          const content = editor.getText();
          tagManager.indexNote(activeFile, content);
        });
      }
    } catch (error) {
      console.error('[Editor] Failed to index tags:', error);
    }
  }, [onContentChange]);

  const editor = useEditor({
    extensions,
    shouldRerenderOnTransaction: false,
    onBeforeCreate: ({ editor }) => {
      // Set editor instance in the plugin API for hot reloading
      editorAPI.setEditorInstance(editor);
    },
    onCreate: ({ editor }) => {
      // Update editor instance reference
      editorAPI.setEditorInstance(editor);
    },
    onDestroy: () => {
      // Clear editor instance reference
      editorAPI.setEditorInstance(null);
    },
    editorProps: {
      attributes: { class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none tiptap-area obsidian-editor" },
      handleDOMEvents: {
        click: (view, event) => {
          const t = event.target;
          if (!(t instanceof Element)) return false;

          // Handle image clicks
          const img = t.closest('img.editor-image');
          if (img) {
            event.preventDefault();
            const src = img.getAttribute('src') || '';
            if (src) {
              setImageViewerState({ isOpen: true, imagePath: src });
            }
            return true;
          }

          // Handle wiki-link clicks
          const el = t.closest('[data-type="wiki-link"]');
          if (!el) return false;
          const href = el.getAttribute('href') || '';
          const target = el.getAttribute('target') || '';
          if (!href) return true;

          event.preventDefault();

          // Log for debugging

          // Check if this is a resolved file path that exists in the index
          const index = globalThis.__LOKUS_FILE_INDEX__ || [];
          const fileExists = index.some(f => f.path === href);

          if (!fileExists && target) {
            // Show a user-friendly message
            try {
              // You could show a toast notification here instead
            } catch {}
          }

          // Emit to workspace to open file (Tauri or DOM event)
          (async () => {
            try {
              const { emit } = await import('@tauri-apps/api/event');
              await emit('lokus:open-file', href);
            } catch {
              try { window.dispatchEvent(new CustomEvent('lokus:open-file', { detail: href })); } catch {}
            }
          })();
          return true;
        },
      },
    },
    content,
    onUpdate: handleEditorUpdate,
  }, [extensions, handleEditorUpdate]);

  useEffect(() => {
    if (editor) onEditorReady(editor); 
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);


  // Keyboard shortcuts and event listeners for WikiLink and Task insertion
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+L: Open WikiLink modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setIsWikiLinkModalOpen(true);
        return;
      }

      // Task shortcuts - need editor instance
      if (!editor) return;

      // Ctrl+Shift+T: Open task creation modal (!task)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setIsTaskCreationModalOpen(true);
        return;
      }

      // Ctrl+Shift+K: Insert @task (triggers task mention autocomplete)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        editor.chain().focus().insertContent('@').run();
        return;
      }
    };

    // Listen for custom event from TaskCreationTrigger extension
    const handleTaskModalEvent = () => {
      setIsTaskCreationModalOpen(true);
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('lokus:open-task-modal', handleTaskModalEvent);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('lokus:open-task-modal', handleTaskModalEvent);
    };
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isSettingRef.current = true;

      // Content is already processed in Workspace.jsx, just set it directly
      // This prevents double markdown-it processing which corrupts custom HTML tags
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Expose editor instance to parent component via ref
  useImperativeHandle(ref, () => ({
    commands: editor?.commands,
    chain: () => editor?.chain(),
    state: editor?.state,
    view: editor?.view,
    getHTML: () => editor?.getHTML(),
    getText: () => editor?.getText(),
    setContent: (content) => editor?.commands?.setContent(content),
    insertContent: (content) => editor?.commands?.insertContent(content),
    focus: () => editor?.commands?.focus(),
    editor
  }), [editor]);

  const showDebug = useMemo(() => {
    try { const p = new URLSearchParams(window.location.search); if (p.get('dev') === '1') return true; } catch {}
    try { return !!import.meta?.env?.DEV; } catch { return false; }
  }, []);

  async function waitForCommand(cmd, { interval = 100, timeout = 5000 } = {}) {
    const start = Date.now();
    for (;;) {
      if (editor?.commands?.[cmd]) return true;
      if (Date.now() - start >= timeout) return false;
      await new Promise(r => setTimeout(r, interval));
    }
  }
  const insertTestTable = async () => {
    if (editor?.commands?.insertTable) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      return;
    }
    // Fallback: insert HTML table content, which works as long as table nodes are in the schema
    const body = Array.from({ length: 3 }).map(() => `<tr><td> </td><td> </td><td> </td></tr>`).join('');
    const html = `<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody>${body}</tbody></table>`;
    editor.chain().focus().insertContent(html).run();
  };

  const handleEditorAction = (action, data) => {
    if (!editor) return;

    switch (action) {
      case 'cut':
        document.execCommand('cut');
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'paste':
        document.execCommand('paste');
        break;
      case 'selectAll':
        editor.commands.selectAll();
        break;
      case 'undo':
        editor.commands.undo();
        break;
      case 'redo':
        editor.commands.redo();
        break;
      case 'toggleBold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'toggleItalic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'toggleStrikethrough':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'toggleCode':
        editor.chain().focus().toggleCode().run();
        break;
      case 'clearFormatting':
        editor.chain().focus().clearNodes().unsetAllMarks().run();
        break;
      case 'setHeading':
        if (data?.level) {
          editor.chain().focus().setHeading({ level: data.level }).run();
        }
        break;
      case 'setParagraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'toggleBulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'toggleOrderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'toggleTaskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'find':
        // Trigger in-file search
        window.dispatchEvent(new CustomEvent('lokus:toggle-search'));
        break;
      case 'findAndReplace':
        // Trigger in-file search with replace mode
        window.dispatchEvent(new CustomEvent('lokus:toggle-search', { detail: { replaceMode: true } }));
        break;
      case 'commandPalette':
        // Dispatch event to open command palette
        window.dispatchEvent(new CustomEvent('lokus:command-palette'));
        break;
      case 'insertTable':
        insertTestTable();
        break;
      case 'insertCodeBlock':
        editor.commands.setCodeBlock();
        break;
      case 'insertQuote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'insertHorizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'insertLink':
        const url = window.prompt('Enter URL:');
        if (url) {
          editor.commands.setLink({ href: url });
        }
        break;
      case 'insertImage':
        const imageUrl = window.prompt('Enter image URL:');
        if (imageUrl) {
          editor.commands.setImage({ src: imageUrl });
        }
        break;
      case 'exportMarkdown':
      case 'exportHTML':
      case 'exportPDF':
        // Open export modal
        setIsExportModalOpen(true);
        break;
      case 'importFile':
        // Trigger file import dialog
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.txt,.html';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const text = await file.text();
            editor.commands.setContent(text);
          }
        };
        input.click();
        break;
      default:
    }
  };

  // WikiLink modal handlers
  const handleSelectFile = useCallback((file) => {
    if (editor) {
      // Use the WikiLink command to create a proper link node
      const raw = `${file.path}|${file.name}`;
      editor.commands.setWikiLink(raw, { embed: false });
    }
  }, [editor]);

  // Task creation handler
  const handleCreateTask = useCallback(({ boardName, columnName, taskName }) => {
    if (editor) {
      // Insert the task mention in the correct format: @task[BoardName:TaskTitle]
      editor.chain().focus().insertContent(`@task[${boardName}:${taskName}] `).run();
    }
  }, [editor]);

  // Reading mode - show non-editable HTML view
  if (editorMode === 'reading') {
    return (
      <ReadingModeView
        content={editor?.getHTML() || content}
        editorSettings={editorSettings}
      />
    );
  }

  console.log(editor?.state.doc?.content?.content);
  
  // Edit and Live Preview modes - show TipTap editor
  // In live mode, we keep editor editable but could add visual hints
  return (
    <>
      {editor && showDebug && (
        <div className="m-5 mb-0 flex gap-2">
          <button type="button" onClick={insertTestTable} className="px-2 py-1 text-sm rounded border bg-app-panel border-app-border hover:bg-app-accent/10">Insert Test Table</button>
        </div>
      )}
      {editor && <TableBubbleMenu editor={editor} />}
      <EditorContextMenu
        onAction={handleEditorAction}
        hasSelection={editor?.state?.selection && !editor.state.selection.empty}
        canUndo={editor?.can().undo()}
        canRedo={editor?.can().redo()}
      >
          <EditorContent
            editor={editor}
            className={editorMode === 'live' ? 'live-preview-mode' : ''}
          />
      </EditorContextMenu>

      {/* WikiLink Modal */}
      <WikiLinkModal
        isOpen={isWikiLinkModalOpen}
        onClose={() => setIsWikiLinkModalOpen(false)}
        onSelectFile={handleSelectFile}
        workspacePath={globalThis.__LOKUS_WORKSPACE_PATH__}
        currentFile={globalThis.__LOKUS_ACTIVE_FILE__}
      />

      {/* Task Creation Modal */}
      <TaskCreationModal
        isOpen={isTaskCreationModalOpen}
        onClose={() => setIsTaskCreationModalOpen(false)}
        onCreateTask={handleCreateTask}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        htmlContent={editor?.getHTML()}
        currentFile={{
          name: globalThis.__LOKUS_ACTIVE_FILE__?.name || 'untitled',
          path: globalThis.__LOKUS_ACTIVE_FILE__?.path,
        }}
        workspacePath={globalThis.__LOKUS_WORKSPACE_PATH__}
        exportType="single"
      />

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={imageViewerState.isOpen}
        imagePath={imageViewerState.imagePath}
        allImageFiles={globalThis.__LOKUS_ALL_IMAGE_FILES__ || []}
        onClose={() => setImageViewerState({ isOpen: false, imagePath: null })}
      />
    </>
  );
});

export default Editor;