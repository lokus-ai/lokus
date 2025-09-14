/**
 * Test Workspace Utility
 * Handles automatic workspace creation for E2E testing
 */

import { invoke } from '@tauri-apps/api/core'

export class TestWorkspaceManager {
  constructor() {
    this.testWorkspacePath = null
    this.isTestMode = false
  }

  /**
   * Check if we're in test mode based on URL parameters
   */
  detectTestMode() {
    const urlParams = new URLSearchParams(window.location.search)
    this.isTestMode = urlParams.get('testMode') === 'true' || 
                     window.TEST_WORKSPACE_PATH || 
                     localStorage.getItem('lokus-test-workspace')
    
    console.log('Test mode detected:', this.isTestMode)
    return this.isTestMode
  }

  /**
   * Create temporary workspace with test files
   */
  async createTestWorkspace() {
    if (!this.isTestMode) return null

    try {
      // Generate unique workspace path
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(7)
      this.testWorkspacePath = `/tmp/lokus-test-${timestamp}-${random}`

      console.log('Creating test workspace at:', this.testWorkspacePath)

      // Create workspace directory
      await this.createDirectory(this.testWorkspacePath)

      // Create test files
      await this.createTestFiles()

      // Store for cleanup
      window.addEventListener('beforeunload', () => this.cleanup())

      console.log('✅ Test workspace created successfully')
      return this.testWorkspacePath

    } catch (error) {
      console.error('Failed to create test workspace:', error)
      
      // Fallback to in-memory workspace path
      this.testWorkspacePath = `/tmp/lokus-fallback-${Date.now()}`
      return this.testWorkspacePath
    }
  }

  /**
   * Create directory (handles both Tauri and browser contexts)
   */
  async createDirectory(path) {
    try {
      // Try Tauri first
      await invoke('create_directory', { path })
    } catch (error) {
      // Browser fallback - simulate directory creation
      console.log('Browser mode: simulating directory creation for', path)
    }
  }

  /**
   * Write file (handles both Tauri and browser contexts)
   */
  async writeFile(path, content) {
    try {
      // Try Tauri first
      await invoke('write_file_content', { path, content })
    } catch (error) {
      // Browser fallback - store in memory/localStorage
      const key = `test-file-${path.replace(/[^a-zA-Z0-9]/g, '-')}`
      localStorage.setItem(key, content)
      console.log('Browser mode: stored file in localStorage:', path)
    }
  }

  /**
   * Create test files in the workspace
   */
  async createTestFiles() {
    const testFiles = {
      'README.md': `# Test Workspace

This is an automatically generated test workspace for E2E testing.

## Files
- **notes.md** - Sample notes
- **test-canvas.canvas** - Sample canvas
- **todo.md** - Task list

Created at: ${new Date().toISOString()}`,

      'notes.md': `# Sample Notes

This is a test note file for E2E testing.

## Features to Test
- **Bold text**
- *Italic text* 
- ~~Strikethrough~~
- ==Highlight==

### Math Equations
Inline math: $x^2 + y^2 = z^2$

Block math:
$$E = mc^2$$

### Lists
- Item 1
- Item 2
- Item 3

### Task Lists
- [ ] Incomplete task
- [x] Completed task
- [ ] Another task

### Code
\`\`\`javascript
console.log('Hello from test workspace!');
\`\`\``,

      'todo.md': `# Todo List

- [ ] Test canvas functionality
- [ ] Test editor features
- [ ] Test file operations
- [x] Create test workspace
- [ ] Run E2E tests

## In Progress
- [ ] Math rendering tests
- [ ] Wiki link tests

## Completed
- [x] Basic workspace setup`,

      'test-canvas.canvas': JSON.stringify({
        nodes: [
          {
            id: 'test-node-1',
            x: 100,
            y: 100,
            width: 200,
            height: 100,
            type: 'text',
            text: 'Test Canvas Node',
            color: 'blue'
          },
          {
            id: 'test-node-2', 
            x: 400,
            y: 200,
            width: 150,
            height: 75,
            type: 'text',
            text: 'Another Node',
            color: 'green'
          },
          {
            id: 'file-node-1',
            x: 200,
            y: 300,
            width: 180,
            height: 60,
            type: 'file',
            file: 'notes.md'
          }
        ],
        edges: [
          {
            id: 'edge-1',
            fromNode: 'test-node-1',
            toNode: 'test-node-2',
            color: 'black',
            label: 'Connection'
          }
        ],
        metadata: {
          version: '1.0',
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          createdWith: 'Lokus E2E Test'
        }
      }, null, 2),

      'projects/project1.md': `# Project 1

This is a test project file in a subdirectory.

## Goals
- Test nested file structures
- Test file tree navigation
- Test project organization`,

      'archive/old-notes.md': `# Archived Notes

These are old notes for testing archive functionality.

**Note:** This tests nested directory structures.`
    }

    // Create all test files
    for (const [relativePath, content] of Object.entries(testFiles)) {
      const fullPath = `${this.testWorkspacePath}/${relativePath}`
      
      // Create directory if needed
      if (relativePath.includes('/')) {
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))
        await this.createDirectory(dirPath)
      }
      
      await this.writeFile(fullPath, content)
    }

    console.log(`✅ Created ${Object.keys(testFiles).length} test files`)
  }

  /**
   * Get the test workspace path
   */
  getWorkspacePath() {
    return this.testWorkspacePath
  }

  /**
   * Clean up test workspace
   */
  async cleanup() {
    if (!this.testWorkspacePath) return

    try {
      await invoke('delete_directory', { path: this.testWorkspacePath })
      console.log('✅ Test workspace cleaned up')
    } catch (error) {
      // Browser mode - clear localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('test-file-'))
      keys.forEach(key => localStorage.removeItem(key))
      console.log('✅ Browser test files cleaned up')
    }
  }

  /**
   * Check if current workspace is a test workspace
   */
  isCurrentWorkspaceTest(workspacePath) {
    return workspacePath && workspacePath.includes('lokus-test')
  }
}

// Create singleton instance
export const testWorkspaceManager = new TestWorkspaceManager()