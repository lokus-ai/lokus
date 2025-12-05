# Troubleshooting Guide

This guide helps resolve common issues with Lokus.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Launch Issues](#launch-issues)
- [Performance Issues](#performance-issues)
- [File Operations](#file-operations)
- [Plugin Issues](#plugin-issues)
- [Sync and Cloud](#sync-and-cloud)
- [Platform-Specific Issues](#platform-specific-issues)

---

## Installation Issues

### macOS: "App is damaged and can't be opened"

**Cause**: macOS Gatekeeper quarantine attribute on unsigned builds.

**Solution**:
```bash
xattr -cr /Applications/Lokus.app
```

Or remove the quarantine attribute from the downloaded file:
```bash
xattr -d com.apple.quarantine /path/to/Lokus.app
```

### macOS: App won't open after installation

**Solution**: Right-click the app and select "Open" instead of double-clicking. This bypasses Gatekeeper.

### Windows: SmartScreen warning

**Cause**: App is not signed with an EV certificate.

**Solution**: Click "More info" then "Run anyway". This is safe for official releases from the Lokus repository.

### Linux: App won't launch

**Cause**: Missing dependencies.

**Solution**:
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev libssl-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel

# Arch
sudo pacman -S webkit2gtk openssl
```

---

## Launch Issues

### App crashes on startup

**Symptoms**: App window appears briefly then closes.

**Solutions**:

1. **Check logs** (macOS/Linux):
   ```bash
   # macOS
   ~/Library/Logs/Lokus/

   # Linux
   ~/.local/share/lokus/logs/
   ```

2. **Reset app data**:
   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/io.lokus.app/

   # Linux
   rm -rf ~/.local/share/lokus/

   # Windows
   # Delete: %APPDATA%\io.lokus.app
   ```

3. **Clear cache**:
   ```bash
   # macOS
   rm -rf ~/Library/Caches/io.lokus.app/

   # Linux
   rm -rf ~/.cache/lokus/
   ```

### "WebView2 not found" (Windows only)

**Cause**: Missing Microsoft Edge WebView2 Runtime.

**Solution**: Download and install from https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### App hangs on "Loading workspace"

**Cause**: Corrupted workspace index or very large workspace.

**Solutions**:

1. **Rebuild index**:
   - Close Lokus
   - Delete `{workspace}/.lokus/index.db`
   - Reopen workspace

2. **Check workspace size**:
   ```bash
   du -sh /path/to/workspace
   ```
   Very large workspaces (>10GB) may take time to index.

---

## Performance Issues

### Slow search

**Causes**: Large workspace, no index, or index corruption.

**Solutions**:

1. **Rebuild search index**:
   - Settings → Advanced → Rebuild Index

2. **Exclude large folders**:
   - Create `.lokusignore` file in workspace root
   - Add folder patterns to ignore:
     ```
     node_modules/
     .git/
     dist/
     build/
     ```

### High memory usage

**Cause**: Many open tabs, large files, or memory leaks.

**Solutions**:

1. **Close unused tabs**: Cmd/Ctrl+W
2. **Restart app**: File → Quit (Cmd/Ctrl+Q)
3. **Check tab limit**: Settings → Editor → Max Open Tabs
4. **Report memory leaks**: Open an issue with reproduction steps

### Slow file loading

**Cause**: Very large markdown files or complex renders.

**Solutions**:

1. **Split large files** (>10,000 lines)
2. **Reduce live preview complexity** (fewer embeds, images)
3. **Disable unused plugins**

---

## File Operations

### Files not saving

**Symptoms**: "Unsaved changes" indicator stays visible after save.

**Solutions**:

1. **Check file permissions**:
   ```bash
   ls -l /path/to/file.md
   chmod u+w /path/to/file.md  # If read-only
   ```

2. **Check disk space**:
   ```bash
   df -h
   ```

3. **Force save**: Cmd/Ctrl+Shift+S (Save As)

### Lost work after crash

**Solution**: Check auto-recovery files:
- macOS: `~/Library/Application Support/io.lokus.app/recovery/`
- Linux: `~/.local/share/lokus/recovery/`
- Windows: `%APPDATA%\io.lokus.app\recovery\`

### File conflicts

**Symptoms**: Files with `.conflict-{timestamp}` suffix appear.

**Cause**: File was modified externally while open in Lokus.

**Solution**: Compare and merge manually:
1. Right-click → "Select for Compare"
2. Right-click conflict file → "Compare With"

---

## Plugin Issues

### Plugin won't install

**Causes**: Permission denied, invalid manifest, or compatibility.

**Solutions**:

1. **Check plugin compatibility**:
   - Verify `lokusVersion` in plugin manifest
   - Current Lokus version: Help → About

2. **Check plugin manifest**:
   ```json
   {
     "name": "plugin-name",
     "version": "1.0.0",
     "lokusVersion": "^1.3.0",
     "main": "index.js"
   }
   ```

3. **Check permissions**:
   ```bash
   chmod -R 755 ~/.lokus/plugins/
   ```

### Plugin crashes app

**Solution**: Disable plugin:
1. Hold Shift while starting Lokus (Safe Mode)
2. Settings → Plugins → Disable problematic plugin
3. Report to plugin developer

### Plugin API errors

**Check plugin console**: Help → Toggle Developer Tools → Console tab

---

## Sync and Cloud

### Gmail integration fails

**Symptoms**: "Authentication failed" or no emails appear.

**Solutions**:

1. **Re-authenticate**:
   - Settings → Integrations → Gmail → Disconnect
   - Connect again

2. **Check OAuth consent**:
   - Visit Google Account → Security → Third-party apps
   - Ensure Lokus has access to Gmail

3. **Check firewall/proxy** blocking Google API

### MCP server connection issues

**Symptoms**: MCP servers show as "disconnected" in status bar.

**Solutions**:

1. **Check server config**:
   - Settings → MCP Servers → Edit configuration
   - Verify `command` and `args` are correct

2. **Check server logs**:
   ```bash
   # macOS
   ~/Library/Logs/Lokus/mcp-servers/

   # Linux
   ~/.local/share/lokus/logs/mcp-servers/
   ```

3. **Restart server**: Settings → MCP Servers → Restart

---

## Platform-Specific Issues

### macOS: Traffic lights not syncing with theme

**Cause**: Rare NSAppearance API issue.

**Solution**: Restart app or toggle theme (Cmd+Shift+T)

### macOS: Can't select folder in file picker

**Cause**: App Sandbox restrictions (App Store build).

**Solution**: Right-click folder → "Get Info" → Sharing & Permissions → Grant access

### Windows: Titlebar color doesn't match theme

**Cause**: Windows theme override.

**Solution**: Settings → Appearance → Force Theme

### Windows: Can't drag window by titlebar

**Cause**: Custom titlebar region not detecting clicks.

**Solution**: Drag from the app title text area, not buttons

### Linux: Icon not showing in dock/taskbar

**Cause**: Desktop file not installed.

**Solution**:
```bash
cp lokus.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications
```

---

## Error Codes

### ERR_FILE_ACCESS

**Cause**: Permission denied or file doesn't exist.

**Solution**: Check file permissions and path.

### ERR_WORKSPACE_INVALID

**Cause**: Selected folder is not a valid workspace.

**Solution**: Create `.lokus/` folder in workspace root or choose a different folder.

### ERR_PLUGIN_LOAD_FAILED

**Cause**: Plugin code error or incompatibility.

**Solution**: Check plugin developer tools console for stack trace.

### ERR_NETWORK_TIMEOUT

**Cause**: Network connection issue.

**Solution**: Check internet connection, firewall, or proxy settings.

---

## Getting More Help

1. **Search existing issues**: https://github.com/lokus-ai/lokus/issues
2. **Join Discord community**: https://discord.gg/lokus
3. **Open a new issue**: https://github.com/lokus-ai/lokus/issues/new
   - Include Lokus version (Help → About)
   - Include OS and version
   - Include reproduction steps
   - Include relevant logs

## Debugging Tools

### Enable Developer Tools

**macOS/Linux**: Cmd/Ctrl+Shift+I

**Windows**: F12

### Enable Debug Logging

Add to workspace `.lokus/config.json`:
```json
{
  "debug": {
    "logLevel": "debug",
    "logToFile": true
  }
}
```

### Crash Reports

Lokus automatically sends crash reports to our self-hosted error tracking (crash.lokusmd.com) if enabled in Settings → Privacy.

To disable: Settings → Privacy → Crash Reporting → Off

---

**Last Updated**: 2024-01-29
**Version**: 1.3.5
