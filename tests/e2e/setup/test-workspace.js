/**
 * Test Workspace Setup for E2E Testing
 * This handles creating and managing test workspaces for Playwright tests
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { test as base } from '@playwright/test';

// Extend Playwright test with workspace setup
export const test = base.extend({
  // Create a test workspace for each test
  testWorkspace: async ({}, use) => {
    const workspaceDir = join(tmpdir(), `lokus-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    
    // Create workspace directory
    await fs.mkdir(workspaceDir, { recursive: true });
    
    // Create sample files for testing
    const testFiles = {
      'README.md': '# Test Workspace\n\nThis is a test workspace for E2E testing.',
      'notes.md': '# Notes\n\n- Test note 1\n- Test note 2',
      'todo.md': '# Todo\n\n- [ ] Task 1\n- [x] Completed task',
      'test.canvas': JSON.stringify({
        nodes: [
          {
            id: 'test-node-1',
            x: 100,
            y: 100,
            width: 200,
            height: 100,
            type: 'text',
            text: 'Test Canvas Node'
          }
        ],
        edges: [],
        metadata: {
          version: '1.0',
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          createdWith: 'Lokus Test'
        }
      }, null, 2)
    };

    // Write test files
    for (const [filename, content] of Object.entries(testFiles)) {
      await fs.writeFile(join(workspaceDir, filename), content);
    }

    // Create subdirectories
    await fs.mkdir(join(workspaceDir, 'projects'), { recursive: true });
    await fs.writeFile(
      join(workspaceDir, 'projects', 'project1.md'), 
      '# Project 1\n\nProject details here.'
    );

    // Pass workspace path to test
    await use(workspaceDir);

    // Cleanup after test
    try {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test workspace:', error);
    }
  },

  // Auto-navigate to workspace in each test
  workspacePage: async ({ page, testWorkspace }, use) => {
    // Set test workspace path as environment variable for the app
    await page.addInitScript((workspacePath) => {
      window.TEST_WORKSPACE_PATH = workspacePath;
    }, testWorkspace);

    // Navigate to app
    await page.goto('http://localhost:1420');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Inject workspace selection if needed
    await page.evaluate((workspacePath) => {
      // Store workspace path for the app to use
      if (window.localStorage) {
        window.localStorage.setItem('lokus-test-workspace', workspacePath);
      }
    }, testWorkspace);

    await use(page);
  }
});

export { expect } from '@playwright/test';

// Helper functions for E2E tests
export class TestWorkspaceHelper {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
  }

  async createFile(filename, content = '') {
    const filePath = join(this.workspacePath, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  async createCanvas(filename, canvasData = null) {
    const defaultCanvas = {
      nodes: [],
      edges: [],
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        createdWith: 'Lokus Test'
      }
    };

    const content = JSON.stringify(canvasData || defaultCanvas, null, 2);
    return await this.createFile(filename.endsWith('.canvas') ? filename : `${filename}.canvas`, content);
  }

  async readFile(filename) {
    const filePath = join(this.workspacePath, filename);
    return await fs.readFile(filePath, 'utf8');
  }

  async fileExists(filename) {
    try {
      const filePath = join(this.workspacePath, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles() {
    return await fs.readdir(this.workspacePath);
  }
}

// Workspace configuration for different test scenarios
export const testWorkspaceConfigs = {
  empty: {
    files: {}
  },
  
  basic: {
    files: {
      'README.md': '# Basic Workspace',
      'notes.md': '# Notes\n\nTest notes here.'
    }
  },
  
  withCanvas: {
    files: {
      'README.md': '# Canvas Workspace',
      'diagram.canvas': JSON.stringify({
        nodes: [
          { id: '1', x: 0, y: 0, width: 100, height: 50, type: 'text', text: 'Node 1' },
          { id: '2', x: 200, y: 0, width: 100, height: 50, type: 'text', text: 'Node 2' }
        ],
        edges: [
          { id: 'e1', fromNode: '1', toNode: '2', color: 'black' }
        ]
      }, null, 2)
    }
  },
  
  large: {
    files: {
      'README.md': '# Large Workspace',
      'notes/personal.md': '# Personal Notes',
      'notes/work.md': '# Work Notes', 
      'projects/project-a.md': '# Project A',
      'projects/project-b.md': '# Project B',
      'archive/old-notes.md': '# Archived Notes'
    }
  }
};

// Function to create workspace with specific config
export async function createConfiguredWorkspace(config = testWorkspaceConfigs.basic) {
  const workspaceDir = join(tmpdir(), `lokus-configured-${Date.now()}`);
  await fs.mkdir(workspaceDir, { recursive: true });

  for (const [filePath, content] of Object.entries(config.files)) {
    const fullPath = join(workspaceDir, filePath);
    const dir = join(fullPath, '..');
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return workspaceDir;
}