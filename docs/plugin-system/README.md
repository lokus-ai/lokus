# Plugin System Documentation

This folder documents the Lokus plugin system architecture and known limitations.

## Documents

| File | Description |
|------|-------------|
| [ARCHITECTURE_CRITIQUE.md](./ARCHITECTURE_CRITIQUE.md) | High-level critique of plugin system architecture |
| [DEV_EXPERIENCE_ISSUES.md](./DEV_EXPERIENCE_ISSUES.md) | Issues found during developer experience testing |

---

## Architectural Limitations

Plugins in Lokus are **JavaScript-only** and run in a sandboxed environment. This design provides security and portability but comes with limitations:

### What Plugins CAN Do

- Register commands and UI components
- Listen to editor events
- Store/retrieve plugin settings
- Access file system through approved APIs
- Display notifications and panels
- Add status bar items

### What Plugins CANNOT Do

- **Add Rust/Tauri backend commands** - Plugins cannot extend the native backend
- **Access native APIs not already exposed** - Limited to existing Tauri commands
- **Perform system-level operations** - Sandboxed for security
- **Run arbitrary native code** - No FFI or native module support

### Requesting Native Features

If your plugin requires native functionality not currently available:

1. Open an issue on the Lokus repository
2. Describe the feature and use case
3. The Lokus team may add the command to core

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx lokus-plugin create` | Create a new plugin |
| `npx lokus-plugin build` | Build for production |
| `npx lokus-plugin dev` | Watch mode development |
| `npx lokus-plugin validate` | Validate plugin.json |
| `npx lokus-plugin link` | Link to local Lokus |
| `npx lokus-plugin package` | Create distributable ZIP |
| `npx lokus-plugin publish` | Publish to registry |

---

## Quick Start

```bash
# Create a new plugin
npx lokus-plugin create my-plugin --template basic-typescript

# Navigate to plugin directory
cd my-plugin

# Build and test
npm run build
npm test

# Link to Lokus for development
npx lokus-plugin link

# Validate manifest
npx lokus-plugin validate
```

---

*Last Updated: December 17, 2025*
