import React, { useEffect, useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import * as Sentry from "@sentry/react";
import { recoverContent } from "../lib/sanitizeHTML.js";

// --- ProseMirror core imports (replacing TipTap) ---
import useProseMirror from '../hooks/useProseMirror.js';
import { lokusSchema } from '../schema/lokus-schema.js';
import { createLokusSerializer } from '../../core/markdown/lokus-md-pipeline.js';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn, chainCommands } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { InputRule, inputRules, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';
import { createEditorCommands, insertContent as pmInsertContent } from '../commands/index.js';

// --- Extension plugin factories ---
import { createBlockIdPlugin } from '../extensions/BlockId.js';
import { createTaskSyntaxHighlightPlugin } from '../extensions/TaskSyntaxHighlight.js';
import { createFoldingPlugins } from '../extensions/Folding.js';
import { createMarkdownPastePlugin } from '../extensions/MarkdownPaste.js';
import { createMarkdownTablePastePlugin } from '../extensions/MarkdownTablePaste.js';
import { createPluginHoverPlugin } from '../extensions/PluginHover.js';
import { createTaskCreationTriggerPlugin } from '../extensions/TaskCreationTrigger.js';
import { createCalloutPlugins } from '../extensions/Callout.js';
import { createWikiLinkPlugins } from '../extensions/WikiLink.js';
import { createWikiLinkEmbedPlugins } from '../extensions/WikiLinkEmbed.js';
import { createCanvasLinkPlugins } from '../extensions/CanvasLink.js';
import { createCodeBlockPlugins } from '../extensions/CustomCodeBlock.js';
import { createCodeBlockIndentPlugin } from '../extensions/CodeBlockIndent.js';
import { createMathSnippetsPlugins } from '../extensions/MathSnippets.js';
import { createSymbolShortcutsPlugin } from '../extensions/SymbolShortcuts.js';
import { createMermaidInputRulesPlugin, mermaidNodeView } from '../extensions/MermaidDiagram.jsx';
import { inlineMathNodeView } from '../extensions/InlineMath.jsx';
import { createWikiLinkNodeView } from '../extensions/WikiLink.js';
import { createCanvasLinkNodeView } from '../extensions/CanvasLink.js';
// View-dependent plugin factories (need EditorView, created in onReady)
import { createSlashCommandPlugin } from '../lib/SlashCommand.js';
import { createWikiLinkSuggestPlugins } from '../lib/WikiLinkSuggest.js';
import { createTagAutocompletePlugin } from '../extensions/TagAutocomplete.js';
import { createTaskMentionSuggestPlugin } from '../extensions/TaskMentionSuggest.js';
import { createPluginCompletionPlugin } from '../extensions/PluginCompletion.js';

import { convertFileSrc } from "@tauri-apps/api/core";
import TableBubbleMenu from "./TableBubbleMenu.jsx";
import EditorContextMenu from "../../components/EditorContextMenu.jsx";
import liveEditorSettings from "../../core/editor/live-settings.js";
import WikiLinkModal from "../../components/WikiLinkModal.jsx";
import TaskCreationModal from "../../components/TaskCreationModal.jsx";
import ExportModal from "../../views/ExportModal.jsx";
import ImageInsertModal from "../../components/ImageInsertModal.jsx";
import ImageUrlModal from "./ImageUrlModal.jsx";
import MathFormulaModal from "../../components/MathFormulaModal.jsx";
import SymbolPickerModal from "../../components/SymbolPickerModal.jsx";
import ReadingModeView from "./ReadingModeView.jsx";
import PagePreview from "../../components/PagePreview.jsx";
import { ImageViewerModal } from "../../components/ImageViewer/ImageViewerModal.jsx";
import { findImageFiles } from "../../utils/imageUtils.js";
import { editorAPI } from "../../plugins/api/EditorAPI.js";
import { pluginAPI } from "../../plugins/api/PluginAPI.js";

import "../styles/editor.css";
import "../styles/block-embeds.css";
import "../../styles/page-preview.css";
import "../../styles/canvas-extensions.css";
import "../../styles/canvas-preview.css";

// ---------------------------------------------------------------------------
// Outer Editor component
//
// Builds the PM plugins array + nodeViews object, loads settings,
// and renders the inner Tiptap (now ProseMirror) component.
// ---------------------------------------------------------------------------

const Editor = forwardRef(({ content, onContentChange, onEditorReady, isLoading = false }, ref) => {
  const [plugins, setPlugins] = useState(null);
  const [nodeViews, setNodeViews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editorSettings, setEditorSettings] = useState(null);
  const [pluginExtensions, setPluginExtensions] = useState([]);
  const [lastPluginUpdate, setLastPluginUpdate] = useState(0);
  const [customSymbols, setCustomSymbols] = useState({});

  const [showSymbolPicker, setShowSymbolPicker] = useState(false);

  // Lazy view ref for suggestion plugins. The proxy forwards all property
  // accesses to the actual EditorView once it's available. This lets us
  // create suggestion plugins as static plugins (no onReady reconfigure).
  const viewRefForPlugins = useRef(null);
  const viewProxy = useMemo(() => new Proxy({}, {
    get(_, prop) {
      const view = viewRefForPlugins.current;
      if (!view) return undefined;
      const val = view[prop];
      return typeof val === 'function' ? val.bind(view) : val;
    },
  }), []);

  // Reading mode state: 'edit', 'live', 'reading'
  const [editorMode, setEditorMode] = useState(() => {
    // Try to load mode from localStorage
    try {
      const activeFile = globalThis.__LOKUS_ACTIVE_FILE__;
      if (activeFile) {
        const saved = localStorage.getItem(`editor-mode:${activeFile}`);
        return saved || 'edit';
      }
    } catch { }
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

  // Build PM plugins array and nodeViews object
  useEffect(() => {
    const schema = lokusSchema;

    // ── Formatting keybindings ───────────────────────────────────────────
    const formattingKeymap = keymap({
      'Mod-b': toggleMark(schema.marks.bold),
      'Mod-i': toggleMark(schema.marks.italic),
      'Mod-`': toggleMark(schema.marks.code),
      'Mod-Shift-s': toggleMark(schema.marks.strike),
      'Mod-Shift-h': toggleMark(schema.marks.highlight),
    });

    // ── Block-reset keymap ───────────────────────────────────────────────
    // Backspace at the start of a non-paragraph textblock (heading,
    // blockquote, etc.) converts it back to a plain paragraph.
    // ProseMirror's baseKeymap only joins/lifts — it never resets the
    // block type. TipTap's extensions provided this; raw PM needs it
    // explicitly.
    const blockResetKeymap = keymap({
      Backspace: (state, dispatch) => {
        const { $cursor } = state.selection;
        // Only act on a collapsed cursor at the very start of a textblock
        if (!$cursor || $cursor.parentOffset !== 0) return false;
        const parent = $cursor.parent;
        const paragraphType = schema.nodes.paragraph;
        // Already a paragraph or not a textblock — let baseKeymap handle it
        if (parent.type === paragraphType || !parent.isTextblock) return false;
        // Convert heading / code-block / etc. → paragraph
        if (dispatch) {
          dispatch(state.tr.setBlockType($cursor.before(), $cursor.after(), paragraphType));
        }
        return true;
      },
    });

    // ── List keymap ────────────────────────────────────────────────────
    // Enter inside a list item splits it into two items (new checkbox / bullet).
    // Tab / Shift-Tab indent / dedent list items.
    // Must come BEFORE baseKeymap so Enter doesn't just split the paragraph.
    const listKeymap = keymap({
      Enter: chainCommands(
        splitListItem(schema.nodes.taskItem),
        splitListItem(schema.nodes.listItem),
      ),
      Tab: sinkListItem(schema.nodes.listItem),
      'Shift-Tab': liftListItem(schema.nodes.listItem),
    });

    // ── Input rules ─────────────────────────────────────────────────────
    // Basic markdown-style input rules for block types

    /**
     * Creates an InputRule that applies a mark to the text captured between
     * markdown delimiters when the closing delimiter is typed.
     *
     * The regex must:
     *   - End with `$` so it matches at the cursor position.
     *   - Capture the content between delimiters in group 1 (match[1]).
     *
     * @param {RegExp} regexp - Pattern matched against the text from the start
     *   of the current textblock up to (and including) the character just typed.
     * @param {import('prosemirror-model').MarkType} markType - The mark to apply.
     * @returns {InputRule}
     */
    function markInputRule(regexp, markType) {
      return new InputRule(regexp, (state, match, start, end) => {
        // match[1] is the text that should carry the mark.
        // match[0] is the full matched string (delimiters + content).
        const content = match[1];
        if (!content) return null;

        // Locate where the captured content begins inside the full match.
        const textStart = start + match[0].indexOf(content);
        const textEnd = textStart + content.length;

        let tr = state.tr;

        // Remove trailing delimiter(s) that sit between textEnd and end.
        if (textEnd < end) tr = tr.delete(textEnd, end);

        // Remove leading delimiter(s) that sit between start and textStart.
        if (textStart > start) tr = tr.delete(start, textStart);

        // After the deletions the content now occupies [start, start + content.length].
        const markStart = start;
        const markEnd = markStart + content.length;

        tr = tr.addMark(markStart, markEnd, markType.create());

        // Prevent the mark from continuing to subsequent typed text.
        // We use setStoredMarks instead of removeStoredMark because
        // removeStoredMark silently no-ops when no stored marks exist
        // (ensureMarks sees no change and doesn't set storedMarksSet).
        // setStoredMarks always sets the flag, ensuring the next keystroke
        // does NOT inherit the mark from the document structure.
        const activeMarks = state.storedMarks || state.doc.resolve(end).marks();
        tr = tr.setStoredMarks(activeMarks.filter(m => m.type !== markType));
        return tr;
      });
    }

    const lokusInputRules = inputRules({
      rules: [
        // > blockquote
        wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),

        // # heading (levels 1-6)
        textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
          level: match[1].length,
        })),

        // ``` code block
        textblockTypeInputRule(/^```([a-zA-Z]*)?\s$/, schema.nodes.codeBlock, (match) => ({
          language: match[1] || null,
        })),

        // --- horizontal rule — fires immediately on the third dash
        new InputRule(/^---$/, (state, match, start, end) => {
          const { horizontalRule, paragraph } = schema.nodes;
          if (!horizontalRule) return null;
          const $start = state.doc.resolve(start);
          const blockStart = $start.before($start.depth);
          const blockEnd = $start.after($start.depth);
          return state.tr.replaceWith(blockStart, blockEnd, [
            horizontalRule.create(),
            paragraph.create(),
          ]);
        }),

        // ___ / *** horizontal rule — requires trailing space (*** would
        // conflict with bold-italic if fired immediately)
        new InputRule(/^(___|\*\*\*)\s$/, (state, match, start, end) => {
          const { horizontalRule, paragraph } = schema.nodes;
          if (!horizontalRule) return null;
          const $start = state.doc.resolve(start);
          const blockStart = $start.before($start.depth);
          const blockEnd = $start.after($start.depth);
          return state.tr.replaceWith(blockStart, blockEnd, [
            horizontalRule.create(),
            paragraph.create(),
          ]);
        }),

        // - or * bullet list  (fires when user types "- " or "* ")
        wrappingInputRule(/^\s*[-*]\s$/, schema.nodes.bulletList),

        // [] / [ ] / [x] / - [] / - [ ] task list
        // Matches bracket patterns at start of a textblock.
        // Works in TWO contexts:
        //   A) Plain paragraph → creates taskList > taskItem directly
        //   B) Inside bulletList > listItem → converts bulletList to taskList
        new InputRule(/^\[([ xX!?/]?)\](\s?)$/, (state, match, start, end) => {
          const { taskList, taskItem, bulletList, listItem, paragraph } = schema.nodes;
          if (!taskList || !taskItem) return null;

          const checkChar = match[1] || ' ';
          const checked = checkChar.toLowerCase() === 'x';
          const taskState = checkChar === ' ' ? null : checkChar;

          const $pos = state.doc.resolve(start);

          // Check if we're inside a bulletList
          let listItemDepth = -1, bulletListDepth = -1;
          for (let d = $pos.depth; d > 0; d--) {
            if (listItem && $pos.node(d).type === listItem && listItemDepth === -1) listItemDepth = d;
            if (bulletList && $pos.node(d).type === bulletList && bulletListDepth === -1) { bulletListDepth = d; break; }
          }

          if (bulletListDepth !== -1 && listItemDepth !== -1) {
            // ── Context B: inside a bullet list → convert to task list ──
            const currentItemIndex = $pos.index(bulletListDepth);
            let tr = state.tr.delete(start, end);

            const mappedBlStart = tr.mapping.map($pos.before(bulletListDepth));
            const blNode = tr.doc.nodeAt(mappedBlStart);
            if (!blNode || blNode.type !== bulletList) return null;

            const blEnd = mappedBlStart + blNode.nodeSize;
            const items = [];
            let idx = 0;
            blNode.forEach((child) => {
              const attrs = idx === currentItemIndex
                ? { checked, taskState }
                : { checked: false, taskState: null };
              items.push(taskItem.create(attrs, child.content));
              idx++;
            });

            return tr.replaceWith(mappedBlStart, blEnd, taskList.create(null, items));
          }

          // ── Context A: plain paragraph → create task list directly ──
          if (!paragraph) return null;
          const blockStart = $pos.before($pos.depth);
          const blockEnd = $pos.after($pos.depth);

          const item = taskItem.create(
            { checked, taskState },
            paragraph.create(),
          );
          return state.tr.replaceWith(blockStart, blockEnd, taskList.create(null, item));
        }),

        // 1. ordered list
        wrappingInputRule(
          /^\s*(\d+)\.\s$/,
          schema.nodes.orderedList,
          (match) => ({ order: +match[1] }),
          (match, node) => node.childCount + node.attrs.order === +match[1]
        ),

        // ── Mark input rules ────────────────────────────────────────────
        // Each rule fires when the user types the closing delimiter of an
        // inline mark pair.  The content between the delimiters is captured
        // in group 1 and receives the corresponding mark.

        // **bold**
        markInputRule(/(?:^|\s)\*\*([^*\s][^*]*)\*\*$/, schema.marks.bold),

        // *italic*  — lookbehind prevents matching inside **bold**
        markInputRule(/(?:^|\s)(?<!\*)\*([^*\s][^*]*)\*(?!\*)$/, schema.marks.italic),

        // ~~strikethrough~~
        markInputRule(/(?:^|\s)~~([^~\s][^~]*)~~$/, schema.marks.strike),

        // ==highlight==
        markInputRule(/(?:^|\s)==([^=\s][^=]*)==$/, schema.marks.highlight),

        // `inline code`
        markInputRule(/(?:^|\s)`([^`\s][^`]*)`$/, schema.marks.code),

        // ^superscript^
        markInputRule(/(?:^|\s)\^([^^]+)\^$/, schema.marks.superscript),

        // ~subscript~  — lookbehind prevents matching inside ~~strike~~
        markInputRule(/(?:^|\s)(?<!~)~([^~\s][^~]*)~(?!~)$/, schema.marks.subscript),

        // ── Inline math ─────────────────────────────────────────────────
        // $$formula$$  →  inlineMath node with display mode (MUST come before single-$ rule)
        new InputRule(/(?:^|\s)\$\$([^$\s][^$]*)\$\$$/, (state, match, start, end) => {
          const { inlineMath } = schema.nodes;
          if (!inlineMath) return null;
          const fullMatch = match[0];
          const leadingSpace = fullMatch.length - fullMatch.trimStart().length;
          const dollarStart = start + leadingSpace;
          const node = inlineMath.create({ latex: match[1], display: 'yes' });
          return state.tr.replaceWith(dollarStart, end, node);
        }),

        // $formula$  →  inlineMath node (inline mode)
        // Negative lookbehind prevents matching inside $$block math$$
        new InputRule(/(?:^|\s)(?<!\$)\$([^$\s][^$]*)\$(?!\$)$/, (state, match, start, end) => {
          const { inlineMath } = schema.nodes;
          if (!inlineMath) return null;

          // Offset past any leading whitespace that was consumed by the regex.
          const fullMatch = match[0];
          const leadingSpace = fullMatch.length - fullMatch.trimStart().length;
          const dollarStart = start + leadingSpace;

          const node = inlineMath.create({ latex: match[1], display: 'no' });
          return state.tr.replaceWith(dollarStart, end, node);
        }),
      ],
    });

    // ── Core plugins array ──────────────────────────────────────────────
    // Plugin ordering matters: ProseMirror calls handleKeyDown from
    // plugins in registration order — first to return true wins.
    // Suggestion plugins MUST come before keymap(baseKeymap) so they
    // can intercept Enter/Tab while a suggestion popup is active.
    // When no suggestion is active they return false and keys fall
    // through to the base keymap normally.
    const pmPlugins = [
      lokusInputRules,
      formattingKeymap,
      // ── Suggestion plugins (must precede baseKeymap) ────────────────
      createSlashCommandPlugin(viewProxy),
      ...createWikiLinkSuggestPlugins(viewProxy),
      createTagAutocompletePlugin(viewProxy),
      createTaskMentionSuggestPlugin(viewProxy),
      createPluginCompletionPlugin(viewProxy),
      // ── Base keymap & core ──────────────────────────────────────────
      listKeymap,
      blockResetKeymap,
      keymap(baseKeymap),
      history(),
      keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
      dropCursor(),
      gapCursor(),
      // Trivial extensions
      createBlockIdPlugin(),
      createTaskSyntaxHighlightPlugin(),
      ...createFoldingPlugins(),
      createMarkdownPastePlugin(),
      createMarkdownTablePastePlugin(),
      createPluginHoverPlugin(),
      createTaskCreationTriggerPlugin(),
      // Schema-dependent extensions
      ...createCalloutPlugins(schema),
      ...createWikiLinkPlugins(schema),
      ...createWikiLinkEmbedPlugins(schema),
      ...createCanvasLinkPlugins(schema),
      ...createCodeBlockPlugins(schema),
      createCodeBlockIndentPlugin(),
      ...createMathSnippetsPlugins(schema, { customSnippets: customSymbols }),
      createSymbolShortcutsPlugin({ customSymbols }),
      createMermaidInputRulesPlugin(schema),
    ];

    // ── Node views ──────────────────────────────────────────────────────
    const pmNodeViews = {
      mermaid: mermaidNodeView,
      inlineMath: inlineMathNodeView,
      wikiLink: createWikiLinkNodeView,
      canvasLink: createCanvasLinkNodeView,
    };

    // ── Load editor settings then finalize ──────────────────────────────
    // Stale flag: if this effect re-runs before the async work finishes,
    // the previous invocation's setPlugins is skipped to prevent a late
    // reconfigure from racing with user interaction.
    let stale = false;

    (async () => {
      try {
        const { readConfig } = await import('../../core/config/store.js');
        if (stale) return;
        const cfg = (await readConfig()) || {};
        if (stale) return;

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
        if (stale) return;
        // Use defaults if loading fails
        setEditorSettings({
          font: { family: 'ui-sans-serif', size: 16, lineHeight: 1.7, letterSpacing: 0.003 },
          typography: { h1Size: 2.0, h2Size: 1.6, h3Size: 1.3, headingColor: 'inherit', codeBlockTheme: 'default', linkColor: 'rgb(var(--accent))' },
          behavior: { autoPairBrackets: true, smartQuotes: false, autoIndent: true, wordWrap: true, showLineNumbers: false },
          appearance: { showMarkdown: false, focusMode: false, typewriterMode: false }
        });
      }

      if (stale) return;
      setPlugins(pmPlugins);
      setNodeViews(pmNodeViews);
      setLoading(false);
    })();

    return () => { stale = true; };
  }, [pluginExtensions, lastPluginUpdate, customSymbols]);

  // Load custom symbols from config and listen for changes
  useEffect(() => {
    let unlisten = null;

    const loadCustomSymbols = async () => {
      try {
        const { readConfig } = await import('../../core/config/store.js');
        const cfg = await readConfig();
        if (cfg?.customSymbols) {
          setCustomSymbols(cfg.customSymbols);
        }
      } catch { }
    };

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('lokus:custom-symbols-changed', (event) => {
          if (event.payload?.symbols) {
            setCustomSymbols(event.payload.symbols);
          }
        });
      } catch { }
    };

    loadCustomSymbols();
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Persist editor mode changes
  useEffect(() => {
    try {
      const activeFile = globalThis.__LOKUS_ACTIVE_FILE__;
      if (activeFile) {
        localStorage.setItem(`editor-mode:${activeFile}`, editorMode);
      }
    } catch { }
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

  // Keyboard shortcut for symbol picker (Cmd/Ctrl+;)
  useEffect(() => {
    const handleSymbolPickerShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ';') {
        e.preventDefault();
        setShowSymbolPicker(true);
      }
    };

    document.addEventListener('keydown', handleSymbolPickerShortcut);
    return () => document.removeEventListener('keydown', handleSymbolPickerShortcut);
  }, []);

  // Expose editorMode to parent via window global for sidebar access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__LOKUS_EDITOR_MODE__ = editorMode;
      window.__LOKUS_SET_EDITOR_MODE__ = setEditorMode;
    }
  }, [editorMode]);

  if (loading || !plugins || !editorSettings) {
    return <div className="m-5 text-app-muted">Loading editor...</div>;
  }

  return (
    <PMEditor
      ref={ref}
      plugins={plugins}
      nodeViews={nodeViews}
      content={content}
      onContentChange={onContentChange}
      editorSettings={editorSettings}
      editorMode={editorMode}
      onEditorReady={onEditorReady}
      isLoading={isLoading}
      showSymbolPicker={showSymbolPicker}
      setShowSymbolPicker={setShowSymbolPicker}
      customSymbols={customSymbols}
      viewRefForPlugins={viewRefForPlugins}
    />
  );
});

// ---------------------------------------------------------------------------
// Inner PMEditor component (was Tiptap)
//
// Creates the ProseMirror EditorView via useProseMirror, handles updates,
// renders the editor mount point.
// ---------------------------------------------------------------------------

const PMEditor = forwardRef(({ plugins, nodeViews, content, onContentChange, editorSettings, editorMode = 'edit', onEditorReady, isLoading = false, showSymbolPicker = false, setShowSymbolPicker, customSymbols = {}, viewRefForPlugins }, ref) => {
  const [isWikiLinkModalOpen, setIsWikiLinkModalOpen] = useState(false);
  const [isTaskCreationModalOpen, setIsTaskCreationModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [imageViewerState, setImageViewerState] = useState({ isOpen: false, imagePath: null });
  const [imageInsertModalState, setImageInsertModalState] = useState({ isOpen: false, onInsert: null });
  const [imageUrlModalState, setImageUrlModalState] = useState({ isOpen: false, onSubmit: null });
  const [mathFormulaModalState, setMathFormulaModalState] = useState({ isOpen: false, mode: 'inline', onInsert: null });

  // Page preview state
  const [previewData, setPreviewData] = useState(null);

  // Subscribe to live settings changes for real-time updates
  const [liveSettings, setLiveSettings] = useState(liveEditorSettings.getAllSettings());

  useEffect(() => {
    const unsubscribe = liveEditorSettings.onSettingsChange((key, value, allSettings) => {
      setLiveSettings(allSettings);
    });
    return unsubscribe;
  }, []);

  const tagIndexTimeoutRef = useRef(null);

  // ── onContentChange ref for stable callback identity ────────────────
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // ── handleUpdate — called only for user edits (programmatic filtered by useProseMirror) ──
  const handleUpdate = useCallback((view) => {
    onContentChangeRef.current(view);

    // Notify the plugin EditorAPI so SDK listeners fire
    editorAPI.notifyUpdate();
    editorAPI.notifySelectionUpdate();

    // Tag indexing (same debounced logic)
    if (tagIndexTimeoutRef.current) clearTimeout(tagIndexTimeoutRef.current);
    tagIndexTimeoutRef.current = setTimeout(() => {
      try {
        const activeFile = globalThis.__LOKUS_ACTIVE_FILE__;
        if (activeFile) {
          import('../../core/tags/tag-manager.js').then(({ default: tagManager }) => {
            tagManager.indexNote(activeFile, view.state.doc.textContent);
          });
        }
      } catch {}
    }, 2000);
  }, []);

  // ── useProseMirror hook ─────────────────────────────────────────────
  const { mountRef, viewRef } = useProseMirror({
    schema: lokusSchema,
    plugins,
    onUpdate: handleUpdate,
    nodeViews,
    editorProps: {
      attributes: { class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none lokus-editor obsidian-editor' },
      handleDOMEvents: {
        // Prevent browser's default drop handling - Tauri handles external file drops
        drop: (view, event) => {
          if (event.dataTransfer?.files?.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            return true; // Tauri's tauri://drag-drop handles this
          }
          return false; // Allow internal editor drops (e.g., text selection drag)
        },
        dragover: (view, event) => {
          if (event.dataTransfer?.types?.includes('Files')) {
            event.preventDefault();
            return true;
          }
          return false;
        },
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

          // Handle canvas-link clicks
          const canvasEl = t.closest('[data-type="canvas-link"]');
          if (canvasEl) {
            event.preventDefault();
            let canvasPath = canvasEl.getAttribute('href') || '';

            // Resolve path if it's just a canvas name
            if (canvasPath && !canvasPath.startsWith('/') && !canvasPath.includes('/')) {
              const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
              const canvasFileName = canvasPath.endsWith('.canvas') ? canvasPath : `${canvasPath}.canvas`;
              const matchedFile = fileIndex.find(file => {
                const fileName = file.name || file.path.split('/').pop();
                return fileName === canvasFileName || fileName === canvasPath;
              });
              if (matchedFile) {
                canvasPath = matchedFile.path;
              }
            }

            if (canvasPath) {
              // Use same emit logic as wiki-links
              (async () => {
                try {
                  const { emit } = await import('@tauri-apps/api/event');
                  await emit('lokus:open-file', canvasPath);
                } catch {
                  window.dispatchEvent(new CustomEvent('lokus:open-file', { detail: canvasPath }));
                }
              })();
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

          // Detect modifier keys for "open in new tab" behavior
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          const openInNewTab = isMac ? event.metaKey : event.ctrlKey;

          // Check if this is a block reference (contains ^)
          const hasBlockRef = (href && href.includes('^')) || (target && target.includes('^'));
          let blockId = null;
          let cleanHref = href;

          if (hasBlockRef) {
            const parts = href.split('^');
            cleanHref = parts[0];
            blockId = parts[1];
          }

          // Check if this is a resolved file path that exists in the index
          const index = globalThis.__LOKUS_FILE_INDEX__ || [];
          let fileExists = index.some(f => f.path === cleanHref);

          // If href is not a valid path, try to resolve it using the file index
          if (!fileExists && index.length > 0) {
            let searchTerm = target ? target.split('|')[0].split('^')[0].split('#')[0].trim() : cleanHref;
            const filename = (p) => (p || '').split(/[\\/]/).pop();
            const dirname = (p) => {
              if (!p) return '';
              const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
              return i >= 0 ? p.slice(0, i) : '';
            };
            const wsPath = globalThis.__LOKUS_WORKSPACE_PATH__ || '';

            // Check for explicit root marker (./)
            const isExplicitRoot = searchTerm.startsWith('./');
            if (isExplicitRoot) {
              searchTerm = searchTerm.slice(2);
              const rootFile = index.find(f => {
                const name = filename(f.path);
                const dir = dirname(f.path);
                const isInRoot = dir === wsPath || dir === wsPath.replace(/\/$/, '');
                return isInRoot && (name === searchTerm || name === `${searchTerm}.md`);
              });
              if (rootFile) {
                cleanHref = rootFile.path;
                fileExists = true;
              }
            } else {
              const hasPath = /[/\\]/.test(searchTerm);
              const activePath = globalThis.__LOKUS_ACTIVE_FILE__ || '';
              const activeDir = dirname(activePath);

              const candidates = index.filter(f => {
                if (hasPath) {
                  return f.path.endsWith(searchTerm) ||
                         f.path.endsWith(`${searchTerm}.md`);
                }
                const name = filename(f.path);
                return name === searchTerm ||
                       name === `${searchTerm}.md` ||
                       name.replace('.md', '') === searchTerm;
              });

              if (candidates.length > 0) {
                const sameFolder = candidates.find(f => dirname(f.path) === activeDir);
                cleanHref = sameFolder ? sameFolder.path : candidates[0].path;
                fileExists = true;
              }
            }
          }

          // Emit to workspace to open file (Tauri or DOM event)
          (async () => {
            // If file doesn't exist, create it first
            if (!fileExists) {
              const activePath = globalThis.__LOKUS_ACTIVE_FILE__ || '';
              const activeDir = activePath
                ? activePath.substring(0, Math.max(activePath.lastIndexOf('/'), activePath.lastIndexOf('\\')))
                : (globalThis.__LOKUS_WORKSPACE_PATH__ || '');

              // Build target path: same folder as current file, ensure .md extension
              if (!cleanHref.includes('/') && !cleanHref.includes('\\')) {
                cleanHref = `${activeDir}/${cleanHref}`;
              }
              if (!cleanHref.endsWith('.md')) {
                cleanHref = `${cleanHref}.md`;
              }

              try {
                const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                await tauriInvoke('write_file_content', { path: cleanHref, content: '' });
                // Refresh file tree so the new file appears in the sidebar
                try {
                  const { useFileTreeStore } = await import('../../stores/fileTree');
                  useFileTreeStore.getState().refreshTree?.();
                } catch {}
              } catch {}
            }

            try {
              const { emit } = await import('@tauri-apps/api/event');
              const eventName = openInNewTab ? 'lokus:open-file-new-tab' : 'lokus:open-file';
              await emit(eventName, cleanHref);
            } catch {
              try {
                const eventName = openInNewTab ? 'lokus:open-file-new-tab' : 'lokus:open-file';
                window.dispatchEvent(new CustomEvent(eventName, { detail: cleanHref }));
              } catch { }
            }

            // If block reference, also emit scroll event
            if (hasBlockRef && blockId) {
              window.dispatchEvent(new CustomEvent('lokus:scroll-to-block', { detail: blockId }));
            }
          })();
          return true;
        },
      },
    },
    onReady: (view) => {
      // Wire up the lazy view proxy so suggestion plugins can access the view.
      if (viewRefForPlugins) viewRefForPlugins.current = view;
      editorAPI.setEditorInstance(view);
      onEditorReady?.(view);
    },
    onDestroy: () => {
      if (viewRefForPlugins) viewRefForPlugins.current = null;
      editorAPI.setEditorInstance(null);
      onEditorReady?.(null);
    },
  });

  // NOTE: The content sync useEffect (old lines ~819-867) has been removed.
  // Content is now set imperatively by EditorGroup via the imperative handle below.
  // The useProseMirror hook starts with an empty doc, and EditorGroup calls
  // commands.setContent() to load real content.

  // Keyboard shortcuts and event listeners for WikiLink and Task insertion
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+L: Open WikiLink modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setIsWikiLinkModalOpen(true);
        return;
      }

      // Task shortcuts - need view instance
      const view = viewRef.current;
      if (!view) return;

      // Ctrl+Shift+T: Open task creation modal (!task)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setIsTaskCreationModalOpen(true);
        return;
      }

      // Ctrl+Shift+K: Insert @task (triggers task mention autocomplete)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        pmInsertContent(view, '@');
        return;
      }
    };

    // Listen for custom event from TaskCreationTrigger extension
    const handleTaskModalEvent = () => {
      setIsTaskCreationModalOpen(true);
    };

    // Listen for wiki link hover events
    const handleWikiLinkHover = (event) => {
      const { target, position } = event.detail;
      setPreviewData({ target, position });
    };

    const handleWikiLinkHoverEnd = () => {
      setPreviewData(null);
    };

    // Listen for image insert modal event
    const handleImageInsertModalEvent = (event) => {
      const { onInsert } = event.detail;
      setImageInsertModalState({ isOpen: true, onInsert });
    };

    // Listen for image URL modal event (from ![[ dropdown)
    const handleImageUrlModalEvent = (event) => {
      const { onSubmit } = event.detail;
      setImageUrlModalState({ isOpen: true, onSubmit });
    };

    // Listen for math formula modal event
    const handleMathFormulaModalEvent = (event) => {
      const { mode, onInsert } = event.detail;
      setMathFormulaModalState({ isOpen: true, mode, onInsert });
    };

    // Listen for template insertion from Command Palette
    const handleInsertTemplate = (event) => {
      const { content } = event.detail;
      const view = viewRef.current;
      if (view && content) {
        pmInsertContent(view, content);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('lokus:open-task-modal', handleTaskModalEvent);
    window.addEventListener('wiki-link-hover', handleWikiLinkHover);
    window.addEventListener('wiki-link-hover-end', handleWikiLinkHoverEnd);
    window.addEventListener('open-image-insert-modal', handleImageInsertModalEvent);
    window.addEventListener('lokus:open-image-url-modal', handleImageUrlModalEvent);
    window.addEventListener('open-math-formula-modal', handleMathFormulaModalEvent);
    window.addEventListener('lokus:insert-template', handleInsertTemplate);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('lokus:open-task-modal', handleTaskModalEvent);
      window.removeEventListener('wiki-link-hover', handleWikiLinkHover);
      window.removeEventListener('wiki-link-hover-end', handleWikiLinkHoverEnd);
      window.removeEventListener('open-image-insert-modal', handleImageInsertModalEvent);
      window.removeEventListener('lokus:open-image-url-modal', handleImageUrlModalEvent);
      window.removeEventListener('open-math-formula-modal', handleMathFormulaModalEvent);
      window.removeEventListener('lokus:insert-template', handleInsertTemplate);
    };
  }, []); // No dependency on editor — viewRef is stable

  // ── Expose editor instance to parent via ref ──────────────────────────
  useImperativeHandle(ref, () => ({
    view: viewRef.current,
    state: viewRef.current?.state,
    dispatch: (tr) => viewRef.current?.dispatch(tr),
    getJSON: () => viewRef.current?.state?.doc?.toJSON(),
    getText: () => viewRef.current?.state?.doc?.textContent,
    focus: () => viewRef.current?.focus(),
    // Keep backward compat for EditorGroup:
    commands: {
      setContent: (content, opts) => {
        const view = viewRef.current;
        if (!view) return;
        let doc;
        if (typeof content === 'object' && content !== null && content.type) {
          doc = view.state.schema.nodeFromJSON(content.type === 'doc' ? content : { type: 'doc', content: [content] });
        } else if (typeof content === 'string') {
          // Legacy HTML string — shouldn't happen after migration but handle gracefully
          console.warn('[PMEditor] setContent received HTML string — skipping. Use JSON doc format.');
          return;
        }
        if (!doc) return;
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
        tr.setMeta('programmatic', true);
        view.dispatch(tr);
      },
      focus: () => viewRef.current?.focus(),
      scrollIntoView: () => {
        const view = viewRef.current;
        if (view) view.dispatch(view.state.tr.scrollIntoView());
      },
    },
    // For backward compat during migration:
    getHTML: () => {
      const view = viewRef.current;
      if (!view) return '';
      try {
        const serializer = createLokusSerializer();
        return serializer.serialize(view.state.doc);
      } catch (err) {
        console.warn('[PMEditor] getHTML serialization failed:', err.message);
        return '';
      }
    },
    // Legacy compat: expose editor-like object for code that expects editor.state, editor.view etc.
    editor: {
      get state() { return viewRef.current?.state; },
      get view() { return viewRef.current; },
      getHTML() {
        const view = viewRef.current;
        if (!view) return '';
        try {
          const serializer = createLokusSerializer();
          return serializer.serialize(view.state.doc);
        } catch { return ''; }
      },
      getText() { return viewRef.current?.state?.doc?.textContent || ''; },
    },
  }), []);

  const showDebug = useMemo(() => {
    try { const p = new URLSearchParams(window.location.search); if (p.get('dev') === '1') return true; } catch { }
    try { return !!import.meta?.env?.DEV; } catch { return false; }
  }, []);

  const insertTestTable = async () => {
    const view = viewRef.current;
    if (!view) return;
    const cmds = createEditorCommands(view);
    cmds.insertTable({ rows: 3, cols: 3 });
  };

  const handleEditorAction = (action, data) => {
    const view = viewRef.current;
    if (!view) return;

    const cmds = createEditorCommands(view);

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
        cmds.selectAll();
        break;
      case 'undo':
        cmds.undo();
        break;
      case 'redo':
        cmds.redo();
        break;
      case 'toggleBold':
        cmds.toggleBold();
        break;
      case 'toggleItalic':
        cmds.toggleItalic();
        break;
      case 'toggleStrikethrough':
        cmds.toggleStrike();
        break;
      case 'toggleCode':
        cmds.toggleCode();
        break;
      case 'clearFormatting':
        cmds.unsetAllMarks();
        break;
      case 'setHeading':
        if (data?.level) {
          cmds.toggleHeading({ level: data.level });
        }
        break;
      case 'setParagraph':
        // Revert to paragraph
        cmds.toggleHeading({ level: 1 }); // toggle off — if already heading, reverts to paragraph
        break;
      case 'toggleBulletList':
        cmds.toggleBulletList();
        break;
      case 'toggleOrderedList':
        cmds.toggleOrderedList();
        break;
      case 'toggleTaskList':
        cmds.toggleTaskList();
        break;
      case 'find':
        window.dispatchEvent(new CustomEvent('lokus:toggle-search'));
        break;
      case 'findAndReplace':
        window.dispatchEvent(new CustomEvent('lokus:toggle-search', { detail: { replaceMode: true } }));
        break;
      case 'commandPalette':
        window.dispatchEvent(new CustomEvent('lokus:command-palette'));
        break;
      case 'insertTable':
        insertTestTable();
        break;
      case 'insertCodeBlock':
        cmds.toggleCodeBlock();
        break;
      case 'insertQuote':
        cmds.toggleBlockquote();
        break;
      case 'insertHorizontalRule':
        cmds.setHorizontalRule();
        break;
      case 'insertLink': {
        const url = window.prompt('Enter URL:');
        if (url) {
          // Apply link mark to selection
          const linkMark = view.state.schema.marks.link;
          if (linkMark) {
            const { from, to } = view.state.selection;
            if (from !== to) {
              const tr = view.state.tr.addMark(from, to, linkMark.create({ href: url }));
              view.dispatch(tr);
            }
          }
        }
        break;
      }
      case 'insertImage':
        // Insert ![[ to trigger image autocomplete dropdown
        pmInsertContent(view, '![[');
        break;
      case 'exportMarkdown':
      case 'exportHTML':
      case 'exportPDF':
        setIsExportModalOpen(true);
        break;
      case 'importFile': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.txt,.html';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const text = await file.text();
            // TODO: port to PM — need to parse imported content and set as doc
            console.warn('[PMEditor] importFile: raw text import not yet ported to PM');
          }
        };
        input.click();
        break;
      }
      case 'copyBlockReference':
        (async () => {
          try {
            const { state } = view;
            const { $from } = state.selection;
            const node = $from.parent;

            const blockIdManager = (await import('../../core/blocks/block-id-manager.js')).default;
            const { queueBlockIdWrite } = await import('../../core/blocks/block-writer.js');

            let blockId = node.attrs.blockId;

            if (!blockId) {
              blockId = blockIdManager.generateId();

              const pos = $from.before($from.depth);
              const tr = view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, blockId });
              view.dispatch(tr);

              if (typeof window !== 'undefined' && window.__LOKUS_ACTIVE_FILE__) {
                const activeFile = window.__LOKUS_ACTIVE_FILE__;

                let lineNumber = 1;
                state.doc.nodesBetween(0, pos, (node) => {
                  if (node.isBlock) lineNumber++;
                });

                queueBlockIdWrite(activeFile, lineNumber, blockId)
                  .then((success) => {
                    if (success) {
                      blockIdManager.invalidateFile(activeFile);
                    }
                  })
                  .catch(() => {});
              }
            }

            const activeFile = window.__LOKUS_ACTIVE_FILE__ || '';
            const fileName = activeFile.split('/').pop()?.replace('.md', '') || 'Unknown';
            const reference = `[[${fileName}^${blockId}]]`;

            await navigator.clipboard.writeText(reference);
          } catch { }
        })();
        break;
      case 'copyCode': {
        const { state } = view;
        const { $from } = state.selection;
        const node = $from.node($from.depth);

        if (node.type.name === 'codeBlock') {
          const codeText = node.textContent;
          navigator.clipboard.writeText(codeText);
        }
        break;
      }
      default:
    }
  };

  // WikiLink modal handlers
  const handleSelectFile = useCallback((file) => {
    const view = viewRef.current;
    if (view) {
      // TODO: port to PM — insert a wikiLink node instead of using TipTap command
      // For now, insert as text which the wikiLink plugin will process
      const raw = `[[${file.path}|${file.name}]]`;
      pmInsertContent(view, raw);
    }
  }, []);

  // Task creation handler
  const handleCreateTask = useCallback(({ boardName, columnName, taskName }) => {
    const view = viewRef.current;
    if (view) {
      pmInsertContent(view, `@task[${boardName}:${taskName}] `);
    }
  }, []);

  // Reading mode - show non-editable HTML view
  if (editorMode === 'reading') {
    const view = viewRef.current;
    let htmlContent = content;
    if (view) {
      try {
        const serializer = createLokusSerializer();
        htmlContent = serializer.serialize(view.state.doc);
      } catch { }
    }
    return (
      <ReadingModeView
        content={htmlContent}
        editorSettings={editorSettings}
      />
    );
  }

  // Edit and Live Preview modes - show ProseMirror editor
  return (
    <>
      {viewRef.current && showDebug && (
        <div className="m-5 mb-0 flex gap-2">
          <button type="button" onClick={insertTestTable} className="px-2 py-1 text-sm rounded border bg-app-panel border-app-border hover:bg-app-accent/10">Insert Test Table</button>
        </div>
      )}
      {/* TODO: port to PM — TableBubbleMenu needs to be converted to a floating menu plugin */}
      {/* {viewRef.current && <TableBubbleMenu editor={viewRef.current} />} */}
      <EditorContextMenu
        onAction={handleEditorAction}
        hasSelection={viewRef.current?.state?.selection && !viewRef.current.state.selection.empty}
        canUndo={true}  /* TODO: port to PM — check undo history state */
        canRedo={true}  /* TODO: port to PM — check redo history state */
      >
        <div
          ref={mountRef}
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
        htmlContent={(() => {
          const view = viewRef.current;
          if (!view) return '';
          try {
            const serializer = createLokusSerializer();
            return serializer.serialize(view.state.doc);
          } catch { return ''; }
        })()}
        currentFile={{
          name: globalThis.__LOKUS_ACTIVE_FILE__?.name || 'untitled',
          path: globalThis.__LOKUS_ACTIVE_FILE__?.path,
        }}
        workspacePath={globalThis.__LOKUS_WORKSPACE_PATH__}
        exportType="single"
      />

      {/* Page Preview on Hover */}
      {previewData && (
        <PagePreview
          target={previewData.target}
          position={previewData.position}
          onClose={() => setPreviewData(null)}
        />
      )}

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={imageViewerState.isOpen}
        imagePath={imageViewerState.imagePath}
        allImageFiles={globalThis.__LOKUS_ALL_IMAGE_FILES__ || []}
        onClose={() => setImageViewerState({ isOpen: false, imagePath: null })}
      />

      {/* Image Insert Modal */}
      <ImageInsertModal
        isOpen={imageInsertModalState.isOpen}
        onClose={() => setImageInsertModalState({ isOpen: false, onInsert: null })}
        onInsert={(data) => {
          imageInsertModalState.onInsert?.(data);
          setImageInsertModalState({ isOpen: false, onInsert: null });
        }}
        workspacePath={globalThis.__LOKUS_WORKSPACE_PATH__}
      />

      {/* Image URL Modal - for importing images from URL via ![[ dropdown */}
      <ImageUrlModal
        isOpen={imageUrlModalState.isOpen}
        onClose={() => setImageUrlModalState({ isOpen: false, onSubmit: null })}
        onSubmit={(url) => {
          imageUrlModalState.onSubmit?.(url);
          setImageUrlModalState({ isOpen: false, onSubmit: null });
        }}
      />

      {/* Math Formula Modal */}
      <MathFormulaModal
        isOpen={mathFormulaModalState.isOpen}
        mode={mathFormulaModalState.mode}
        onClose={() => setMathFormulaModalState({ isOpen: false, mode: 'inline', onInsert: null })}
        onInsert={(data) => {
          mathFormulaModalState.onInsert?.(data);
          setMathFormulaModalState({ isOpen: false, mode: 'inline', onInsert: null });
        }}
      />

      {/* Symbol Picker Modal */}
      <SymbolPickerModal
        isOpen={showSymbolPicker}
        onClose={() => setShowSymbolPicker(false)}
        customSymbols={customSymbols}
        onInsert={(symbol) => {
          const view = viewRef.current;
          if (view) {
            pmInsertContent(view, symbol);
          }
        }}
      />
    </>
  );
});

export default Editor;
