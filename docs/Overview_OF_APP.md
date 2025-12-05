# Lokus-Main App Overview & Review

This document contains a comprehensive analysis of the Lokus-Main application, covering architecture, legacy code, core logic, performance, and general observations.

## 1. Architecture & System Design

### Findings
*   **Tauri Configuration**:
    *   **Security**: CSP allows `'unsafe-inline'` and `'unsafe-eval'`, which is risky but common for hot-reloading. Should be tightened for production if possible.
    *   **Permissions**: `shell` scope allows opening any HTTP/HTTPS URL.
    *   **Updater**: Configured to fetch from GitHub releases.
*   **Frontend Structure**:
    *   **Entry Point**: `src/main.jsx` exposes `React` and `katex` to `window`/`globalThis`. This suggests a plugin system that relies on global variables, which is fragile and pollutes the global scope.
    *   **Routing**: Custom hook-based routing (`useWorkspaceActivation`, `usePreferenceActivation`) instead of a standard router like `react-router`.
    *   **Startup**: `GmailProvider` is explicitly disabled due to performance issues. Update checks happen 3s after launch.
*   **Rust Backend (`src-tauri/src/main.rs`)**:
    *   **Monolithic Main**: The `main` function is massive, registering dozens of commands across disparate domains (Git, Kanban, MCP, Auth, Files). This "God Object" anti-pattern makes maintenance difficult.
    *   **State Management**: Uses `tauri-plugin-store` with a `.settings.dat` file for session persistence.
    *   **Orphaned File**: `src/main.rs` exists in the frontend directory but appears to be a copy of a minimal Tauri entry point. Likely a mistake.
    *   **Error Handling**: Explicitly ignores WebView2 cleanup panics.
*   **Plugin System**:
    *   **Architecture**: Modular design with a separate CLI (`packages/lokus-plugin-cli`) and SDK (`packages/plugin-sdk`).
    *   **Integration**: Core logic resides in `src/plugins/` with `PluginManager` and `PluginLoader`.
    *   **Capabilities**: Supports "Model Context Protocol" (MCP) for AI features.
    *   **Documentation**: `PLUGIN_DEVELOPMENT.md` is comprehensive but contains "chat artifacts" (e.g., "⏺ Perfect! I've created...") at the end, indicating it was AI-generated and not cleaned up.

## 2. Legacy Code & Code Quality

### Findings
*   **Technical Debt**: Mixed JavaScript/TypeScript codebase, over 140 `TODO` comments (e.g., "proper KaTeX sanitization", "Implement cut/copy").
*   **Code Quality**: `oauth-server.cjs` uses raw Node.js `http` and hardcoded HTML, communicates via fragile and insecure JSON file in a temporary directory (`.lokus/temp`). Evidence of hardcoded values and inline styles.

## 3. Core Logic & Data Flow

### Findings
*   **File I/O**: Direct `std::fs` usage in Rust. `read_image_file` converts images to Base64 (performance bottleneck for large assets, should use custom protocol). Hardcoded recursion depth limit of 10 in file tree traversal.
*   **Workspace Logic (`src/views/Workspace.jsx`)**: Identified as a "God Component" (over 4,700 lines), uses `setInterval` and global window variables (`window.__LOKUS_EDITOR_MODE__`) for state synchronization (fragile, inefficient), significant prop drilling.

## 4. Performance Review (Time Complexity & Memory)

### Findings
*   **Graph Engine (`src/core/graph/GraphEngine.js`)**: `startLayout` method claims ForceAtlas2 but implements a "fake physics" loop with random movement (broken/placeholder, wastes CPU). Good use of memory pools and WebGL for rendering.
*   **React Performance**: `EditorGroupsContainer` passes ~20 props (prop drilling leading to re-renders), unthrottled resize handlers in `EditorGroupsContainer` (layout thrashing).

## 5. "Dumb" Implementation & Sanity Check

### Findings
*   **Global CSS Performance Killer**: `src/styles/globals.css` contains `* { transition: ... }`, which applies a transition to *every single DOM element*. This causes significant layout thrashing and sluggishness, especially during theme changes or complex renders.
*   **Manual Path Utils**: `src/utils/pathUtils.js` re-implements basic path manipulation logic (joining, basename, extension) instead of using a robust library or standard API. This is error-prone across different OS environments.
*   **"Obsidian Copycat"**: The codebase is littered with comments like "Obsidian-inspired" and "Obsidian dark titlebar", suggesting a lack of original design identity.
*   **Fragile State Sync**: The use of `setInterval` to sync editor mode in `Workspace.jsx` is a hacky solution that wastes CPU cycles.

## 6. Deep Code Inspection Findings

### Rust Backend Concurrency & Safety
*   **Blocking Git Operations**: `git.rs` uses blocking `git2` calls on the main thread (or default thread pool), which can freeze the UI during large operations.
*   **Race Conditions**: `git_pull` performs a fetch followed by a merge without a transaction lock. If the repo changes in between, it fails.
*   **Inefficient State Persistence**: `save_session_state` in `main.rs` creates a new `StoreBuilder`, reloads from disk, sets a value, and saves to disk on *every call*. This is extremely inefficient I/O.
*   **Hardcoded Credentials**: `git_push` accepts raw username/token strings, which are printed to logs (though length-masked in some places, full values might leak in others).

### Graph Engine & WebGL Performance
*   **Fake Worker**: `PerformanceManager.js` creates a worker with a script that just echoes messages back. All "off-thread" calculations are a lie; they don't happen.
*   **O(N^2) Physics**: `GraphEngine.js` implements repulsion forces using nested loops over all nodes, which is O(N^2). This will freeze the UI with >500 nodes.
*   **Memory Leaks**: Geometry memory pools are initialized but `releaseVector` is rarely called, leading to potential memory exhaustion over time.

### Plugin Security Sandbox (CRITICAL)
*   **No Sandbox**: `PluginManager.js` uses dynamic `import()` to load plugins directly into the main application context. Plugins have full access to `window`, `document`, and the entire frontend state.
*   **Bypassable "Runtime"**: `PluginRuntime.js` exists but appears to be a secondary or unused implementation. Even there, `handlePluginApiCall` allows the worker to trigger arbitrary `invoke` commands (e.g., `execute_command`, `open_text_document`) without validation.
*   **Unsafe Eval**: The worker implementation uses `eval(code)` to run plugin code.
*   **Permissions Ignored**: `LokusPluginAPI.js` has a `hasPermission` check that simply returns `true` (marked as TODO).

### React Performance & Re-renders
*   **Recursive Rendering**: `EditorGroupsContainer` recursively renders itself. Any prop change at the top triggers a full tree re-render.
*   **Massive Prop Drilling**: Over 20 props are passed down through `EditorGroupsContainer`, causing unnecessary re-renders of all editor groups when unrelated state changes.
*   **Unthrottled Resize**: Resizing editor groups fires state updates on every `mousemove` event, causing extreme layout thrashing.
*   **God Component**: `Workspace.jsx` (4700+ lines) manages too much state. A single state change (e.g., a file selection) likely triggers a re-render of the entire workspace.

## 7. Conclusion & Recommendations

The Lokus-Main application is a complex, feature-rich local-first note-taking app built with Tauri and React. While it boasts impressive capabilities like a graph view,
## 5. Full Codebase Audit Findings

A comprehensive file-by-file inspection of the codebase revealed widespread issues in performance, security, and architecture.

### UI Components (`src/components`)
*   **Business Logic Leakage:** Heavy business logic (e.g., Gmail auth, email parsing) is mixed directly into UI components like `CommandPalette.jsx` and `EnhancedKanbanBoard.jsx`, making them hard to test and maintain.
*   **Performance Bottlenecks:**
    *   `CommandPalette.jsx` recalculates `allFiles` on every render, causing lag in large workspaces.
    *   `EditorGroupsContainer.jsx` triggers massive re-renders due to prop drilling (20+ props).
*   **Debug Code:** Numerous `console.log` statements remain in production code.

### Bases & Contexts (`src/bases`, `src/contexts`)
*   **`BasesContext.jsx`:** Generally well-structured but has potential race conditions in initialization logic.
*   **`FolderScopeContext.jsx`:** Uses inefficient recursive filtering for file trees, which will be slow for deep directory structures.
*   **`GmailContext.jsx`:** Well-structured but heavy. It manages too much global state (auth, queue, labels, emails) in a single context, leading to unnecessary re-renders for consumers who only need a slice of that state.

### Views (`src/views`)
*   **`ProfessionalGraphView.jsx` (CRITICAL):**
    *   **Sequential File I/O:** The `loadWorkspaceData` function reads every Markdown file in the workspace **sequentially** using `invoke('read_file_content')`. This is a massive performance killer (O(N) IPC calls). It should use a bulk read operation or be handled entirely in Rust.
    *   **Re-render Loops:** `filterGraphData` creates new object references on every call, potentially triggering infinite re-render loops in the graph renderer.
*   **`Canvas.jsx`:**
    *   **Heavy Change Detection:** `hasRealChanges` performs a deep comparison of all shape properties on every store update.
    *   **Risky Save Logic:** `verifyFileSave` reads the file back from disk immediately after writing, which is slow and prone to race conditions with OS file caching.
*   **`Preferences.jsx`:** A 3000+ line "God Component" handling everything from theme editing to Git sync. It is unmaintainable and needs to be split into smaller sub-components.

### Hooks (`src/hooks`)
*   **`useGmail.js`:** `useGmailQueue` polls for status every 30 seconds, which is aggressive and wasteful if the user is offline or idle.
*   **`useTemplates.js`:** Relies on a global singleton `templateManager`, which makes testing difficult and can lead to stale state issues. Contains excessive debug logging.
*   **`useCommandHistory.js`:** Writes to disk (via `updateConfig`) on **every** command execution. This is inefficient and should be debounced or batched.

### Utilities (`src/utils`)
*   **`pluginUtils.js` (SECURITY):** `createPluginSandbox` returns a **mock object** that does not actually enforce permissions or isolate plugin code. This confirms the critical security vulnerability: plugins have full access to the application.
*   **`emailToNote.js`:** Uses Regex for HTML stripping, which is fragile and slow.

### Backend (`src-tauri`)
*   **Blocking I/O:** As noted in the deep dive, file I/O and Git operations are synchronous and blocking.
*   **"God Object" `main.rs`:** The main Rust entry point is monolithic and registers too many commands directly.

## 6. Prioritized Remediation Plan

Based on the audit, here is the recommended order of operations to stabilize the application.

### 🚨 P0: Critical (Security & Data Integrity)
**Must be fixed immediately. These issues pose active risks to user data and system security.**
1.  **Plugin Sandbox:** The current "sandbox" is a mock. Plugins have full access to the application.
    *   *Fix:* Implement `iframe` sandboxing with `postMessage` communication, or use a secure JS runtime (QuickJS/Deno) in Rust.
2.  **Content Security Policy (CSP):** `unsafe-inline` and `unsafe-eval` are enabled.
    *   *Fix:* Remove these directives. Refactor code relying on `eval` (e.g., `PluginRuntime.js`).
3.  **Git Credentials:** Raw passwords/tokens are passed to Git functions.
    *   *Fix:* Use the OS keychain or encrypted storage for credentials. Never pass them as raw arguments.
4.  **Data Race Conditions:**
    *   `Canvas.jsx`: The "save then verify" logic is prone to race conditions.
    *   `git_pull`: Lacks locking, risking repo corruption during concurrent operations.
    *   *Fix:* Implement proper file locking and atomic write operations.

### 🔴 P1: High (Major Performance & Broken Features)
**These issues make the application unusable with moderate/large datasets.**
1.  **Sequential File Loading:** `ProfessionalGraphView` reads files one-by-one (O(N) IPC calls).
    *   *Fix:* Implement a `read_all_files` command in Rust to return all workspace data in a single IPC call.
2.  **Graph Physics (O(N²)):** The force-directed layout uses nested loops on the main thread.
    *   *Fix:* Move physics to a **real** Web Worker or offload to Rust (using `petgraph` or similar).
3.  **Blocking Backend I/O:** Synchronous `std::fs` calls freeze the UI.
    *   *Fix:* Convert all Tauri commands to `async` and use `tokio::fs`.
4.  **"Fake" Web Worker:** `PerformanceManager.js` does not actually offload work.
    *   *Fix:* Implement a genuine Web Worker for heavy calculations.

### 🟡 P2: Medium (Architecture & Scalability)
**These issues slow down development and cause UI jank.**
1.  **God Components:** `Workspace.jsx` (4700+ lines), `Preferences.jsx`, `main.rs`.
    *   *Fix:* Break these into smaller, domain-specific components/modules.
2.  **React Re-renders:** `EditorGroupsContainer` and `CommandPalette` trigger excessive updates.
    *   *Fix:* Use `React.memo`, `useCallback`, and optimize context usage.
3.  **Fragile State Sync:** Reliance on `setInterval` and global variables.
    *   *Fix:* Adopt a robust state management library (Zustand/Redux) and use proper event-driven architecture.
4.  **Inefficient Persistence:** `tauri-plugin-store` writes to disk on every key change.
    *   *Fix:* Debounce writes or use an in-memory store with periodic flushing.

### 🟢 P3: Low (Maintenance & Cleanup)
**Technical debt that should be addressed when possible.**
1.  **Code Quality:** Remove `console.log` statements and dead code.
2.  **Mixed JS/TS:** Standardize on TypeScript for better type safety.
3.  **Utils:** Replace regex-based HTML stripping in `emailToNote.js` with a proper DOM parser.
 mixed JS/TS usage. Address the 140+ TODOs, especially those related to security and missing core features.

### Long-term Improvements:
*   **Plugin System**: Clean up the documentation and ensure the plugin architecture is secure and robust, moving away from global variable exposure.
*   **File I/O**: Implement a custom protocol for asset loading to avoid Base64 conversion overhead.
This review provides a roadmap for stabilizing and optimizing the application for production readiness.
