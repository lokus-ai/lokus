import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
import HeadingAltInput from "../extensions/HeadingAltInput.js";
import MarkdownPaste from "../extensions/MarkdownPaste.js";
import MarkdownTablePaste from "../extensions/MarkdownTablePaste.js";
import liveEditorSettings from "../../core/editor/live-settings.js";

import InFileSearch from "../../components/InFileSearch.jsx";
import { createSearchPlugin } from "../../core/search/index.js";
import { listen } from "@tauri-apps/api/event";
import MarkdownIt from "markdown-it";
import markdownItMark from "markdown-it-mark";
import markdownItStrikethrough from "markdown-it-strikethrough-alt";


import "../styles/editor.css";
import "../../core/search/search.css";

const Editor = ({ content, onContentChange }) => {
  const [extensions, setExtensions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editorSettings, setEditorSettings] = useState(null);

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

    const exts = [StarterKit];
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
    
    // Markdown paste functionality
    exts.push(MarkdownPaste);
    exts.push(MarkdownTablePaste);

    // Search functionality
    exts.push(createSearchPlugin());

    // Load markdown shortcut prefs and editor settings
    (async () => {
      try {
        const { readConfig } = await import('../../core/config/store.js')
        const cfg = (await readConfig()) || {}
        
        // Load markdown shortcuts
        const hs = cfg.markdownShortcuts?.headingAlt
        const invalid = ['$', '[', '!'] // avoid conflicts with math / wikilinks
        if (hs?.enabled && hs.marker && !invalid.includes(hs.marker)) {
          exts.push(HeadingAltInput({ marker: hs.marker }))
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
        console.warn('[editor] failed to load configuration:', e)
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
  }, []);

  if (loading || !extensions || !editorSettings) {
    return <div className="m-5 text-app-muted">Loading editor…</div>;
  }

  return <Tiptap extensions={extensions} content={content} onContentChange={onContentChange} editorSettings={editorSettings} />;
};

function Tiptap({ extensions, content, onContentChange, editorSettings }) {
  const isSettingRef = useRef(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Subscribe to live settings changes for real-time updates
  const [liveSettings, setLiveSettings] = useState(liveEditorSettings.getAllSettings());
  
  useEffect(() => {
    const unsubscribe = liveEditorSettings.onSettingsChange((key, value, allSettings) => {
      setLiveSettings(allSettings);
    });
    return unsubscribe;
  }, []);

  // Listen for global find command
  useEffect(() => {
    let isTauri = false; 
    try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch {}
    
    if (isTauri) {
      const sub = listen('lokus:find', () => setIsSearchOpen(true));
      return () => { sub.then(u => u()); };
    } else {
      const onDom = () => setIsSearchOpen(true);
      window.addEventListener('lokus:find', onDom);
      return () => window.removeEventListener('lokus:find', onDom);
    }
  }, []);

  
  // Memoize callbacks for performance
  const handleEditorUpdate = useCallback(({ editor }) => {
    if (isSettingRef.current) { 
      isSettingRef.current = false; 
      return; 
    }
    onContentChange(editor.getHTML());
  }, [onContentChange]);
  
  const editor = useEditor({
    extensions,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none tiptap-area pb-16 smooth-type" },
      handleDOMEvents: {
        keydown: (view, event) => {
          // Handle Ctrl+F for search
          if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            setIsSearchOpen(true);
            return true;
          }
          
          // Handle Ctrl+H for find and replace
          if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
            event.preventDefault();
            setIsSearchOpen(true);
            return true;
          }
          
          return false;
        },
        click: (view, event) => {
          const t = event.target;
          if (!(t instanceof Element)) return false;
          const el = t.closest('[data-type="wiki-link"]');
          if (!el) return false;
          const href = el.getAttribute('href') || '';
          if (!href) return true;
          event.preventDefault();
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
    if (editor && content !== editor.getHTML()) {
      isSettingRef.current = true;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Listen for goto-line command (from search results)
  useEffect(() => {
    if (!editor) return;

    const findDocumentPosition = (doc, textOffset) => {
      let currentOffset = 0;
      let position = null;
      
      doc.descendants((node, pos) => {
        if (node.isText) {
          const nodeEnd = currentOffset + node.text.length;
          if (textOffset >= currentOffset && textOffset <= nodeEnd) {
            position = pos + (textOffset - currentOffset);
            return false; // Stop iteration
          }
          currentOffset = nodeEnd;
        }
        return true;
      });
      
      return position;
    };

    const handleGotoLine = (event) => {
      if (!editor) return;
      
      const { line, column = 0 } = event.detail;
      
      // Convert line number to document position
      const content = editor.state.doc.textContent;
      const lines = content.split('\n');
      
      if (line > lines.length) return;
      
      // Calculate position from line number
      let position = 0;
      for (let i = 0; i < line - 1; i++) {
        position += lines[i].length + 1; // +1 for newline
      }
      position += Math.min(column, lines[line - 1]?.length || 0);
      
      // Convert text position to document position
      const docPos = findDocumentPosition(editor.state.doc, position);
      if (docPos !== null) {
        const selection = editor.state.selection.constructor.create(editor.state.doc, docPos);
        const tr = editor.state.tr.setSelection(selection);
        editor.view.dispatch(tr);
        editor.commands.scrollIntoView();
      }
    };

    window.addEventListener('lokus:goto-line', handleGotoLine);
    return () => window.removeEventListener('lokus:goto-line', handleGotoLine);
  }, [editor]);

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
      case 'find':
        setIsSearchOpen(true);
        break;
      case 'findAndReplace':
        setIsSearchOpen(true);
        // The search component will handle showing replace options
        break;
      case 'commandPalette':
        // Dispatch event to open command palette
        try {
          window.dispatchEvent(new CustomEvent('lokus:command-palette'));
        } catch (e) {
          console.log('Command palette action');
        }
        break;
      case 'insertTable':
        insertTestTable();
        break;
      case 'insertCodeBlock':
        editor.commands.setCodeBlock();
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
        // TODO: Implement markdown export
        console.log('Export as markdown');
        break;
      case 'exportHTML':
        // TODO: Implement HTML export  
        console.log('Export as HTML');
        break;
      case 'importFile':
        // TODO: Implement file import
        console.log('Import file');
        break;
      default:
        console.log('Unhandled editor action:', action);
    }
  };

  return (
    <>
      {editor && showDebug && (
        <div className="m-5 mb-0 flex gap-2">
          <button type="button" onClick={insertTestTable} className="px-2 py-1 text-sm rounded border bg-app-panel border-app-border hover:bg-app-accent/10">Insert Test Table</button>
        </div>
      )}
      {editor && <TableBubbleMenu editor={editor} />}
      <InFileSearch 
        editor={editor}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
      <EditorContextMenu 
        onAction={handleEditorAction}
        hasSelection={editor?.state?.selection && !editor.state.selection.empty}
        canUndo={editor?.can().undo()}
        canRedo={editor?.can().redo()}
      >
        <EditorContent editor={editor} />
      </EditorContextMenu>
    </>
  );
}

export default Editor;
