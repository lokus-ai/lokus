/**
 * Tauri IPC Mocks for E2E Testing
 *
 * This module provides mock implementations for Tauri commands
 * used by the Lokus app. When VITE_PLAYWRIGHT=true, the app loads
 * @tauri-apps/api/mocks and exposes mockIPC on window.__tauriMocks.
 *
 * These mocks simulate the Rust backend behavior for browser-based testing.
 */

/**
 * In-memory file system for mocking file operations
 */
export function createMockFileSystem(workspacePath) {
  // Initialize with test files
  const files = new Map([
    [`${workspacePath}/README.md`, '# E2E Test Workspace\n\nThis is a test workspace.'],
    [`${workspacePath}/test-note.md`, '# Test Note\n\nHello World! This is a test note.\n\n**Bold** and *italic* text.'],
    [`${workspacePath}/daily-notes.md`, '# Daily Notes\n\n- [ ] Task 1\n- [x] Task 2'],
    [`${workspacePath}/search-test.md`, '# Search Test\n\nKeywords: apple banana cherry'],
    [`${workspacePath}/notes/project-ideas.md`, '# Project Ideas\n\n1. Build a task manager'],
    [`${workspacePath}/notes/meeting-notes.md`, '# Meeting Notes\n\n## Weekly Standup'],
  ]);

  const directories = new Set([
    workspacePath,
    `${workspacePath}/.lokus`,
    `${workspacePath}/notes`,
  ]);

  return {
    files,
    directories,

    readFile(path) {
      return files.get(path) || null;
    },

    writeFile(path, content) {
      files.set(path, content);
      // Ensure parent directory exists
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) directories.add(dir);
    },

    deleteFile(path) {
      files.delete(path);
    },

    listDirectory(dirPath) {
      const entries = [];
      const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';

      for (const filePath of files.keys()) {
        if (filePath.startsWith(prefix)) {
          const relativePath = filePath.substring(prefix.length);
          const slashIndex = relativePath.indexOf('/');
          if (slashIndex === -1) {
            // Direct child file
            entries.push({
              name: relativePath,
              path: filePath,
              isDirectory: false,
              isFile: true,
            });
          } else {
            // Child directory
            const dirName = relativePath.substring(0, slashIndex);
            const childDirPath = prefix + dirName;
            if (!entries.find(e => e.path === childDirPath)) {
              entries.push({
                name: dirName,
                path: childDirPath,
                isDirectory: true,
                isFile: false,
              });
            }
          }
        }
      }

      return entries;
    },

    exists(path) {
      return files.has(path) || directories.has(path);
    },
  };
}

/**
 * Setup Tauri mocks for a Playwright page
 *
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} workspacePath - Path to mock workspace
 */
export async function setupTauriMocks(page, workspacePath) {
  await page.evaluate((wsPath) => {
    if (!window.__tauriMocks) {
      console.warn('[E2E] Tauri mocks not available - VITE_PLAYWRIGHT may not be set');
      return;
    }

    // Create in-memory file system
    const files = new Map([
      [`${wsPath}/README.md`, '# E2E Test Workspace\n\nThis is a test workspace.'],
      [`${wsPath}/test-note.md`, '# Test Note\n\nHello World! This is a test note.\n\n**Bold** and *italic* text.'],
      [`${wsPath}/daily-notes.md`, '# Daily Notes\n\n- [ ] Task 1\n- [x] Task 2'],
      [`${wsPath}/search-test.md`, '# Search Test\n\nKeywords: apple banana cherry'],
      [`${wsPath}/notes/project-ideas.md`, '# Project Ideas\n\n1. Build a task manager'],
      [`${wsPath}/notes/meeting-notes.md`, '# Meeting Notes\n\n## Weekly Standup'],
    ]);

    const directories = new Set([
      wsPath,
      `${wsPath}/.lokus`,
      `${wsPath}/notes`,
    ]);

    // Mock all Tauri IPC commands
    window.__tauriMocks.mockIPC((cmd, args) => {
      console.log(`[E2E Mock] ${cmd}`, args);

      switch (cmd) {
        // Workspace validation
        case 'validate_workspace_path':
          return { valid: true, path: args.path };

        case 'get_validated_workspace_path':
          return wsPath;

        case 'save_last_workspace':
        case 'clear_last_workspace':
        case 'clear_all_workspace_data':
        case 'force_launcher_mode':
          return null;

        case 'is_development_mode':
          return true;

        case 'check_workspace_needs_reauth':
          return false;

        // File operations
        case 'read_file_content':
        case 'read_workspace_file':
          return files.get(args.path) || '';

        case 'write_file_content':
          files.set(args.path, args.content);
          return null;

        case 'read_workspace_files':
          return Array.from(files.entries())
            .filter(([path]) => path.startsWith(args.workspacePath))
            .map(([path, content]) => ({
              path,
              name: path.split('/').pop(),
              content,
              isDirectory: false,
            }));

        case 'list_workspace_directory':
          const entries = [];
          const prefix = args.path.endsWith('/') ? args.path : args.path + '/';

          for (const filePath of files.keys()) {
            if (filePath.startsWith(prefix)) {
              const relativePath = filePath.substring(prefix.length);
              const slashIndex = relativePath.indexOf('/');
              if (slashIndex === -1) {
                entries.push({
                  name: relativePath,
                  path: filePath,
                  isDirectory: false,
                  isFile: true,
                });
              }
            }
          }
          return entries;

        case 'get_file_stats':
          const exists = files.has(args.path);
          return exists ? {
            size: files.get(args.path)?.length || 0,
            modified: Date.now(),
            created: Date.now(),
            isFile: true,
            isDirectory: false,
          } : null;

        case 'create_directory':
          directories.add(args.path);
          return null;

        // Clipboard
        case 'clipboard_write_text':
        case 'clipboard_write_html':
        case 'clipboard_clear':
          return null;

        case 'clipboard_read_text':
          return '';

        case 'clipboard_read_html':
          return '';

        case 'clipboard_has_text':
          return false;

        // Kanban boards
        case 'list_kanban_boards':
          return [];

        case 'create_kanban_board':
        case 'open_kanban_board':
        case 'add_card_to_board':
          return null;

        // Session state
        case 'load_session_state':
          return { openTabs: [], activeTab: null };

        case 'save_session_state':
          return null;

        // Image handling
        case 'read_image_file':
          return null;

        // Windows-specific (no-op on other platforms)
        case 'windows_register_file_associations':
        case 'windows_check_file_associations':
        case 'windows_update_jump_list':
        case 'windows_clear_jump_list':
        case 'windows_register_context_menu':
        case 'windows_unregister_context_menu':
        case 'windows_set_taskbar_progress':
        case 'windows_clear_taskbar_progress':
        case 'windows_show_notification':
        case 'windows_clear_notification':
        case 'windows_is_dark_mode':
        case 'windows_watch_theme_changes':
        case 'windows_index_workspace':
        case 'windows_remove_from_index':
          return null;

        // Gmail auth
        case 'gmail_initiate_auth':
          return 'https://mock-auth-url.com';

        // Default - log unknown commands
        default:
          console.warn(`[E2E Mock] Unknown command: ${cmd}`, args);
          return null;
      }
    });

    // Mock windows
    window.__tauriMocks.mockWindows('main');

    console.log('[E2E] Tauri mocks initialized with workspace:', wsPath);
  }, workspacePath);
}

/**
 * Clear all Tauri mocks
 *
 * @param {import('@playwright/test').Page} page - Playwright page
 */
export async function clearTauriMocks(page) {
  await page.evaluate(() => {
    if (window.__tauriMocks?.clearMocks) {
      window.__tauriMocks.clearMocks();
      console.log('[E2E] Tauri mocks cleared');
    }
  });
}
