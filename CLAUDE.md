# Claude Development Guide for Lokus

## 🚀 **Quick Start Commands**

### **Development**
```bash
npm run tauri dev
```

### **Build**
```bash
npm run tauri build
```

### **Testing**
```bash
# Unit tests
npm test
npm run test:watch

# E2E tests
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
```

## 📁 **Project Structure**

### **Frontend (React + TipTap)**
- `src/editor/` - Rich text editor components
- `src/views/` - Main app views (Workspace, Preferences)
- `src/core/` - Core functionality (themes, config, wiki, **templates**)
  - `src/core/templates/` - Template system implementation
    - `file-storage.js` - File-based template storage
    - `processor-integrated.js` - Main template processor
    - `dates.js` - Date operations (70+ functions)
    - `filters.js` - Text/array/number filters (60+)
    - `conditionals.js` - If/else logic
    - `loops.js` - Array iteration
    - `sandbox-isolated.js` - JavaScript execution
    - `html-to-markdown.js` - HTML conversion
- `src/hooks/` - React hooks
  - `useTemplates.js` - Template management hook
- `src/components/` - React components
  - `CreateTemplate.jsx` - Template creation UI
- `src/styles/` - CSS and styling

### **Backend (Tauri + Rust)**
- `src-tauri/src/main.rs` - Main Tauri backend
- `src-tauri/src/` - Rust modules

## ✨ **Key Features Implemented**

### **Editor Features**
- ✅ Rich text editing with TipTap
- ✅ Markdown support (all standard features)
- ✅ Math equations (KaTeX) - inline `$x^2$` and block `$$E=mc^2$$`
- ✅ Wiki links `[[page]]` with autocomplete
- ✅ Task lists with checkboxes
- ✅ Tables with resizing
- ✅ Code blocks with syntax highlighting
- ✅ Images (local and web URLs)
- ✅ Strikethrough `~~text~~`
- ✅ Highlights `==text==`
- ✅ Superscript `H^2^O` and subscript `H~2~O`
- ✅ Smart paste (markdown → rich text)

### **App Features**
- ✅ File management and workspace
- ✅ Theme system (light/dark + custom themes)
- ✅ Preferences with real-time editor customization
- ✅ Daily Notes system with date navigation
- ✅ Advanced template system with 90+ features
  - File-based storage (.md files with YAML frontmatter)
  - 70+ date operations with method chaining
  - 60+ text/array/number/date filters
  - Conditionals (if/else/elseif) with operators
  - Loops (#each) with special variables
  - JavaScript sandbox execution
  - Template includes for composition
  - HTML to Markdown auto-conversion
  - Duplicate detection and overwrite protection
- ✅ Crash reporting with GlitchTip/Sentry
  - Self-hosted at crash.lokusmd.com
  - Frontend (React) and backend (Rust) error tracking
  - React Error Boundary for component crashes
  - Automatic breadcrumb tracking for user actions
  - Session replay for error debugging
  - Production source maps for debugging
  - Development crash testing tools

## 🔧 **Common Tasks**

### **Adding New Editor Features**
1. Create extension in `src/editor/extensions/`
2. Import and add to extensions array in `Editor.jsx`
3. Add slash command in `slash-command.jsx`
4. Update CSS in `editor.css`

### **Adding New Views**
1. Create component in `src/views/`
2. Import and route in `App.jsx`
3. Add navigation if needed

### **Modifying Themes**
- Edit `src/core/theme/manager.js`
- CSS variables in `src/styles/globals.css`

### **Working with Templates**
- **Documentation**: See `docs/templates/` for complete guides
  - `README.md` - Overview and quick start
  - `syntax-reference.md` - Complete syntax guide
  - `examples.md` - Real-world examples
  - `architecture.md` - Technical implementation
- **Storage Location**: `/Users/[username]/Desktop/My Knowledge Base/templates/`
- **File Format**: Markdown with YAML frontmatter
- **Testing**: Unit tests in `tests/unit/templates/`
- **Key Files**:
  - Template processing: `src/core/templates/processor-integrated.js`
  - Storage: `src/core/templates/file-storage.js`
  - UI: `src/components/CreateTemplate.jsx`

### **Crash Reporting Setup (GlitchTip/Sentry)**
- **Dashboard**: https://crash.lokusmd.com
- **Configuration**:
  - DSN configured in `.env` and `.env.production`
  - Permanent DSN (never changes, stored in PostgreSQL)
  - Enable/disable with `VITE_ENABLE_CRASH_REPORTS` env var
- **Frontend Integration** (`src/main.jsx`):
  - Sentry SDK with browser tracing and session replay
  - React Error Boundary wraps entire app
  - Automatic breadcrumb tracking in `App.jsx`
  - Development crash testing tools (`src/components/error/CrashTest.jsx`)
- **Backend Integration** (`src-tauri/src/main.rs`):
  - Sentry Rust SDK with panic handling
  - Filters WebView2 cleanup warnings
  - Reports all unhandled panics
- **Testing Crashes**:
  - Development mode shows crash testing panel (bottom-right)
  - Four test buttons: React Error Boundary, Async Error, Handled Error, Breadcrumb Trail
  - Check crash.lokusmd.com for reports after testing
- **Production Builds**:
  - Hidden source maps generated automatically
  - Manual chunking for better caching
  - Session replay captures 10% of sessions, 100% of errors

### **Mac App Store Deployment**
- **Build Command**: `npm run build:appstore`
- **Configuration**: Uses `src-tauri/tauri.appstore.conf.json`
- **Key Differences from Direct Distribution**:
  - **Sandbox**: App Store requires App Sandbox (`com.apple.security.app-sandbox`)
  - **Entitlements**: Uses `entitlements-appstore.plist` (restricted permissions)
  - **Signing**: Requires "3rd Party Mac Developer" certificate (not Developer ID)
  - **Restrictions**: No JIT, no unsigned executable memory, no library validation bypass
- **Files**:
  - `src-tauri/tauri.appstore.conf.json` - App Store build configuration
  - `src-tauri/entitlements-appstore.plist` - Sandbox-compliant entitlements
  - `src-tauri/PrivacyInfo.xcprivacy` - Required privacy manifest
- **Important Notes**:
  - Auto-updater must be disabled for App Store builds (handled in config)
  - Global shortcuts may not work in sandbox (requires special permission)
  - Test thoroughly with sandbox before submission (`xattr -w com.apple.quarantine`)
  - You need TWO signing configurations: App Store and direct distribution
- **Submission Process**:
  1. Build with `npm run build:appstore`
  2. Sign with Mac App Distribution certificate
  3. Create .pkg installer with `productbuild`
  4. Upload to App Store Connect via Transporter
  5. Configure TestFlight for beta testing
  6. Submit for App Review
- **See Also**: Comprehensive guide in research notes for full submission process

## 🐛 **Known Issues**

### **Fixed**
- ✅ Math rendering (KaTeX integration)
- ✅ WikiLink autocomplete conflicts with regular links
- ✅ Paste functionality blocking all operations
- ✅ Link colors not blue
- ✅ Brackets in lists triggering wiki suggestions

### **Current Issues**
- Need better file organization

## 📝 **Development Notes**

### **Code Style**
- React functional components with hooks
- TipTap extensions for editor functionality
- Tauri commands for file operations
- CSS custom properties for theming

### **Testing Strategy**
- **Unit tests** (`tests/unit/`) - Core functions and utilities
- **E2E tests** (`tests/e2e/`) - Complete user workflows
  - App navigation and preferences
  - Editor functionality (formatting, math, tables)
  - File operations and saving
  - Math rendering and slash commands
- **CI/CD** - GitHub Actions for automated testing
- **Manual testing** - Complex editor interactions

### **Performance Considerations**
- Lazy loading for large documents
- Debounced save operations
- Efficient re-renders with React.memo

---

*Last Updated: September 12, 2025*
*Status: Ready for SaaS development phase*



Never Mention Claude in anything no pr no issue no commits no comments never mention claude