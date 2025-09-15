# Changelog

All notable changes to Lokus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-09-15

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

## [1.0.0] - 2025-09-14

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