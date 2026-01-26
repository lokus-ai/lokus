# Changelog

All notable changes to Lokus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-26

### 📱 iOS & Mobile Support
- **iOS Mobile App** - Full native iOS app with optimized touch experience
- **Mobile Bottom Navigation** - Thumb-friendly navigation bar for mobile devices
- **Safe Area Support** - Proper handling for iPhone notch and Dynamic Island
- **Haptic Feedback** - Native touch feedback throughout the app
- **Responsive UI** - Adaptive font sizes, tab widths, and touch-optimized controls
- **Mobile Optimizations** - Hidden terminal panel and git menu on mobile devices
- **Touch Media Queries** - Better touch target sizes and interactions

### 📅 Calendar Integration (New!)
- **Native Google Calendar** - Connect and sync with Google Calendar directly
- **iCal/CalDAV Support** - Sync with Apple Calendar, Outlook, Fastmail, and other CalDAV providers
- **Intelligent Sync** - Smart calendar syncing with conflict resolution and deduplication

### 🔐 Authentication
- **Supabase Authentication** - New secure authentication system
- **Login Screen** - Clean, modern login flow with email/password

### ✍️ Editor & Writing
- **Syntax Highlighting** - Code blocks now have proper language-aware highlighting
- **Instant Content Rendering** - Inserted content renders immediately without reopening file
- **Code Block Indentation** - Preserved correctly when copying and pasting
- **Image Embed Autocomplete** - Smart image path suggestions with reference tracking

### 📂 File Management
- **Multi-Select Operations** - Select multiple files with Shift/Cmd+click
- **Kanban Context Menu** - Right-click actions for kanban board cards
- **Drag & Drop to Root** - Drop files directly to workspace root folder
- **Create in Open Folder** - New files created inside the currently selected folder

### 🔌 Plugin System
- **Complete Plugin SDK** - Full API implementation for plugin developers
- **Plugin System Overhaul** - Improved CLI, SDK, and runtime architecture
- **Stability Fixes** - Resolved 363 failing tests across plugin APIs and templates

### 🖼️ Canvas
- **Canvas Links** - Reference `.canvas` files from Markdown with live preview support

### 🎨 UI/UX Improvements
- **Tooltips** - Added to all icon-only buttons for better accessibility
- **Loading Indicators** - Visual feedback for server status and template actions
- **Server-Pushed Toasts** - Enhanced notifications powered by Sonner
- **Lokus Dark Theme** - New built-in dark theme option
- **WikiLink Dialog** - Responsive autocomplete that works on all screen sizes
- **Link Navigation** - Fixed wikilink and internal link navigation issues
- **Better Error Messages** - Meaningful feedback in Kanban, Search, and throughout

### 🏗️ Infrastructure & Stability
- **Auto-Update Signing** - Fixed code signing for automatic updates
- **Centralized Version Management** - Single source of truth for app version
- **Mac App Store Compatibility** - Proper handling for MAS distribution
- **Node.js 22** - Upgraded runtime for better performance and compatibility
- **Remote Configuration** - Server-side feature flags and announcements system
- **Production Audit** - Complete pre-deployment security and stability fixes
- **E2E Tests** - Re-enabled comprehensive end-to-end testing

### 📊 Analytics & Privacy
- **PostHog Analytics** - Replaced Umami with focused, meaningful analytics
- **Privacy Controls** - Analytics opt-out toggle in Preferences
- **Session Recording Disabled** - Your notes and writing stay completely private
- **Kill Switches** - Remote feature control for Canvas, Plugins, Sync, AI Assistant

### 📜 Licensing
- **Fair Core License (FCL 1.0)** - Updated from BSL 1.1 for clearer open-source terms

---

## [2.1.0] - 2024-09-18

### ⌨️ New Keyboard Shortcuts

All shortcuts work on both Mac and Windows (Cmd on Mac = Ctrl on Windows):

#### Tab Management
- **`Cmd+Alt+Right`** - Next Tab (changed from Cmd+Tab for Mac compatibility)
- **`Cmd+Alt+Left`** - Previous Tab  
- **`Cmd+Shift+T`** - Reopen Recently Closed Tab (Chrome-style)
- **`Cmd+W`** - Close Current Tab
- **`Cmd+Shift+W`** - Close All Tabs

#### File Operations  
- **`Cmd+S`** - Save File
- **`Cmd+N`** - New File
- **`Cmd+Shift+N`** - New Folder
- **`F5`** - Refresh File Tree

#### Navigation
- **`Cmd+K`** - Command Palette
- **`Cmd+B`** - Toggle Sidebar
- **`Cmd+F`** - Find in Note
- **`Cmd+Shift+F`** - Global Search
- **`Cmd+L`** - Insert WikiLink
- **`Cmd+,`** - Open Preferences

#### Views & Tools
- **`Cmd+Shift+G`** - Open Graph View
- **`Cmd+Shift+K`** - Open Kanban Board
- **`Cmd+Shift+C`** - New Canvas
- **`Cmd+/`** - Show Keyboard Shortcuts Help

#### Graph View (when graph is active)
- **`Cmd+K`** - Search Nodes
- **`Cmd+R`** - Reset View
- **`Cmd+1`** - 2D View Mode
- **`Cmd+2`** - 3D View Mode  
- **`Cmd+3`** - Force Layout Mode
- **`Space`** - Toggle Layout
- **`Escape`** - Close Graph

#### Modal Controls
- **`Escape`** - Close Modal/Dialog
- **`Enter`** - Confirm Action

### 🖱️ Context Menu System

#### Right-click Menus
- **Right-click anywhere** - Show context menu with:
  - Inspect Element (for debugging)
  - Copy Element Info
  - Clear Console
  - Reload Page
  - Context-specific options

#### Developer Tools
- **Shift + Right-click** - Show browser's native context menu
- **Right-click → Inspect Element** - Highlight element and log to console as `$0`

### 🔄 Tab Management Features

#### Reopen Closed Tabs
- Remembers up to 10 recently closed tabs
- Excludes special tabs (Graph, Kanban, Plugins)
- Use `Cmd+Shift+T` to reopen most recent

#### Smart Tab Navigation  
- Throttled switching prevents UI issues
- Cycles through all open tabs
- Works with mouse and keyboard

### ⚠️ Breaking Changes
- **Tab Navigation**: `Cmd+Tab` changed to `Cmd+Alt+Right/Left` (Mac system conflict fix)
- **Context Menu**: Right-click now shows custom menu (use `Shift+Right-click` for browser menu)

### 🐛 Bug Fixes
- Fixed `Cmd+Shift+G` to open correct Graph View
- Resolved Mac keyboard shortcut conflicts  
- Fixed shortcut help modal theming

## [1.0.3] - 2024-09-15

### 🎯 Major Features

#### 📋 Universal Template System
- **Complete Template Engine** - Create, manage, and use text templates with variable substitution
- **Template Creation Dialog** - Professional interface with live markdown preview
- **Smart Template Workflow** - Select text → Cmd+K → "Save as Template" → Configure → Save
- **Template Variables** - Built-in support for `{{date}}`, `{{time}}`, `{{datetime}}`, and `{{cursor}}`
- **Category Organization** - Organize templates by category for better management
- **Selection-based Creation** - Convert selected text directly into reusable templates

#### 🔄 Universal Markdown Compiler
- **Middleware Architecture** - Centralized markdown processing bypassing TipTap limitations
- **Consistent Rendering** - Unified markdown compilation across all features
- **Enhanced Compatibility** - Improved markdown detection and processing
- **Template Integration** - Native markdown compilation for template preview

#### ⚡ Enhanced Command Palette
- **Template Integration** - Access and apply templates directly from command palette
- **Command History** - Track and revisit recent commands across sessions
- **Unified Workflow** - Single interface for all app operations
- **Smart Search** - Improved command discovery and execution

#### 📚 Modern Documentation Website
- **Professional Design** - Clean, responsive documentation interface
- **Sidebar Navigation** - Hierarchical organization of documentation sections
- **Search Functionality** - Fast content discovery across all documentation
- **Mobile Responsive** - Optimized reading experience on all devices

### 🛠 Technical Improvements

#### Architecture Enhancements
- **Shared Markdown Compiler** - Reusable markdown processing across features
- **Selection-aware APIs** - Template creation from editor selection state
- **Command History Persistence** - Local storage integration for command tracking
- **Variable Resolution Engine** - Extensible system for template variable processing

#### Performance Optimizations
- **Efficient Template Rendering** - Optimized live preview updates
- **Smart Re-rendering** - Reduced unnecessary component updates
- **Debounced Operations** - Smooth user experience during rapid interactions

### 🐛 Bug Fixes
- **Markdown Paste Detection** - Fixed issues with markdown content recognition
- **Template Variable Parsing** - Improved variable substitution reliability
- **Command Palette Focus** - Enhanced keyboard navigation and focus management
- **Selection Handling** - Better text selection preservation during template operations

### 🎨 UI/UX Improvements
- **Template Creation Interface** - Intuitive dialog with real-time preview
- **Command Palette Design** - Enhanced visual hierarchy and interaction patterns
- **Documentation Layout** - Professional sidebar navigation with improved readability
- **Responsive Adaptations** - Better mobile and tablet experience

### 📁 File Organization
- **Template Storage** - Organized template persistence and retrieval
- **Documentation Structure** - Logical organization of help content
- **Asset Management** - Efficient handling of documentation resources

### 🔮 Developer Experience
- **Template API** - Clean interfaces for template operations
- **Markdown Utilities** - Reusable compilation and processing functions
- **Command System** - Extensible command registration and execution
- **Documentation Tools** - Streamlined content creation and management

## [1.0.0] - 2024-09-14

### 🚀 Initial Release

Welcome to **Lokus v1.0.0** - A modern knowledge management and writing platform built with cutting-edge technology.

### ✨ Core Features

#### 📝 Rich Text Editor
- **Advanced TipTap Editor** with comprehensive formatting support
- **Markdown Support** - Full compatibility with standard Markdown syntax
- **Math Equations** - LaTeX/KaTeX rendering for inline `$x^2$` and block `$$E=mc^2$$` equations
- **Wiki Links** - `[[page]]` syntax with intelligent autocomplete
- **Task Management** - Interactive checkboxes and task lists
- **Tables** - Resizable columns with full editing capabilities
- **Code Blocks** - Syntax highlighting for 100+ programming languages
- **Images** - Support for local and web URLs with drag-and-drop
- **Advanced Formatting**:
  - Strikethrough `~~text~~`
  - Highlights `==text==`
  - Superscript `H^2^O` and subscript `H~2~O`
- **Smart Paste** - Automatically converts Markdown to rich text

#### 🎨 Theming & Customization
- **Dual Theme System** - Light and dark modes
- **Custom Themes** - Extensible theme architecture
- **Real-time Preferences** - Live editor customization
- **Responsive Design** - Optimized for all screen sizes

#### 🔧 Plugin System
- **Comprehensive Plugin Architecture** - Full extensibility framework
- **Plugin Manager** - Install, enable, disable, and manage extensions
- **Plugin Marketplace** - Discover new plugins (mockup ready for real marketplace)
- **Security Framework** - Granular permissions and sandboxed execution
- **Developer API** - Rich API surface for plugin development
- **Hot Module Replacement** - Seamless development experience

#### 📁 File Management
- **Native File System** - Full access to local files and folders
- **Workspace Management** - Organize your knowledge base
- **Multiple Tabs** - Work with multiple documents simultaneously
- **Auto-save** - Never lose your work
- **Search Functionality** - Find content across your entire workspace

#### 🛠 Advanced Features
- **Smart Kanban Board** - Visual task management system
- **Command Palette** - Quick actions and navigation
- **Keyboard Shortcuts** - Efficient workflow acceleration
- **Cross-platform** - macOS, Windows, and Linux support

### 🏗 Technical Architecture

#### Frontend Stack
- **React 19** - Latest React with modern hooks and patterns
- **TipTap Editor** - Extensible rich text editor framework
- **Tailwind CSS** - Utility-first styling with custom design system
- **Vite** - Lightning-fast build tool and HMR

#### Backend Stack
- **Tauri v2** - Modern desktop app framework with Rust backend
- **Rust** - Memory-safe, high-performance native operations
- **Native APIs** - File system, clipboard, and OS integration

#### Testing & Quality
- **Comprehensive Test Suite**:
  - Unit tests with Vitest
  - End-to-end tests with Playwright
  - CI/CD with GitHub Actions
- **Performance Optimized**:
  - Lazy loading for large documents
  - Debounced operations
  - Efficient re-renders

### 🔒 Security Features
- **Plugin Sandboxing** - Isolated execution environment
- **Permission System** - Granular access controls
- **Path Traversal Protection** - Secure file system access
- **Input Validation** - Comprehensive sanitization

### 📦 Installation & Distribution
- **Native Installers** - Platform-specific installation packages
- **Automatic Updates** - Seamless update mechanism (ready for future releases)
- **Portable Mode** - Run without installation
- **Professional Packaging** - Signed binaries and proper metadata

### 🎯 Target Users
- **Writers & Authors** - Rich text editing with distraction-free writing
- **Researchers** - Knowledge management with wiki-style linking
- **Students** - Note-taking with math equations and task management
- **Developers** - Technical documentation with code syntax highlighting
- **Teams** - Collaborative knowledge bases and project documentation

### 🚧 Known Limitations
- Graph view temporarily disabled due to performance optimization
- Plugin marketplace uses mock data (infrastructure ready for real marketplace)

### 🔮 Future Roadmap
- Real-time collaboration
- Cloud synchronization
- Mobile companion apps
- Advanced plugin marketplace
- AI-powered writing assistance

---

### 📝 Development Notes
- **Total Development Time**: 3+ months of intensive development
- **Architecture**: Modern, scalable, and extensible
- **Code Quality**: Comprehensive testing and documentation
- **Performance**: Optimized for large documents and complex workflows

### 🙏 Acknowledgments
Built with modern web technologies and the Rust ecosystem. Special thanks to the TipTap, Tauri, and React communities.

---

**Download Lokus v1.0.0 and start organizing your knowledge today!**

[Download for macOS] | [Download for Windows] | [Download for Linux]