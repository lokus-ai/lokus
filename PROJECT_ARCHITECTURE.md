# Lokus Project Architecture Overview

## 📋 Executive Summary

**Lokus** is a local-first, privacy-focused, open-source markdown note-taking and knowledge management application. It's built as a desktop application using **React** (frontend) and **Rust/Tauri** (backend), designed as a modern alternative to Obsidian with superior performance (~50MB RAM vs 300MB+ for Electron apps) and open-source transparency.

**Version**: 1.1.0  
**License**: Fair Core License 1.0 (FCL-1.0-MIT) - Free for personal use, converts to MIT after 2 years  
**Repository**: https://github.com/lokus-ai/lokus

---

## 1. Project Type & Purpose

### What is Lokus?

Lokus is a **Desktop Note-Taking & Knowledge Management Platform** that bridges the gap between:
- **Cloud-dependent apps** (Notion, OneNote) - Powerful but lacking privacy
- **Closed-source local apps** (Obsidian) - Fast but proprietary

### Core Value Proposition

- **Fair Source & Transparent** — FCL 1.0 licensed, read-only free tier with 2-year MIT conversion
- **Local-First by Design** — Notes stored as standard markdown files on user's device, no proprietary formats
- **Blazing Fast Performance** — Built with Tauri & Rust, ~50MB RAM footprint
- **No Subscription Model** — Free forever, no cloud sync tax
- **Privacy-Focused** — Zero telemetry, works 100% offline, optional authentication only

### Key Use Cases

1. **Personal Knowledge Management (PKM)** — Building a personal wiki/Zettelkasten
2. **Note-Taking** — Daily notes, meeting notes, research notes
3. **Research & Study** — Organizing research materials, academic notes
4. **Project Management** — Database views for task tracking and project planning

---

## 2. Overall Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOKUS APPLICATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    FRONTEND LAYER (React)                  │ │
│  │  • UI Components (TipTap editor, Canvas, Graph, etc.)      │ │
│  │  • State Management (Zustand stores)                        │ │
│  │  • Plugin System & Marketplace                              │ │
│  │  • Theme & Customization                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│           ↓ IPC (Inter-Process Communication)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              BACKEND LAYER (Rust/Tauri)                    │ │
│  │  • File System Management                                   │ │
│  │  • Audio Capture & Transcription                            │ │
│  │  • Authentication & Secure Storage                          │ │
│  │  • Sync Engine (Yjs + Supabase)                             │ │
│  │  • Notifications & System Integration                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│           ↓ File I/O & System APIs                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               STORAGE & EXTERNAL SERVICES                  │ │
│  │  • Local Markdown Files                                     │ │
│  │  • Supabase (optional sync, auth, LLM summaries)            │ │
│  │  • System Clipboard & Notifications                         │ │
│  │  • Audio/Transcription Services                             │ │
│  │  • Calendar Integration (iCal)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Application Architecture Layers

#### 1. **Presentation Layer (Frontend - React)**
- **Technology**: React 19, Vite 7, Tailwind CSS, Radix UI
- **Entry Point**: `src/main.jsx` → `src/App.jsx`
- **Key Responsibilities**:
  - Rendering UI components
  - Managing user interactions
  - Displaying graphs, canvases, editors
  - Plugin dialog rendering

#### 2. **Editor Layer (TipTap/ProseMirror)**
- **Location**: `src/editor/`
- **Technology**: TipTap 3 (built on ProseMirror)
- **Key Responsibilities**:
  - Rich text editing
  - Markdown support
  - Custom extensions (tables, tasks, code blocks, etc.)
  - Live preview rendering

#### 3. **Core Business Logic Layer**
- **Location**: `src/core/`
- **Key Modules**:
  - `auth/` — Authentication context & session management
  - `vault/` — Workspace/vault management
  - `workspace/` — Workspace configuration & management
  - `search/` — Full-text search engine
  - `graph/` — Knowledge graph visualization & data
  - `templates/` — Template system with 90+ features
  - `plugins/` — Plugin runtime & management
  - `sync/` — Synchronization engine
  - `markdown/` — Custom markdown compiler
  - Additional: blocks, links, references, tasks, tags, etc.

#### 4. **Backend Layer (Rust/Tauri)**
- **Location**: `src-tauri/`
- **Language**: Rust (Edition 2021)
- **Key Modules**:
  - `main.rs` — Tauri app entry point
  - `lib.rs` — Shared library exports
  - `file_locking.rs` — File lock management
  - `auth.rs` — Authentication logic
  - `api_server.rs` — HTTP API server
  - `transcription.rs` — Audio transcription handling
  - `clipboard.rs` — Clipboard operations
  - `search.rs` — Search implementation
  - `tasks.rs` — Task management
  - `schedule_blocks.rs` — Calendar block management
  - Additional platform-specific: `macos/`, `windows/`

#### 5. **Data Storage Layer**
- **Local Storage**: Standard markdown files (`.md`) in user's workspace directory
- **Optional Cloud Storage**: Supabase (for optional sync, auth, summaries)
- **Encrypted Storage**: Secure credential storage via platform keyrings

#### 6. **Plugin System**
- **Architecture**: Sandboxed plugin execution with isolated-vm
- **SDKs**: 
  - `lokus-plugin-sdk` — TypeScript Plugin Development Kit
  - `lokus-plugin-cli` — Plugin creation and development CLI
- **Features**: Plugin marketplace, live reload, permissions model

---

## 3. Main Technologies & Frameworks

### Frontend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 19.1.0 | UI library |
| **Build Tool** | Vite 7.0.4 | Fast build & dev server |
| **Styling** | Tailwind CSS 3.4.13 | Utility-first CSS |
| **UI Components** | Radix UI, custom components | Accessible UI primitives |
| **Editor** | TipTap 3 (ProseMirror) | Rich text editing |
| **Canvas** | Excalidraw, TLDraw | Infinite canvas for drawing |
| **Graph Viz** | Three.js, D3-force, Sigma | 2D/3D knowledge graphs |
| **State Management** | Zustand 5.0.11 | Lightweight reactive state |
| **Math Rendering** | KaTeX 0.16.23 | LaTeX formula rendering |
| **Code Highlighting** | highlight.js 11.11 | Syntax highlighting |
| **PDF Viewing** | pdf.js, react-pdf 10.2 | PDF document viewing |
| **Data Processing** | minisearch 7.2 | Full-text search |
| **Testing** | Vitest 3.2, Playwright 1.55 | Unit & E2E testing |
| **UI Feedback** | Sonner 2.0.7 (Toast), Framer Motion | Animations & notifications |

### Backend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Tauri 2.0 | Desktop app framework (alternative to Electron) |
| **Language** | Rust (2021) | Type-safe, performant backend |
| **Async Runtime** | Tokio 1.0 | Async task execution |
| **HTTP Server** | Hyper 1.0, Axum 0.7 | High-performance web server |
| **OAuth** | oauth2 4.4 | Authentication protocol |
| **Database** | Yjs 0.x (CRDT) + Supabase | Conflict-free replicated data types for sync |
| **Encryption** | AES-GCM 0.10, Argon2 0.5 | Cryptographic operations |
| **File I/O** | tokio-util, walkdir | Async file system operations |
| **Serialization** | Serde, serde_json | Data serialization/deserialization |
| **Logging** | Tracing 0.1 | Structured logging |
| **Error Handling** | thiserror 2.0 | Ergonomic error handling |
| **Compression** | flate2, zip | File compression |
| **Audio** | cpal 0.15 | Audio capture for transcription |
| **Email** | lettre 0.11 | Email sending for calendar integration |

### Platform-Specific Dependencies

**macOS**:
- `objc2` — Objective-C bridge for native APIs
- `security-framework` — macOS Keychain integration

**Windows**:
- `windows 0.57` — Windows API bindings

**Linux**:
- Uses generic `keyring` crate for secret storage

### Key Supporting Libraries

- **Markdown Processing**: markdown-it, remark-gfm, rehype-raw
- **Diff Utilities**: diff, react-diff-view, unidiff
- **Date/Time**: date-fns, chrono
- **UUID Generation**: uuid
- **Validation**: zod, validator, ajv
- **Crash Reporting**: Sentry
- **Analytics**: PostHog (optional, can be disabled)

---

## 4. Project Dependencies & Development Setup

### Node.js Dependencies Structure

#### Root Package (`package.json`)
- **Type**: Monorepo (Workspaces)
- **Node Version**: 18+ required
- **Workspaces**: `packages/*` (plugin-sdk, plugin-cli, registry)

#### Key Dependencies (Core App)

**Production Dependencies** (~50+ packages):
- React ecosystem: react, react-dom, react-markdown, react-spring
- UI/Graph: @excalidraw/excalidraw, @react-sigma/core, three.js, d3-force
- Editor: TipTap (prosemirror-*)
- Data: zustand (state), minisearch (search)
- Tauri: @tauri-apps/* (api, fs, shell, dialog, etc.)
- Cloud: @supabase/supabase-js
- Utilities: date-fns, uuid, zod, validator, dompurify

**Development Dependencies** (~30+ packages):
- Testing: vitest, @testing-library/*, playwright
- Build: vite, @vitejs/plugin-react, tailwindcss
- Linting: eslint, @typescript-eslint/*
- Tauri CLI: @tauri-apps/cli

### Monorepo Packages

#### 1. **`packages/plugin-sdk`** (Plugin Development Kit)
- **Version**: 1.1.0
- **Main**: TypeScript/JavaScript SDK for plugin developers
- **Build**: Rollup with multiple exports (UMD, ESM)
- **Key Exports**: Plugin API, testing utilities, templates, utils
- **Entry Points**:
  - Main: Plugin API
  - `/testing`: Testing utilities
  - `/templates`: Plugin templates
  - `/utils`: Utility functions

#### 2. **`packages/lokus-plugin-cli`** (Plugin Development CLI)
- **Version**: 2.3.0
- **Main**: Command-line tool for creating and developing plugins
- **Build**: TypeScript → JavaScript
- **Bin**: `lokus-plugin` command
- **Features**: Interactive templates, hot-reload, plugin server

#### 3. **`packages/lokus-registry`** (Plugin Registry Server)
- **Main**: `server.js` (Node.js/Express-based registry)
- **Purpose**: Marketplace backend for plugin hosting/discovery

### Development Workflow

**Install & Setup**:
```bash
npm install                    # Install all dependencies
npm run version:sync           # Sync version across packages
```

**Development**:
```bash
npm run dev                    # Start Vite dev server
npm run tauri dev             # Start Tauri app in dev mode
npm run dev:macos            # macOS-specific dev
npm run dev:windows          # Windows-specific dev
npm run dev:linux            # Linux-specific dev
```

**Testing**:
```bash
npm test                      # Run Vitest (unit tests)
npm run test:watch           # Watch mode
npm run test:e2e             # Playwright E2E tests
npm run test:e2e:ui          # E2E tests with UI
```

**Building**:
```bash
npm run build                 # Build web app (Vite)
npm run build:macos          # Build macOS app
npm run build:windows        # Build Windows app
npm run build:linux          # Build Linux app
npm run build:appstore       # Build for App Store
```

---

## 5. Build System & Tooling

### Build Process Overview

```
Development:
  TypeScript/JSX → Vite → HMR (Hot Module Replacement)
  Rust (src-tauri) → Cargo → Binary

Production:
  TypeScript/JSX → Vite (build) → Optimized JS bundles
  Rust → Cargo (release) → Platform-specific binaries
  Tauri → Bundle → DMG (macOS), EXE (Windows), AppImage (Linux)
```

### Vite Configuration (`vite.config.js`)

**Key Features**:
- **Target**: ES2022
- **Output**:
  - Code splitting for vendors (Excalidraw, React, Sentry)
  - Hidden source maps (only visible to Sentry)
  - Chunk size warning limit: 3000KB (Excalidraw is ~3MB)
- **Dev Server**: Port 1420 (fixed for Tauri)
- **Workers**: ES module format for code splitting

**Alias**:
- `@/` → `./src/` (TypeScript path alias)

### Tauri Configuration (`src-tauri/tauri.conf.json`)

**Build Targets**:
- macOS (Universal + x86_64 + ARM64 variants)
- Windows (x64)
- Linux (AppImage, deb, rpm)
- iOS (experimental)
- Android (experimental)

**Key Capabilities**:
- Desktop-specific plugins (deep-links, shell, dialog, fs, updater)
- Tray icon support
- Custom protocols
- Auto-update mechanism

### Cargo Configuration (`src-tauri/Cargo.toml`)

**Library Type**: `staticlib`, `cdylib`, `rlib` (multiple output formats)

**Key Dependencies**:
- Async: tokio, tokio-tungstenite
- Web: hyper, axum, tower
- Crypto: aes-gcm, argon2, sha2
- Serialization: serde, serde_json, bincode
- Audio: cpal, ringbuf
- Platform-specific: screencapturekit (macOS), windows (Windows)

### Testing Infrastructure

#### Unit & Integration Testing (Vitest)

**Config** (`vitest.config.js`):
- Environment: jsdom
- Globals: true (don't need to import test utilities)
- CSS: true (parse CSS in tests)
- Coverage: Text, JSON, HTML reporters
- Include: `src/**/*.{test,spec}.{js,jsx,ts,tsx}`
- Timeout: 10 seconds per test

#### E2E Testing (Playwright)

**Config** (`playwright.config.js`):
- Target: `http://localhost:1420` (Vite dev server)
- Web Server: `npm run dev` (auto-start)
- Global Setup/Teardown: Workspace management
- Timeout: 30 seconds navigation, 10 seconds action
- Permissions: Clipboard read/write

### CI/CD Workflows (GitHub Actions)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Push/PR | Run unit & integration tests |
| `e2e-tests-new.yml` | Push/PR | Run E2E tests |
| `build-multi-platform.yml` | Push/PR | Build for all platforms |
| `release.yml` | Tag | Build & publish releases |
| `release-appstore.yml` | Tag | Build for App Store |
| `claude-code-review.yml` | PR | AI-powered code review |
| `issue-assignment.yml` | Issue | Auto-assign issues |

### Development Scripts (`scripts/`)

**Key Utility Scripts**:
- `build-*.js` — Platform-specific build scripts
- `sync-version.cjs` — Keep versions in sync
- `check-platform.js` — Verify build prerequisites
- `install-build-deps.sh` — Install Rust/system dependencies
- `worktree-*.sh` — Git worktree management
- `docker-build-linux.sh` — Linux Docker build

---

## 6. Key Features & Components

### Core Editor (`src/editor/`)

**Features**:
- Rich text editing with markdown support
- Tables with resize & sort
- Code blocks with 100+ language syntax highlighting
- KaTeX math rendering
- Task lists with 18 states
- Smart paste (HTML → Markdown conversion)
- Live markdown preview
- Block references and embeds
- Wiki links with autocomplete `[[...]]`

**Components**:
- `commands/` — Slash command handlers
- `extensions/` — TipTap custom extensions
- `schema/` — ProseMirror document schema
- `hooks/` — Editor state management hooks

### Views (`src/views/`)

**Main Workspaces**:
- `Workspace.jsx` — Main editor interface
- `Canvas.jsx` — Infinite canvas (TLDraw-like)
- `ProfessionalGraphView.jsx` — 3D knowledge graph
- `FullTextSearchPanel.jsx` — Search results view

**Utility Views**:
- `Preferences.jsx` — Settings & configuration
- `Launcher.jsx` — App launcher/home screen
- `LoginScreen.jsx` — Authentication
- `Marketplace.jsx` — Plugin marketplace

### Components (`src/components/`)

**Major Components** (150+ files):
- `Editor.jsx` — Main editor wrapper
- `FileTree.jsx` / `FileContextMenu.jsx` — File browser
- `SearchPanel.jsx` / `EnhancedSearchPanel.jsx` — Search interface
- `KanbanBoard.jsx` / `KanbanList.jsx` — Kanban database view
- `GraphSidebar.jsx` / `FocusedGraphView.jsx` — Graph visualization
- `CommandPalette.jsx` — Quick command palette (Cmd+K)
- `PluginPanel.jsx` / `PluginManager.jsx` — Plugin management
- `TemplateEditor.jsx` / `TemplateManager.jsx` — Template system
- `ImageInsertModal.jsx` / `ImageViewer.jsx` — Image handling
- `MermaidViewerModal.jsx` — Mermaid diagram support
- `MathFormulaModal.jsx` — LaTeX formula editor
- `TabBar.jsx` / `StatusBar.jsx` — UI chrome
- `DiffView.jsx` — Document diff visualization
- `VersionHistoryPanel.jsx` — File version tracking

### Plugin System (`src/plugins/`)

**Architecture**:
- `PluginManager.js` — Plugin lifecycle management
- `PluginAPI.js` — Public API exposed to plugins
- `PluginEventBridge.js` — Event system
- `runtime/` — Sandbox execution (isolated-vm)
- `manifest/` — Plugin metadata validation
- `registry/` — Plugin discovery
- `security/` — Permissions & sandboxing

**Plugin Capabilities**:
- Workspace hooks
- UI components
- Commands & slash commands
- Tree views
- Status bar items
- Settings pages
- Output channels
- File operations

### Knowledge Graph (`src/core/graph/`)

**Components**:
- `GraphData.js` — Graph structure & data
- `GraphEngine.js` — Core graph logic
- `GraphWorker.js` — Web Worker for heavy computation
- `GraphRenderer.js` — Visualization
- `GraphPerformanceOptimizer.js` — Performance tuning
- `AntiLagManager.js` — Lag prevention
- `PerformanceManager.js` — FPS & load monitoring

**Algorithms**:
- Force-directed layout (D3-force)
- ForceAtlas2 layout (physics simulation)
- PathUtils.js — Path finding & traversal

### Search System (`src/core/search/`)

**Components**:
- `search-engine.js` — Full-text search
- `fuzzy-matcher.js` — Fuzzy matching
- `query-parser.js` — Search query parsing
- Powered by `minisearch` library

**Features**:
- Full-text index across all files
- Fuzzy matching for typo tolerance
- Field-specific search (title, content, tags)
- Instant results with debouncing

### Template System (`src/core/templates/`)

**90+ Built-in Features**:
- **Variables**: File name, date, time, cursor position
- **Loops**: For-each over queries/arrays
- **Conditionals**: If-else logic
- **Date Functions**: Formatting, manipulation, relative dates
- **Filters**: Case conversion, truncation, etc.
- **File Storage**: Template variables & configuration
- **Sandbox**: Isolated execution with access control
- **Prompts**: Interactive user input during insertion

**Examples**:
- Daily note templates with date variables
- Meeting note templates with attendee fields
- Project templates with task checklists
- Prompt-based templates asking for user input

### Sync Engine (`src/core/sync/`)

**Components**:
- `SyncEngine.js` — Main synchronization logic
- `SyncScheduler.js` — Scheduling sync operations
- `OfflineQueue.js` — Queue for offline changes
- `FileScanner.js` — Detect local file changes
- `ManifestManager.js` — Track file metadata
- `encryption.js` — End-to-end encryption
- `KeyManager.js` — Encryption key management
- `TrashManager.js` — Trash/recycle bin

**Features**:
- Yjs-based CRDT (Conflict-free Replicated Data Type)
- Optional Supabase sync backend
- Offline-first with background sync
- Conflict resolution
- E2E encryption support

### Import/Export (`src/core/importers/`)

**Supported Formats**:
- Obsidian vaults
- Roam Research exports
- Logseq databases
- Standard Markdown folders
- HTML imports with conversion

**Key Files**:
- `obsidian-importer.js` — Obsidian vault conversion
- `roam-importer.js` — Roam export handling
- `logseq-importer.js` — Logseq database migration
- `transformer/` — Format transformation logic
- `parsers/` — Format-specific parsing

### Authentication & Security (`src/core/auth/`, `src/core/security/`)

**Features**:
- Optional Supabase authentication
- OAuth 2.0 support
- Secure credential storage (platform keyrings)
- XSS protection (DOMPurify)
- Content sanitization
- Permissions model for plugins

### Daily Notes (`src/core/daily-notes/`)

**Features**:
- Automatic daily note creation
- Template-based generation
- Quick access to today's notes
- Navigation between date notes

### Task System (`src/core/tasks/`, `src-tauri/src/tasks.rs`)

**Features**:
- 18 task states (TODO, DONE, BLOCKED, IN_PROGRESS, etc.)
- Database view representation
- Task parsing from markdown
- Kanban board visualization
- Task synchronization

### Calendar & Scheduling (`src/contexts/ScheduleContext.jsx`, `src-tauri/src/schedule_blocks.rs`)

**Features**:
- Calendar integration (iCal parsing)
- Schedule block detection
- Event-based notes

---

## 7. File Structure Overview

### Root Level

```
lokus/
├── src/                          # React frontend (main app)
├── src-tauri/                    # Rust backend (Tauri)
├── packages/                     # Monorepo packages
│   ├── plugin-sdk/              # Plugin Development Kit
│   ├── lokus-plugin-cli/        # Plugin CLI tool
│   └── lokus-registry/          # Plugin registry server
├── tests/                        # Test suites
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   ├── e2e/                     # End-to-end tests
├── docs/                        # Documentation & plans
├── scripts/                     # Build & utility scripts
├── public/                      # Static assets (fonts, icons)
├── supabase/                    # Supabase migrations & functions
├── docker/                      # Docker configurations
├── .devcontainer/               # Dev Container setup
├── .github/                     # GitHub workflows & templates
└── [config files]              # vite, tauri, eslint, tailwind, etc.
```

### Frontend Structure (`src/`)

```
src/
├── components/                  # React components (150+ files)
├── core/                        # Core business logic
│   ├── auth/                   # Authentication
│   ├── vault/                  # Workspace management
│   ├── workspace/              # Workspace logic
│   ├── search/                 # Search engine
│   ├── graph/                  # Knowledge graph
│   ├── plugins/                # Plugin runtime
│   ├── sync/                   # Synchronization
│   ├── templates/              # Template system
│   ├── editor/                 # Editor configuration
│   ├── markdown/               # Markdown compilation
│   ├── importers/              # Import tools
│   ├── tasks/                  # Task management
│   ├── tags/                   # Tag system
│   ├── links/                  # Link resolution
│   ├── references/             # Reference tracking
│   └── [20+ other modules]     # See detailed listing
├── editor/                      # TipTap editor
│   ├── commands/               # Slash commands
│   ├── extensions/             # Custom extensions
│   ├── schema/                 # ProseMirror schema
│   ├── hooks/                  # Editor hooks
│   └── lib/                    # Editor utilities
├── views/                       # Main view components
├── components/                  # UI components (organized by feature)
├── contexts/                    # React contexts
├── hooks/                       # Custom React hooks
├── stores/                      # Zustand state stores
├── services/                    # Service modules
├── utils/                       # Utility functions
├── styles/                      # Global styles
├── themes/                      # Theme definitions
├── workers/                     # Web Workers
├── bases/                       # Database views (concept)
├── platform/                    # Platform abstraction
├── main.jsx                     # React entry point
├── App.jsx                      # Root component
└── [test files & config]        # Test setup
```

### Backend Structure (`src-tauri/`)

```
src-tauri/
├── src/
│   ├── main.rs                 # Tauri app entry
│   ├── lib.rs                  # Shared library
│   ├── api_server.rs           # HTTP API
│   ├── auth.rs                 # Authentication
│   ├── file_locking.rs         # File lock management
│   ├── mcp_embedded.rs         # Embedded server
│   ├── transcription.rs        # Audio transcription
│   ├── clipboard_*.rs          # Clipboard ops
│   ├── search.rs               # Search impl
│   ├── tasks.rs                # Task management
│   ├── schedule_blocks.rs      # Calendar blocks
│   ├── notifications.rs        # System notifications
│   ├── theme.rs                # Theme handling
│   ├── menu.rs                 # App menu
│   ├── window_manager.rs       # Window management
│   ├── oauth_server.rs         # OAuth server
│   ├── logging.rs              # Logging setup
│   ├── remote_logging.rs       # Remote logging (Sentry)
│   ├── audio.rs                # Audio handling
│   ├── plugins.rs              # Plugin system
│   ├── canvas/                 # Canvas document ops
│   ├── connections/            # Connection pooling
│   ├── handlers/               # IPC handlers
│   ├── macos/                  # macOS-specific code
│   ├── platform/               # Platform abstraction
│   ├── calendar/               # Calendar integration
│   └── [test files]            # Rust tests
├── Cargo.toml                  # Rust dependencies
├── Cargo.lock                  # Locked versions
├── tauri.conf.json            # Tauri config
├── tauri.macos.conf.json      # macOS overrides
├── tauri.windows.conf.json    # Windows overrides
├── tauri.appstore.conf.json   # App Store config
├── capabilities/               # Capability definitions
│   ├── default.json           # Default permissions
│   ├── fs-home.json           # File system access
│   └── mobile.json            # Mobile permissions
├── icons/                      # App icons
├── entitlements*.plist        # macOS entitlements
├── PrivacyInfo.xcprivacy      # iOS privacy manifest
├── Info.plist                 # macOS app info
└── target/                    # Build output
```

### Test Structure (`tests/`)

```
tests/
├── unit/                       # Unit tests with Vitest
│   ├── editor/
│   ├── markdown/
│   ├── plugins/
│   ├── security/
│   ├── schedule/
│   ├── search/
│   ├── canvas/
│   └── graph/
├── integration/                # Integration tests
│   ├── plugin-lifecycle.test.js
│   ├── plugin-managers.test.js
│   └── plugin-events.test.js
├── e2e/                        # End-to-end tests with Playwright
│   ├── basic-app.spec.js
│   ├── editor-functionality.spec.js
│   ├── file-operations.spec.js
│   ├── search-functionality.spec.js
│   ├── app-navigation.spec.js
│   ├── canvas-simple.spec.js
│   ├── task-system.spec.js
│   ├── workspace-isolation.spec.js
│   ├── security-xss-protection.spec.js
│   ├── setup/                  # Global setup/teardown
│   ├── helpers/                # Test utilities
│   └── mocks/                  # Mock data
│   ├── MCPProtocol.test.js
│   ├── MCPServerHost.test.js
│   ├── http-server-*.test.js
│   └── path-validation.test.js
└── smoke-plugin/               # Example/smoke test plugin
```

---

## 8. Key Design Patterns & Architectural Decisions

### 1. **Local-First with Optional Cloud Sync**

**Pattern**: CRDT-based synchronization (Yjs) + optional Supabase backend
- All data stored as standard markdown files locally
- Optional end-to-end encrypted sync via Supabase
- Offline-first: app works 100% offline
- Conflict-free replication via Yjs CRDTs

### 2. **Component-Based UI Architecture**

**Pattern**: React components with Zustand state stores
- Small, reusable UI components
- Composition over inheritance
- Feature-scoped stores (editor, fileTree, layout)
- Context providers for app-wide state (auth, calendar, schedule)

### 3. **Plugin System with Sandboxing**

**Pattern**: Isolated VM execution + capability-based permissions
- Plugins run in `isolated-vm` sandbox
- Limited API surface via `PluginAPI.js`
- Manifest-based capability declaration
- Event system for inter-plugin communication
- Marketplace for discovery & distribution

### 4. **Async Backend via Tauri**

**Pattern**: IPC-based frontend-backend communication
- Frontend issues commands via Tauri IPC
- Backend processes async with Tokio
- File system operations non-blocking
- Audio capture & transcription async
- Real-time notifications via events

### 5. **Template System with Variables & Conditionals**

**Pattern**: Custom template language with sandbox execution
- Template parsing via custom parser
- Variable substitution (file name, dates, etc.)
- Loops, conditionals, filters
- Sandbox isolated execution with limited API
- User prompts for interactive templates

### 6. **Performance Optimization Strategies**

**Patterns Used**:
- Virtual scrolling for large lists (@tanstack/react-virtual)
- Web Workers for heavy computation (markdown, graph, search)
- Code splitting & lazy loading (Vite)
- Incremental graph rendering (AntiLagManager)
- Minimized re-renders via Zustand selectors
- SVG-based graph visualization vs canvas

### 7. **Multi-Platform Desktop App**

**Pattern**: Tauri for cross-platform with platform-specific code
- Single codebase for Windows, macOS, Linux
- Platform-specific APIs behind abstraction layer
- macOS: screencapturekit, Keychain, native notifications
- Windows: Windows API for credentials
- Linux: Secret service via keyring crate

### 8. **Error Boundary & Crash Reporting**

**Pattern**: React Error Boundary + Sentry
- Component-level error boundaries
- Graceful fallbacks
- Sentry for crash reporting (optional)
- PostHog for analytics (optional, can disable)

### 9. **Test Pyramid**

**Pattern**: Unit → Integration → E2E
- **Unit Tests**: Vitest with jsdom for components & utilities
- **Integration Tests**: Multi-module scenarios (plugin lifecycle)
- **E2E Tests**: Playwright for full app workflows
- CI/CD runs all test suites

---

## 9. Deployment & Distribution

### Supported Platforms & Formats

| Platform | Format | Build Command | Target |
|----------|--------|---------------|--------|
| macOS | DMG (universal) | `npm run build:macos` | Intel + Apple Silicon |
| Windows | EXE (NSIS installer) | `npm run build:windows` | Windows 10/11 x64 |
| Linux | AppImage, .deb, .rpm | `npm run build:linux` | Ubuntu 18.04+ |
| App Store | macOS App | `npm run build:appstore` | Mac App Store |
| iOS | (Experimental) | `npm run build:ios` | iOS 14+ |
| Android | (Experimental) | N/A | Android (WIP) |

### Release Process

1. **Version Bump**: Update version in `package.json` and sync across packages
2. **Changelog**: Update `CHANGELOG.md`
3. **Git Tag**: Tag release (e.g., `v1.1.0`)
4. **CI Build**: GitHub Actions triggers multi-platform build
5. **Artifacts**: Generated for all platforms
6. **Release Page**: GitHub Releases page with downloads
7. **Auto-Update**: Tauri built-in updater notifies users in-app

### Auto-Update Mechanism

- Tauri's built-in updater
- Checks for new releases on GitHub
- Downloads & installs updates (user approval)
- Delta updates to minimize bandwidth
- Automatic restart (with save prompt)

---

## 10. Current State & Roadmap

### Completed Features (v1.0-v1.1)

✅ Rich markdown editor with TipTap
✅ Wiki links & knowledge graph
✅ Infinite canvas (Excalidraw)
✅ Database views (Kanban, table)
✅ Template system (90+ features)
✅ Full-text search
✅ Plugin marketplace & SDK
✅ Multi-platform support
✅ Daily notes & task system
✅ Import from Obsidian/Roam/Logseq

### In Development

🔄 Performance optimizations
🔄 Mobile app refinements (iOS/Android)
🔄 P2P sync via Iroh
🔄 Collaborative editing
🔄 Additional calendar views

### Planned Features

⏳ P2P synchronization (Iroh protocol)
⏳ Mobile native apps (iOS & Android)
⏳ Collaborative real-time editing
⏳ End-to-end encryption improvements
⏳ Calendar database view
⏳ Advanced AI features

---

## 11. Development Tools & Conventions

### Code Quality Tools

| Tool | Purpose | Config |
|------|---------|--------|
| ESLint | Linting | `.eslintrc.json` |
| Prettier | Formatting | (via ESLint) |
| TypeScript | Type checking | `jsconfig.json` (JS + JSDoc) |
| Vitest | Unit testing | `vitest.config.js` |
| Playwright | E2E testing | `playwright.config.js` |
| Tailwind | CSS | `tailwind.config.cjs` |

### Code Organization Principles

1. **Feature-First Structure**: Group by feature, not by type
2. **Core Module**: Business logic isolated in `src/core/`
3. **Components**: Reusable UI components with clear props
4. **Hooks**: Custom hooks for state logic
5. **Tests**: Colocated with source files (`*.test.js`)
6. **Naming**: Descriptive names, use full words
7. **Comments**: Document WHY, not WHAT

### Contributing Standards

- Fork and create feature branch
- Follow existing code style
- Add tests for new features
- Update documentation
- Submit PR with description
- Automated checks: linting, testing, build
- Code review by maintainers
- See `CONTRIBUTING.md` for details

---

## 12. Key Metrics & Performance

### Performance Targets

- **Memory Usage**: ~50-100MB (vs 300MB+ for Electron)
- **Startup Time**: < 2 seconds
- **First Paint**: < 500ms
- **Search**: Full-text index of 10k files < 100ms
- **Graph Rendering**: 1k+ nodes at 30 FPS

### Code Statistics

- **Frontend Lines**: ~80k+ (React/JS)
- **Backend Lines**: ~20k+ (Rust)
- **Test Coverage**: Unit tests for critical paths
- **Total Dependencies**: ~200+ npm packages + Rust crates
- **Monorepo Packages**: 3 (plugin-sdk, plugin-cli, registry)

### Platform Support Matrix

| Feature | macOS | Windows | Linux | iOS | Android |
|---------|-------|---------|-------|-----|---------|
| Core Editor | ✅ | ✅ | ✅ | 🔄 | 🔄 |
| Graph View | ✅ | ✅ | ✅ | 🔄 | 🔄 |
| Canvas | ✅ | ✅ | ✅ | 🔄 | 🔄 |
| Plugins | ✅ | ✅ | ✅ | ❌ | ❌ |
| Calendar Integration | ✅ | ✅ | ✅ | 🔄 | 🔄 |

Legend: ✅ Supported | 🔄 In Development | ⏳ Planned | ❌ Not Supported

---

## 13. Community & Resources

### Official Links

- **Website**: https://lokusmd.com
- **Documentation**: https://docs.lokusmd.com
- **Repository**: https://github.com/lokus-ai/lokus
- **Issues**: https://github.com/lokus-ai/lokus/issues
- **Discussions**: https://github.com/lokus-ai/lokus/discussions

### Community Channels

- **Discord**: https://discord.com/invite/2rauPDEXcs
- **Twitter/X**: @LokusMD0
- **GitHub Discussions**: For questions & ideas

### Support & Contribution

- **Sponsoring**: Open Collective (https://opencollective.com/lokus)
- **Contributing**: See `CONTRIBUTING.md` & `CODE_OF_CONDUCT.md`
- **License**: FCL-1.0-MIT (converts to MIT after 2 years)

---

## 14. Quick Reference: Important Directories

| Directory | Purpose |
|-----------|---------|
| `src/` | React frontend application |
| `src/core/` | Core business logic modules |
| `src/editor/` | TipTap editor implementation |
| `src/components/` | React UI components |
| `src/hooks/` | Custom React hooks |
| `src/stores/` | Zustand state stores |
| `src-tauri/src/` | Rust backend implementation |
| `packages/plugin-sdk/` | Plugin Development Kit |
| `packages/lokus-plugin-cli/` | Plugin CLI tool |
| `tests/` | Test suites (unit, integration, E2E) |
| `docs/` | Documentation & planning documents |
| `scripts/` | Build & utility scripts |
| `public/` | Static assets |
| `.github/workflows/` | CI/CD pipelines |

---

## Summary

**Lokus** is a sophisticated, full-featured note-taking and knowledge management application built with modern web and systems programming technologies. It combines:

1. **Frontend**: React 19 + Vite for fast, responsive UI
2. **Backend**: Rust + Tauri for cross-platform performance
3. **Features**: Rich editor, knowledge graphs, plugins, AI integration
4. **Philosophy**: Local-first, privacy-focused, open-source
5. **Architecture**: Well-organized, component-based, testable
6. **Tooling**: Comprehensive CI/CD, automated testing, multi-platform builds

The project demonstrates best practices in:
- Component-based architecture
- Async backend design
- Cross-platform development
- Plugin system implementation
- Testing strategies (unit, integration, E2E)
- Performance optimization
- Developer experience (dev containers, clear tooling)

---

**Last Updated**: 2025-03-XX  
**Version Analyzed**: 1.1.0  
**Status**: Active Development
