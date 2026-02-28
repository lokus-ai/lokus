# TipTap → ProseMirror Migration Findings

## Investigation Date: 2026-02-24
## Method: 4 parallel Opus agents, each investigating one aspect

---

## Agent 1: React Integration Layer

### Tab Switching Bug Root Cause
- `useEditor` in Editor.jsx has dep array `[extensions, handleEditorUpdate]`
- `handleEditorUpdate` depends on `[onContentChange]`
- `onContentChange` = `handleContentChange` from EditorGroup with `[group.id, activeFile]` deps
- **Every tab switch → new activeFile → new callback chain → useEditor recreates editor → content lost**
- With raw PM: EditorView created once in ref, `view.updateState()` on tab switch — bug ceases to exist

### isSettingRef Pattern
- Guard at lines 480, 506-507, 824, 831 of Editor.jsx
- Prevents infinite loops when programmatically setting content
- **Elimination**: use `tr.setMeta('programmatic', true)` in dispatch, check in update handler

### React-in-PM Replacements
- `EditorContent` → `<div ref={mountRef}>` where `new EditorView(mountRef.current, ...)`
- `ReactRenderer` (5 files) → `createRoot()` from react-dom/client
- `ReactNodeViewRenderer` (MermaidDiagram) → custom `NodeView` class using createRoot
- `BubbleMenu` (TableBubbleMenu) → PM plugin + tippy.js + createRoot

---

## Agent 2: Extension Migration Paths

### Categorization (36 total extensions)
**DELETE (5)** — dead/unused code:
- SimpleTask, SmartTask, HeadingAltInput, TaskMarkdownInput, Template

**TRIVIAL (7)** — direct PM plugin port, <1hr each:
- BlockId, TaskSyntaxHighlight, Folding, MarkdownPaste, MarkdownTablePaste, PluginHover, TaskCreationTrigger

**MODERATE (8)** — need PM transaction patterns, 2-4hr each:
- Callout, WikiLink, WikiLinkEmbed, CanvasLink, CustomCodeBlock, CodeBlockIndent, MathSnippets, SymbolShortcuts

**HARD (7)** — need infrastructure first:
- WikiLinkSuggest (16-24hr) — 4 suggestion instances, 1000+ lines, most complex
- SlashCommand (8-16hr) — 30 commands, popup positioning
- TagAutocomplete (4hr), TaskMentionSuggest (4hr), PluginCompletion (4hr) — use suggestion factory
- MermaidDiagram (8-12hr) — React NodeView in PM
- TableBubbleMenu (4-8hr) — floating UI

### 3 Infrastructure Pieces Needed First
1. **Suggestion plugin factory** (~300 lines) — replaces @tiptap/suggestion, reusable by 5 extensions
2. **React-in-PM helpers** (~100 lines) — createRoot-based NodeView + popup rendering
3. **Floating menu plugin** (~150 lines) — replaces BubbleMenu for tables

### Estimated Total: 10-15 working days

---

## Agent 3: Markdown Pipeline & Schema

### lokus-md-pipeline.js — Already the Right Foundation
- Load path: md → md-it → PM doc (NO HTML) ✓
- Save path: PM doc → md (NO HTML) ✓
- 8 custom markdown-it plugins: wikiLink, callout, mermaid, canvasLink, inlineMath, blockId, etc.
- `createLokusParser(schema)` and `createLokusSerializer()` already exist and work

### Schema Gap — Critical
- Pipeline defines parser/serializer MAPPINGS but NO standalone ProseMirror schema
- Raw PM requires explicit `createLokusSchema()` function
- **25 types needed:**
  - Nodes (17): doc, paragraph, heading, blockquote, codeBlock, hardBreak, horizontalRule, image, bulletList, orderedList, listItem, taskList, taskItem, table, tableRow, tableHeader, tableCell
  - Custom nodes (6): wikiLink, wikiLinkEmbed, canvasLink, callout, mermaidDiagram, mathBlock
  - Marks (6): bold, italic, code, strike, link, inlineMath

### 17 editor.getHTML() Call Sites (7 files)
All must be replaced with `lokusSerializer.serialize(editor.state.doc)`:
- useSave.js: lines 133, 155 (Save As exports)
- EditorGroup.jsx: handleContentChange still stores HTML
- Editor.jsx: handleEditorUpdate passes HTML to onContentChange
- Various export/reading mode functions

### Deletable After Migration
- `compiler.js` — old md→HTML compiler
- `compiler-logic.js` — compiler helpers
- `MarkdownExporter` class — HTML→md exporter (650 lines)
- `markdown-exporter.js` — DOM-based md export

### MarkdownPaste Still Uses Old Pipeline
- MarkdownPaste.js imports old compiler.js (md → HTML → TipTap)
- Must be updated to use lokus-md-pipeline (md → PM doc directly)

---

## Agent 4: External Editor Consumers

### Outside src/editor/ — Only 3 TipTap Imports
All are just re-exports of PM primitives. Clean boundary.

### editorRegistry.js
- Simple `Map<groupId, editor>` with registerEditor/getEditor
- 10+ files use getEditor()
- Change: stores PM EditorView instead of TipTap Editor instance
- API surface is the same (.state, .dispatch, .dom)

### HIGH RISK Files
- **EditorAPI.js** (2048 lines) — central plugin API, single adaptation point
  - Uses `this.editorInstance.getHTML()`, `.commands.setContent()`, `.commands.insertContent()`, `.chain().focus()...`
  - `createSecureNode()`, `createSecureMark()`, `createSecureExtension()` use TipTap APIs
- **PluginBridge.js** — bridges plugins to editor, update access pattern
- **useShortcuts.js** — ~20 commands use `editor.chain().focus()...`, convert to PM transactions
- **ModalLayer.jsx** — reads editor state for modals
- **useWorkspaceEvents.js** — CSS selector `.tiptap.ProseMirror` needs updating

### Already PM-Native
- Store format: `contentByTab` already stores PM JSON
- useSave.js line 59: `lokusSerializer.serialize(editor.state.doc)` — already correct
- EditorGroup.jsx: snapshotTabJSON uses `editor.getJSON()` → PM JSON

### Plugin System Has Abstraction Barrier
- EditorPluginAPI acts as single adapter between plugins and editor
- Plugins don't touch TipTap directly — they go through EditorAPI
- Single file to adapt, not scattered changes

### Tests
- 10+ editor tests inside src/editor/ need complete rewrite
- Tests use TipTap test utilities that won't exist
