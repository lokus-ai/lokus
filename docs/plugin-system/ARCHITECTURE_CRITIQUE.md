# Plugin System Comprehensive Critique

## Executive Summary

The Lokus plugin system has **solid foundations** but significant gaps prevent it from being a complete, production-ready ecosystem. The architecture is over-engineered in some areas while missing critical pieces for an end-to-end developer and user experience.

---

## Current State Overview

### What Exists (The Good)

| Component | Status | Notes |
|-----------|--------|-------|
| CLI (`lokus-plugin-cli`) | 85% | Create, build, package, publish commands work |
| SDK (`plugin-sdk`) | 80% | Types, base classes, templates exist |
| Plugin Loader | 70% | Loads plugins, transforms imports, creates sandbox |
| Plugin UI | 60% | Extensions view, cards, enable/disable works |
| Registry Code | 40% | Classes exist but no production backend |
| Marketplace | 20% | Mock data, no real connection |

### Open PRs Attempting Fixes

- **PR #267**: CLI quick mode, CSS injection, hot reload symlinks, `definePlugin` helper
- **PR #254**: Refactoring, documentation, plugin component reorganization

---

## Critical Issues (Showstoppers)

### 1. **No Production Registry/Marketplace**

**Problem**: The entire publishing and discovery flow is broken because there's no actual registry backend.

```
Developer Journey (BROKEN):
lokus-plugin create → lokus-plugin build → lokus-plugin publish → ??? (no registry)

User Journey (BROKEN):
Browse marketplace → ??? (mock data only) → Install → Works locally
```

**What's Missing**:
- No `https://registry.lokus.dev` backend
- No plugin storage (S3/CDN for packages)
- No user authentication for publishers
- No review/moderation system
- `PluginRegistry.js` is client code with no server counterpart

**Impact**: Plugins can only be shared via manual file transfer or GitHub releases.

---

### 2. **Dual Loading Architecture Creates Confusion**

**Problem**: Two separate plugin loading systems exist and interact poorly.

```
Path A: PluginStateAdapter → PluginLoader → plugins loaded
Path B: PluginManager → plugins loaded (mostly unused)
```

**Files Involved**:
- `src/core/plugins/PluginStateAdapter.js` - UI-facing, actually used
- `src/core/plugins/PluginManager.js` - Has dependency resolution, mostly bypassed
- `src/plugins/core/PluginLoader.js` - Does actual loading

**Issues**:
- `PluginManager` has proper dependency resolution but isn't used
- `PluginStateAdapter` skips dependency checks
- Three places track instances: `PluginLoader.loadedModules`, `PluginStateAdapter.pluginInstances`, `PluginManager.plugins`

---

### 3. **Incomplete API Surface**

**Problem**: Many SDK APIs are stubs that do nothing.

```javascript
// In LokusPluginAPI.js - these are empty or minimal:
tasks: {},           // TODO
debug: {},           // TODO
themes: {},          // TODO
terminal: { /* stub */ },
languages: { /* stub */ },
```

**What Works**:
- `editor` - Slash commands, extensions, context menu
- `ui` - Panels, notifications, dialogs
- `commands` - Register/execute
- `fs` - File operations (sandboxed)
- `storage` - Key-value persistence

**What Doesn't**:
- `workspace.onDidChangeConfiguration` - Not implemented
- `languages.registerCompletionProvider` - Stub
- `terminal.createTerminal` - Stub
- `debug.*` - All stubs

---

### 4. **Hot Reload is Fragile**

**Problem**: File watcher exists but reload doesn't fully work.

**Current Flow**:
1. `PluginFileWatcher.js` watches `dist/index.js` and `plugin.json`
2. On change, calls `reloadPluginFromDisk()`
3. **BUT**: Manifest cache isn't invalidated
4. **BUT**: Old instance not properly deactivated
5. **BUT**: Symlinks (from `lokus-plugin link`) have edge cases

**Developer Experience**: Changes require manual disable/enable or app restart.

---

### 5. **Permission System Not Enforced**

**Problem**: Permissions are declared but not checked.

```javascript
// Manifest declares:
"permissions": ["read_files", "write_files", "network"]

// But FilesystemAPI doesn't check:
async readFile(path) {
  // No permission check!
  return await invoke("plugin_read_file", { ... });
}
```

**Only Enforced**:
- `NetworkAPI` checks `access_network` permission
- That's it. Everything else is honor system.

---

## Architecture Issues (Medium Priority)

### 6. **Context Bleeding Between Plugins**

```javascript
// In LokusPluginAPI.js:
setPluginContext(pluginId) {
  this.currentPluginId = pluginId;
  // Sub-APIs don't reliably get updated
}
```

If Plugin A calls an API while Plugin B's context is set, operations may be attributed to wrong plugin.

### 7. **No Plugin Isolation**

All plugins run in same JavaScript context. A misbehaving plugin can:
- Overwrite `window.lokus`
- Mess with other plugins' globals
- Block the event loop

The "sandbox" is just a Proxy wrapper, not true isolation (no Web Worker, no iframe).

### 8. **MCP Integration Half-Done**

`MCPPluginManager.js` exists with:
- Server hosting
- Resource/tool/prompt registry

**But**:
- Lifecycle management incomplete
- Cross-plugin MCP communication broken
- No testing of MCP plugin flow

---

## CLI/SDK Issues

### 9. **Template Quality Varies**

- `basic-typescript` - Works well
- `react-ui-panel` - Needs React bundling that doesn't work cleanly
- `language-server` - Very complex, untested
- `ai-assistant` - Depends on APIs that don't exist

### 10. **Build Output Not Consistent**

```
Expected: dist/index.js (single bundle)
Reality:  Sometimes dist/index.js, sometimes dist/main.js
          Sometimes CJS, sometimes ESM
          Import transformation is fragile
```

The `transformPluginCode()` function uses regex to rewrite imports - breaks on edge cases.

### 11. **Package Signing is TODO**

```javascript
// In PluginPackager.js:
async signPackage() {
  // TODO: Implement package signing
  return null;
}
```

No code signing means no verification of plugin authenticity.

---

## User Experience Gaps

### 12. **Marketplace is Fake**

`Extensions.jsx` shows:
```javascript
const mockMarketplace = [
  { id: 'advanced-tables', name: 'Advanced Tables', ... },
  { id: 'dark-pro-theme', name: 'Dark Pro Theme', ... },
  // ... hardcoded list
];
```

No connection to any real registry.

### 13. **No Update Mechanism**

- `RegistryConfig.js` has `updatePolicy` settings
- No code actually checks for updates
- No UI for "Updates Available"

### 14. **Install From URL Not Exposed**

The code supports installing from URL/file:
```javascript
await invoke("install_plugin", { path: archivePath });
```

But no UI to enter a URL or drop a ZIP file.

---

## End-to-End Flow Analysis

### Developer Flow: Create → Publish

| Step | Command | Status |
|------|---------|--------|
| 1. Create | `lokus-plugin create my-plugin` | ✅ Works |
| 2. Develop | `lokus-plugin dev` | ⚠️ Watch works, hot reload fragile |
| 3. Test locally | `lokus-plugin link` | ⚠️ Symlink works, needs manual enable |
| 4. Build | `lokus-plugin build` | ✅ Works |
| 5. Package | `lokus-plugin package` | ✅ Creates ZIP |
| 6. Login | `lokus-plugin login` | ❌ No registry to auth against |
| 7. Publish | `lokus-plugin publish` | ❌ Registry endpoint doesn't exist |

### User Flow: Discover → Use

| Step | UI Location | Status |
|------|------------|--------|
| 1. Browse | Extensions → Browse tab | ❌ Mock data only |
| 2. Search | Search bar | ⚠️ Works on mock data |
| 3. View details | Click plugin | ✅ UI exists |
| 4. Install | Install button | ❌ No real download |
| 5. Enable | Toggle | ✅ Works |
| 6. Configure | Plugin settings | ⚠️ Basic only |
| 7. Update | ? | ❌ Not implemented |

---

## Priority Recommendations

### P0 - Must Fix (Blocking)

1. **Build a real registry backend** or integrate with npm/GitHub Releases
2. **Consolidate loading systems** - Pick one path, remove the other
3. **Enforce permissions** - Add checks to all APIs

### P1 - Should Fix (Major DX/UX Impact)

4. **Fix hot reload** - Proper cache invalidation and instance cleanup
5. **Complete core APIs** - At minimum: workspace events, basic terminal
6. **Add install-from-URL** - Let users install from GitHub releases

### P2 - Nice to Have

7. **True plugin isolation** - Web Workers or iframes
8. **Package signing** - Verify authenticity
9. **Update checking** - Notify users of new versions

---

## Files to Modify (If Implementing Fixes)

| Priority | File | Change |
|----------|------|--------|
| P0 | `src/plugins/core/PluginLoader.js` | Add permission checks |
| P0 | `src/core/plugins/PluginManager.js` | Remove or integrate properly |
| P0 | New: `packages/lokus-registry-server/` | Build actual backend |
| P1 | `src/core/plugins/PluginFileWatcher.js` | Fix reload mechanism |
| P1 | `src/plugins/api/LokusPluginAPI.js` | Implement stub APIs |
| P1 | `src/views/Extensions.jsx` | Add URL install option |
| P2 | `src/plugins/core/PluginSandbox.js` | Move to Web Worker |

---

## Summary

The plugin system is **architecturally ambitious** but **practically incomplete**. The biggest gap is the missing registry backend - without it, the entire publish/discover flow is broken.

**Bottom line**: A developer can create and locally test a plugin. They cannot publish it anywhere. A user cannot discover or install any real plugins.

The PRs #267 and #254 fix symptoms (CSS injection, hot reload, CLI UX) but don't address the fundamental issue: **there's no backend to make this a real ecosystem**.
