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
- `src/core/` - Core functionality (themes, config, wiki)
- `src/hooks/` - React hooks
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