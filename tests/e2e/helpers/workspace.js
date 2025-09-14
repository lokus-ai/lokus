import { expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export class WorkspaceHelper {
  constructor(page) {
    this.page = page;
    this.tempWorkspacePath = null;
  }

  async createTempWorkspace() {
    // Create temporary workspace directory
    const tempDir = join(tmpdir(), `lokus-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a test markdown file
    const testFile = join(tempDir, 'test.md');
    await fs.writeFile(testFile, '# Test File\n\nThis is a test file for E2E testing.');
    
    this.tempWorkspacePath = tempDir;
    return tempDir;
  }

  async openWorkspace(page = null) {
    const currentPage = page || this.page;
    
    if (!this.tempWorkspacePath) {
      throw new Error('No temp workspace created. Call createTempWorkspace() first.');
    }

    // Wait for app to load
    await currentPage.waitForSelector('body', { timeout: 10000 });
    
    // Look for workspace selection dialog or button
    const workspaceButton = currentPage.locator(
      'button:has-text("Open Workspace"), ' +
      'button:has-text("Select Workspace"), ' +
      '[data-testid="workspace-button"], ' +
      '.workspace-selector'
    );

    if (await workspaceButton.count() > 0) {
      await workspaceButton.first().click();
      await currentPage.waitForTimeout(1000);
    }

    // Handle file dialog through Tauri API if possible
    // For now, assume workspace is opened automatically or through other means
    await currentPage.waitForTimeout(2000);
  }

  async cleanup() {
    if (this.tempWorkspacePath) {
      try {
        await fs.rm(this.tempWorkspacePath, { recursive: true, force: true });
        this.tempWorkspacePath = null;
      } catch (error) {
        console.warn('Failed to cleanup temp workspace:', error);
      }
    }
  }

  getTempWorkspacePath() {
    return this.tempWorkspacePath;
  }

  async createTestFile(filename, content = '# Test File\n\nTest content') {
    if (!this.tempWorkspacePath) {
      throw new Error('No temp workspace created');
    }

    const filePath = join(this.tempWorkspacePath, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  async createTestCanvas(filename, canvasData = null) {
    if (!this.tempWorkspacePath) {
      throw new Error('No temp workspace created');
    }

    const defaultCanvasData = {
      nodes: [],
      edges: [],
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        createdWith: 'Lokus'
      }
    };

    const canvasName = filename.endsWith('.canvas') ? filename : `${filename}.canvas`;
    const filePath = join(this.tempWorkspacePath, canvasName);
    
    await fs.writeFile(filePath, JSON.stringify(canvasData || defaultCanvasData, null, 2));
    return filePath;
  }
}