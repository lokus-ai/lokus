/**
 * Tauri Mock for E2E Testing
 *
 * This mock intercepts Tauri invoke calls and provides
 * an in-memory filesystem for testing without the Tauri backend.
 */

// In-memory filesystem
const mockFileSystem = new Map();
const mockDirectories = new Set(['/tmp/lokus-e2e-test']);

// Initialize with some test files
function initMockFileSystem() {
  const workspacePath = '/tmp/lokus-e2e-test';
  mockDirectories.add(workspacePath);
  mockDirectories.add(`${workspacePath}/.lokus`);
  mockDirectories.add(`${workspacePath}/notes`);

  // Create initial test files with content useful for testing
  mockFileSystem.set(`${workspacePath}/README.md`, `# Test Workspace

This is a test workspace for E2E testing.

## Features

- Editor functionality
- Search capabilities
- Markdown rendering

Hello world! This is searchable content.
`);
  
  mockFileSystem.set(`${workspacePath}/test-note.md`, `# Test Note

Hello World! This is a test note.

## Formatting Test

**Bold text** and *italic text* and ~~strikethrough~~.

- List item 1
- List item 2
- List item 3

\`\`\`javascript
console.log("Hello from code block");
\`\`\`

> This is a blockquote

[[Wiki Link Test]]
`);

  mockFileSystem.set(`${workspacePath}/notes/daily.md`, `# Daily Notes

Today's tasks:
- [ ] First task
- [x] Completed task
- [ ] Another task

$E = mc^2$

Some math: $\\int_0^1 x^2 dx$
`);

  mockFileSystem.set(`${workspacePath}/.lokus/config.json`, JSON.stringify({ theme: 'light' }));
}

// Mock implementations for Tauri commands
const mockCommands = {
  // File operations
  read_file_content: async ({ path }) => {
    if (mockFileSystem.has(path)) {
      return mockFileSystem.get(path);
    }
    throw new Error(`File not found: ${path}`);
  },

  write_file_content: async ({ path, content }) => {
    mockFileSystem.set(path, content);
    return true;
  },

  write_file: async ({ path, content }) => {
    mockFileSystem.set(path, content);
    return true;
  },

  create_directory: async ({ path }) => {
    mockDirectories.add(path);
    return true;
  },

  list_directory: async ({ path }) => {
    const entries = [];
    const prefix = path.endsWith('/') ? path : `${path}/`;

    // Find all files in this directory
    for (const [filePath] of mockFileSystem) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        if (!relativePath.includes('/')) {
          entries.push({
            name: relativePath,
            path: filePath,
            is_dir: false,
            is_file: true
          });
        }
      }
    }

    // Find all subdirectories
    for (const dirPath of mockDirectories) {
      if (dirPath.startsWith(prefix) && dirPath !== path) {
        const relativePath = dirPath.slice(prefix.length);
        if (!relativePath.includes('/')) {
          entries.push({
            name: relativePath,
            path: dirPath,
            is_dir: true,
            is_file: false
          });
        }
      }
    }

    return entries;
  },

  read_workspace_files: async ({ workspacePath }) => {
    const prefix = workspacePath.endsWith('/') ? workspacePath : `${workspacePath}/`;
    
    // Build a tree structure that the Workspace component expects
    const buildTree = () => {
      const root = [];
      const dirMap = new Map();
      
      // Add files
      for (const [filePath, content] of mockFileSystem) {
        if (!filePath.startsWith(prefix)) continue;
        
        const relativePath = filePath.slice(prefix.length);
        const parts = relativePath.split('/');
        const fileName = parts.pop();
        
        // Skip hidden files except specific ones
        if (fileName.startsWith('.') && fileName !== '.md') continue;
        
        const fileNode = {
          name: fileName,
          path: filePath,
          is_directory: false,
          is_file: true,
          children: null
        };
        
        if (parts.length === 0) {
          // File in root
          root.push(fileNode);
        } else {
          // File in subdirectory - ensure parent dirs exist
          let currentPath = prefix.slice(0, -1);
          let currentLevel = root;
          
          for (const dir of parts) {
            currentPath = `${currentPath}/${dir}`;
            let dirNode = dirMap.get(currentPath);
            
            if (!dirNode) {
              dirNode = {
                name: dir,
                path: currentPath,
                is_directory: true,
                is_file: false,
                children: []
              };
              dirMap.set(currentPath, dirNode);
              currentLevel.push(dirNode);
            }
            currentLevel = dirNode.children;
          }
          currentLevel.push(fileNode);
        }
      }
      
      // Add empty directories
      for (const dirPath of mockDirectories) {
        if (!dirPath.startsWith(prefix) || dirPath === workspacePath) continue;
        
        const relativePath = dirPath.slice(prefix.length);
        if (relativePath.startsWith('.')) continue;
        
        if (!dirMap.has(dirPath)) {
          const parts = relativePath.split('/');
          let currentPath = prefix.slice(0, -1);
          let currentLevel = root;
          
          for (const dir of parts) {
            currentPath = `${currentPath}/${dir}`;
            let dirNode = dirMap.get(currentPath);
            
            if (!dirNode) {
              dirNode = {
                name: dir,
                path: currentPath,
                is_directory: true,
                is_file: false,
                children: []
              };
              dirMap.set(currentPath, dirNode);
              currentLevel.push(dirNode);
            }
            currentLevel = dirNode.children;
          }
        }
      }
      
      return root;
    };
    
    return buildTree();
  },

  // Workspace operations
  validate_workspace_path: async ({ path }) => {
    return mockDirectories.has(path) || path.startsWith('/tmp/lokus');
  },

  get_validated_workspace_path: async () => {
    return '/tmp/lokus-e2e-test';
  },

  save_last_workspace: async ({ path }) => {
    return true;
  },

  clear_last_workspace: async () => {
    return true;
  },

  is_development_mode: async () => {
    return true;
  },

  force_launcher_mode: async () => {
    return true;
  },

  clear_all_workspace_data: async () => {
    return true;
  },

  // Kanban operations (return empty for tests)
  list_kanban_boards: async () => {
    return [];
  },

  open_kanban_board: async () => {
    return { columns: [], cards: [] };
  },

  create_kanban_board: async ({ name }) => {
    return { name, columns: [], cards: [] };
  },

  add_card_to_board: async () => {
    return true;
  },

  // Image operations
  read_image_file: async ({ path }) => {
    // Return empty base64 for tests
    return '';
  },

  // Gmail operations (return empty/false for tests)
  gmail_is_authenticated: async () => false,
  gmail_get_profile: async () => null,
  gmail_list_emails: async () => ({ emails: [], nextPageToken: null }),
  gmail_search_emails: async () => ({ emails: [], nextPageToken: null }),

  // Session state operations
  load_session_state: async ({ workspacePath }) => {
    return {
      openTabs: [`${workspacePath}/test-note.md`],
      expandedFolders: [workspacePath],
      recentFiles: [`${workspacePath}/test-note.md`]
    };
  },

  save_session_state: async () => {
    return true;
  },

  // API operations
  api_get_current_workspace: async () => {
    return '/tmp/lokus-e2e-test';
  },

  // Platform operations
  platform_open_with_default: async () => true,
  platform_reveal_in_file_manager: async () => true,
  platform_open_terminal: async () => true,

  // File operations
  rename_file: async ({ path, newName }) => {
    const content = mockFileSystem.get(path);
    if (content !== undefined) {
      const dir = path.substring(0, path.lastIndexOf('/'));
      const newPath = `${dir}/${newName}`;
      mockFileSystem.set(newPath, content);
      mockFileSystem.delete(path);
    }
    return true;
  },

  delete_file: async ({ path }) => {
    mockFileSystem.delete(path);
    return true;
  },

  move_file: async ({ sourcePath, destPath }) => {
    const content = mockFileSystem.get(sourcePath);
    if (content !== undefined) {
      mockFileSystem.set(destPath, content);
      mockFileSystem.delete(sourcePath);
    }
    return true;
  },

  create_folder_in_workspace: async ({ workspacePath, name }) => {
    mockDirectories.add(`${workspacePath}/${name}`);
    return true;
  },

  copy_external_files_to_workspace: async () => {
    return { copied: 0, skipped: 0 };
  },

  // Read all files
  read_all_files: async ({ paths }) => {
    const results = {};
    for (const path of paths) {
      if (mockFileSystem.has(path)) {
        results[path] = mockFileSystem.get(path);
      }
    }
    return results;
  },

  // Git operations (return empty for tests)
  git_get_current_branch: async () => null,
  git_init: async () => ({ success: true }),
  git_add_remote: async () => ({ success: true }),
  git_pull: async () => ({ success: true }),
  git_commit: async () => ({ success: true }),
  git_push: async () => ({ success: true }),
  git_status: async () => ({ staged: [], modified: [], untracked: [] }),

  // Open workspace window
  open_workspace_window: async () => true,
};

// Install the mock
function installTauriMock() {
  initMockFileSystem();

  // Create mock __TAURI_INTERNALS__
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args = {}) => {
      console.log(`[Tauri Mock] invoke: ${cmd}`, args);

      if (mockCommands[cmd]) {
        try {
          const result = await mockCommands[cmd](args);
          console.log(`[Tauri Mock] ${cmd} result:`, result);
          return result;
        } catch (error) {
          console.error(`[Tauri Mock] ${cmd} error:`, error);
          throw error;
        }
      }

      console.warn(`[Tauri Mock] Unknown command: ${cmd}`);
      return null;
    },
    metadata: { test: true }
  };

  window.__TAURI_METADATA__ = { test: true };

  console.log('[Tauri Mock] Installed successfully');
}

// Export for use
window.__installTauriMock = installTauriMock;
window.__mockFileSystem = mockFileSystem;
window.__mockDirectories = mockDirectories;

// Always install when loaded as an init script (via addInitScript)
// The testMode check happens at navigation time, but this script runs BEFORE navigation
// so window.location.search would be empty. Install unconditionally.
installTauriMock();
