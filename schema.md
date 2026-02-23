# Workspace Architecture Schema

## High-Level: How the App Boots

```
┌──────────────────────────────────────────────────────────┐
│  Tauri (Rust)                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ main.rs → spawns native window                     │  │
│  │   ├── registers ~40 IPC commands (invoke)          │  │
│  │   ├── starts MCP API server (localhost)             │  │
│  │   └── emits Tauri events (lokus:*, tauri://*)      │  │
│  └────────────────────────────────────────────────────┘  │
│                         ▼ webview                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ React (Vite)                                       │  │
│  │   main.jsx → App.jsx                               │  │
│  │     ├── AuthGate (login wall)                      │  │
│  │     ├── useWorkspaceActivation → activePath        │  │
│  │     └── <Workspace path={activePath} />  (lazy)    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## The "Single Process" Problem

Everything runs on **1 thread** — the browser main thread inside the Tauri webview:

```
┌─────────────────── MAIN THREAD ──────────────────────────┐
│                                                          │
│  React render loop                                       │
│    ├── Workspace.jsx (2100 lines, ~90 store selectors)   │
│    ├── 15+ useEffect hooks (events, session, file I/O)   │
│    ├── ShortcutListener (50+ Tauri event listeners)      │
│    ├── useWorkspaceEvents (12 event listeners)           │
│    ├── useWorkspaceSession (file tree fetch, load, save) │
│    ├── Tiptap editor instance                            │
│    ├── Graph processor (web worker for >50 nodes)        │
│    └── All UI panels, modals, sidebars                   │
│                                                          │
│  Only offloaded to separate threads:                     │
│    └── Graph Web Worker (when node count > 50)           │
│                                                          │
│  Tauri IPC calls (async, non-blocking):                  │
│    invoke("read_file_content")                           │
│    invoke("write_file_content")                          │
│    invoke("read_workspace_files")                        │
│    invoke("save_session_state")                          │
│    invoke("rename_file")                                 │
│    invoke("save_file_version_manual")                    │
│    invoke("validate_workspace_path")                     │
│    invoke("copy_external_files_to_workspace")            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## State Architecture (After Zustand Refactor)

```
useWorkspaceStore (single Zustand store, 8 slices)
│
├── Layout Slice
│   showLeft, showRight, leftW, rightW, bottomPanelHeight, bottomPanelTab
│
├── Panels Slice (modals/overlays)
│   commandPalette, inFileSearch, shortcutHelp, templatePicker,
│   createTemplate, globalSearch, tagModal, aboutDialog,
│   datePickerModal, versionHistory, canvasPreview, referenceUpdateModal
│
├── Views Slice (main content area switches)
│   currentView, showGraphView, showKanban, showPlugins, showBases,
│   showMarketplace, showCalendarPanel, showDailyNotesPanel,
│   showTerminalPanel, showOutputPanel
│
├── Tabs Slice
│   openTabs[], activeFile, unsavedChanges Set, recentlyClosedTabs[],
│   recentFiles[]
│
├── FileTree Slice
│   fileTree[], expandedFolders Set, selectedPath, selectedPaths Set,
│   creatingItem, renamingPath, refreshId, hoveredFolder, keymap
│
├── Editor Slice
│   editorContent, savedContent, editorTitle, isLoadingContent,
│   editor ref, versionRefreshKey
│
├── SplitView Slice
│   useSplitView, splitDirection, leftPaneSize, rightPaneFile,
│   rightPaneContent, rightPaneTitle, syncScrolling
│
└── Graph Slice
    graphData, isLoadingGraph, graphSidebarData, allImageFiles
```

## Data Flow: Open File → Edit → Save

```
User clicks file in sidebar
        │
        ▼
useTabs.handleFileOpen()
        │
        ├── store.openTab(path, name)     ← Tabs Slice
        ├── store.switchTab(path)          ← sets activeFile
        │
        ▼
useWorkspaceSession useEffect [activeFile] triggers
        │
        ├── invoke("read_file_content")   ← Rust reads from disk
        ├── markdownCompiler.compile()     ← md → HTML (main thread)
        ├── store.setContent(html)         ← Editor Slice
        ├── store.setSavedContent(raw)
        └── store.setLoading(false)
                │
                ▼
        <Editor /> renders with editorContent
                │
        User types...
                │
                ▼
useWorkspaceSession.handleEditorChange(html)
        │
        ├── store.setContent(html)
        └── store.markUnsaved(activeFile)  (if content ≠ savedContent)
                │
        Cmd+S pressed...
                │
                ▼
ShortcutListener catches "lokus:save-file" event
        │
        ▼
useSave.handleSave()
        │
        ├── MarkdownExporter.htmlToMarkdown()  ← HTML → md (main thread)
        ├── invoke("write_file_content")       ← Rust writes to disk
        ├── invoke("save_file_version_manual") ← version history
        ├── store.markSaved(path)
        └── graphProcessor.updateFileContent() ← update link graph
```

## Event System

```
┌─────────────┐    Tauri events     ┌───────────────────────┐
│  Rust/Menu  │ ──────────────────► │  ShortcutListener     │
│  (50+ cmds) │    lokus:save-file  │  (useShortcuts hook)  │
└─────────────┘    lokus:new-file   │  Maps event → action  │
                   lokus:graph-view │  on store or callback  │
                   etc.             └───────────────────────┘

┌─────────────┐    DOM events       ┌───────────────────────┐
│  Editor /   │ ──────────────────► │  useWorkspaceEvents   │
│  Components │  lokus:open-file    │  12 listeners          │
└─────────────┘  lokus:wiki-link-*  │  canvas-link-*        │
                 lokus:scroll-*     │  tauri://drag-*       │
                 open-template-*    └───────────────────────┘

┌─────────────┐    Zustand sub      ┌───────────────────────┐
│  Any store  │ ──────────────────► │  subscribeWithSelector│
│  mutation   │  hoveredFolder chg  │  (reactive side fx)   │
└─────────────┘                     └───────────────────────┘
```

## Component Tree (Workspace render)

```
<PanelManager>
  <ShortcutListener />              ← renders null, runs 50+ listeners
  <div.workspace-shell>
    ├── <OnboardingWizard />
    ├── <ServiceStatus />
    ├── Toolbar (titlebar)
    │   ├── New File / Folder / Canvas buttons
    │   ├── <ResponsiveTabBar />
    │   └── Right sidebar toggle
    ├── CSS Grid Layout (cols = icon-bar | left-sidebar | main | right-sidebar)
    │   ├── Icon Sidebar (48px)
    │   │   ├── File tree toggle
    │   │   ├── Search, Graph, Kanban, Bases, Calendar, etc.
    │   │   └── Plugin, Terminal, Settings buttons
    │   ├── Left Sidebar (resizable)
    │   │   ├── Breadcrumbs
    │   │   ├── <FileTreeView /> / <FullTextSearchPanel />
    │   │   └── <DailyNotesPanel /> / <CalendarWidget />
    │   ├── Main Content Area
    │   │   ├── if graph    → <ProfessionalGraphView />
    │   │   ├── if kanban   → <KanbanBoard />
    │   │   ├── if bases    → <BasesView />
    │   │   ├── if canvas   → <Canvas />
    │   │   ├── if pdf      → <PDFViewerTab />
    │   │   ├── if image    → <ImageViewerTab />
    │   │   ├── if plugin   → <PluginDetail />
    │   │   ├── if split    → <SplitEditor />
    │   │   ├── else        → <Editor />
    │   │   └── Bottom panels: <TerminalPanel />, <OutputPanel />
    │   └── Right Sidebar (resizable)
    │       ├── <DocumentOutline />
    │       ├── <BacklinksPanel />
    │       ├── <GraphSidebar />
    │       ├── <VersionHistoryPanel />
    │       └── <CalendarView />
    ├── Modals layer
    │   ├── <CommandPalette />
    │   ├── <InFileSearch />
    │   ├── <ShortcutHelpModal />
    │   ├── <TemplatePicker /> / <CreateTemplate />
    │   ├── <TagManagementModal />
    │   ├── <ExportModal />
    │   ├── <AboutDialog />
    │   ├── <DatePickerModal />
    │   ├── <ReferenceUpdateModal />
    │   └── <CanvasPreviewPopup />
    └── <ResponsiveStatusBar />
  </div>
</PanelManager>
```

## Feature Module Map (src/features/)

```
features/
├── editor/
│   ├── EditorModeSwitcher.jsx    ← reading/editing mode toggle
│   ├── EditorDropZone.jsx        ← split-view drop target
│   └── hooks/
│       ├── useEditorContent.js   ← content loading helpers
│       ├── useSave.js            ← save + save-as + version history
│       ├── useExport.js          ← PDF/HTML export
│       └── useVersionTracking.js
├── file-tree/
│   ├── FileTreeView.jsx          ← recursive file/folder list
│   ├── FileEntryComponent.jsx    ← single file row
│   ├── NewItemInput.jsx          ← inline create
│   ├── InlineRenameInput.jsx     ← inline rename
│   └── hooks/
│       ├── useFileTree.js        ← tree expand/collapse/select
│       ├── useFileOperations.js  ← create/delete/rename/open
│       └── useFileDragDrop.js
├── graph/
│   └── hooks/useGraphEngine.js   ← graph processor + web worker
├── layout/
│   └── hooks/
│       ├── useColumnResize.js    ← left/right sidebar drag
│       └── useBottomPanelResize.js
├── panels/
│   └── hooks/usePanels.js        ← open/close/toggle any panel
├── shortcuts/
│   ├── ShortcutListener.jsx      ← null component, runs hook
│   └── hooks/useShortcuts.js     ← 50+ Tauri event → action bindings
├── split-view/
│   └── hooks/useSplitView.js     ← split drag, sync scroll
├── tabs/
│   ├── OldTabBar.jsx             ← legacy tab bar (still referenced)
│   └── hooks/useTabs.js          ← open/close/click/reorder tabs
└── workspace/
    ├── useWorkspaceSession.js    ← session load/save, file content
    ├── useWorkspaceEvents.js     ← 12 global event listeners
    └── useReferenceModal.js      ← reference update dialog
```

## Key Bottleneck: WorkspaceWithScope

`WorkspaceWithScope` (Workspace.jsx:134) is the single god-component:
- ~90 individual `useWorkspaceStore(s => s.xxx)` selector calls
- Every selector triggers re-render diffing on that component
- All feature hooks instantiated here, all callbacks wired here
- 2100 lines, mixes orchestration with render logic
- One component owns the entire screen layout + all modal state
